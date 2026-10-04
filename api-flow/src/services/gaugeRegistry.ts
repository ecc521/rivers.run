import { GaugeSite, GaugeProvider } from './provider';
import { usgsProvider } from './usgs';
import { ecProvider } from './canada';
import { ukProvider } from './uk';
import { irelandProvider } from './ireland';
import { nwsProvider } from './nws';
import { usaceProvider } from './usace';
import { fimanProvider } from './fiman';
import { logToD1 } from '../utils/logger';
import { normalizeGaugeId } from '../utils/formatting';
import { dropCoveredSites } from '../utils/geo';
import { withTimeout } from '../utils/timeout';
import type { Env } from '../index';

const providers: GaugeProvider[] = [
    usgsProvider,
    ecProvider,
    ukProvider,
    irelandProvider,
    usaceProvider
];

/**
 * Compiles the full gauge registry.
 * If a provider fails, it will preserve the existing entries for that provider 
 * from the historical registry, preventing data loss during temporary API outages.
 */
export async function compileGaugeRegistry(env: Env, existingRegistry: Record<string, GaugeSite> = {}): Promise<Record<string, GaugeSite>> {
    const gaugeRegistry: Record<string, GaugeSite> = { ...existingRegistry };
    
    await logToD1(env, "INFO", "registry", "Starting registry compilation across all providers...");

    for (const provider of providers) {
        await refreshProviderListing(env, gaugeRegistry, provider);
    }

    // NWS before FIMAN: FIMAN drops gauges that NWS already lists
    await refreshNwsListing(env, gaugeRegistry);
    await refreshFimanListing(env, gaugeRegistry);

    return gaugeRegistry;
}

/**
 * Replaces one provider's registry entries with its full site listing. On failure,
 * or an empty listing, the existing entries are kept so a temporary outage loses nothing.
 */
export async function refreshProviderListing(
    env: Env, gaugeRegistry: Record<string, GaugeSite>, provider: GaugeProvider,
    narrow: (sites: GaugeSite[]) => GaugeSite[] | Promise<GaugeSite[]> = sites => sites
): Promise<void> {
    if (!provider.getFullSiteListing) {
        console.log(`- Provider ${provider.id} does not support full site listing.`);
        return;
    }
    const prefix = `${provider.id}:`;
    try {
        const newSites = await narrow(await provider.getFullSiteListing(env));
        if (newSites.length === 0) throw new Error(`${provider.id}: getFullSiteListing returned 0 sites`);
        Object.keys(gaugeRegistry).forEach(k => {
            if (k.startsWith(prefix)) delete gaugeRegistry[k];
        });
        for (const site of newSites) {
            const fullId = `${prefix}${site.id}`;
            gaugeRegistry[fullId] = { ...site, id: fullId };
        }
        await logToD1(env, "INFO", "registry", `Updated ${provider.id}: ${newSites.length} gauges found.`);
    } catch (e: any) {
        const existingCount = Object.keys(gaugeRegistry).filter(k => k.startsWith(prefix)).length;
        await logToD1(env, "WARN", "registry", `Failed to refresh ${provider.id}. Preserving ${existingCount} existing entries. Error: ${e.message || e}`);
    }
}

/** The lookup stops starting new batches after this long; what it has found is kept and the rest is retried next time. */
const LOOKUP_BUDGET_MS = 150_000;
const LOOKUP_BATCH = 50;
const LOOKUP_BATCH_TIMEOUT_MS = 45_000;

/** NWS site details in bounded batches, so a slow or hung NWPS costs minutes, not the whole refresh. */
async function lookUpSites(ids: string[]): Promise<GaugeSite[]> {
    const found: GaugeSite[] = [];
    const deadline = Date.now() + LOOKUP_BUDGET_MS;
    for (let i = 0; i < ids.length && Date.now() < deadline; i += LOOKUP_BATCH) {
        try {
            found.push(...await withTimeout(nwsProvider.getSiteListing(ids.slice(i, i + LOOKUP_BATCH)), LOOKUP_BATCH_TIMEOUT_MS, "NWS site lookup timed out"));
        } catch (e) {
            console.warn("NWS site lookup batch failed", e);
        }
    }
    return found;
}

const sitesWithPrefix = (registry: Record<string, GaugeSite>, prefix: string) =>
    Object.entries(registry).filter(([id]) => id.startsWith(prefix)).map(([, site]) => site);

/**
 * NWS gauges for the map, plus those rivers link: those no USGS gauge in the registry already covers, either by
 * location or because NWPS says the gauge sits on a USGS site we list. NWPS reports that
 * USGS site only per gauge, so it is looked up once and kept on the registry entry
 * (null: none); a failed lookup is retried at the next refresh.
 */
export async function refreshNwsListing(env: Env, gaugeRegistry: Record<string, GaugeSite>): Promise<void> {
    const usgsSites = sitesWithPrefix(gaugeRegistry, "USGS:");
    const usgsIds = new Set(Object.keys(gaugeRegistry).filter(id => id.startsWith("USGS:")).map(id => id.slice(5)));
    await refreshProviderListing(env, gaugeRegistry, nwsProvider, async sites => {
        const uncovered = dropCoveredSites(sites, usgsSites);
        const knownUsgsId = (id: string) => gaugeRegistry[`NWS:${id}`]?.usgsId;
        const toLookUp = uncovered.filter(s => knownUsgsId(s.id) === undefined).map(s => s.id);
        const looked = await lookUpSites(toLookUp);
        const found = new Map(looked.map(s => [s.id, s.usgsId ?? null]));
        return uncovered.flatMap(site => {
            const known = knownUsgsId(site.id);
            const usgsId = known === undefined ? found.get(site.id) : known;
            return usgsId && usgsIds.has(usgsId) ? [] : [{ ...site, usgsId }];
        });
    });
    await addLinkedSites(env, gaugeRegistry, nwsProvider);
}

/**
 * FIMAN gauges for the map, plus those rivers link: those no USGS or NWS gauge in the registry already covers.
 * It needs both, so it runs after their listings.
 */
export async function refreshFimanListing(env: Env, gaugeRegistry: Record<string, GaugeSite>): Promise<void> {
    const covering = [...sitesWithPrefix(gaugeRegistry, "USGS:"), ...sitesWithPrefix(gaugeRegistry, "NWS:")];
    await refreshProviderListing(env, gaugeRegistry, fimanProvider, sites => dropCoveredSites(sites, covering));
    await addLinkedSites(env, gaugeRegistry, fimanProvider);
}

/**
 * Adds the sites of the gauges rivers currently link to, whether or not the provider's
 * listing includes them. Nothing changes when no river links one, or when the lookup fails.
 */
async function addLinkedSites(env: Env, gaugeRegistry: Record<string, GaugeSite>, provider: GaugeProvider): Promise<void> {
    const prefix = `${provider.id}:`;
    try {
        const { results: riverResults } = await env.DB.prepare("SELECT gauges FROM rivers").all();
        const active = new Set<string>();
        (riverResults || []).forEach((row: any) => {
            try {
                const gauges = typeof row.gauges === "string" ? JSON.parse(row.gauges) : (row.gauges || []);
                gauges.forEach((g: any) => {
                    if (typeof g.id === "string") {
                        const normalized = normalizeGaugeId(g.id);
                        if (normalized.startsWith(prefix)) active.add(normalized.substring(prefix.length));
                    }
                });
            } catch (e) {
                console.warn("Failed to parse gauges for row during registry compile", e);
            }
        });

        if (active.size > 0) {
            const sites = await provider.getSiteListing(Array.from(active));
            for (const site of sites) {
                const fullId = `${prefix}${site.id}`;
                gaugeRegistry[fullId] = { ...site, id: fullId };
            }
            await logToD1(env, "INFO", "registry", `Added ${sites.length} linked ${provider.id} gauges to the registry.`);
        }
    } catch (e: any) {
        await logToD1(env, "WARN", "registry", `Failed to add linked ${provider.id} gauges. Error: ${e.message || e}`);
    }
}
