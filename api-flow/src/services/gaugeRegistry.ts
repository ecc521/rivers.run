import { GaugeSite, GaugeProvider } from './provider';
import { usgsProvider } from './usgs';
import { ecProvider } from './canada';
import { ukProvider } from './uk';
import { irelandProvider } from './ireland';
import { nwsProvider } from './nws';
import { usaceProvider } from './usace';
import { logToD1 } from '../utils/logger';
import { normalizeGaugeId } from '../utils/formatting';
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

    // 4. Fetch NWS gauges that are actively used by rivers to avoid loading/polling all NWS sites
    try {
        await logToD1(env, "INFO", "registry", "Fetching active NWS gauges from database...");
        const { results: riverResults } = await env.DB.prepare("SELECT gauges FROM rivers").all();
        const activeNwsGauges = new Set<string>();
        (riverResults || []).forEach((row: any) => {
            try {
                const gauges = typeof row.gauges === "string" ? JSON.parse(row.gauges) : (row.gauges || []);
                gauges.forEach((g: any) => {
                    if (typeof g.id === "string") {
                        const normalized = normalizeGaugeId(g.id);
                        if (normalized.startsWith("NWS:")) {
                            activeNwsGauges.add(normalized.substring(4));
                        }
                    }
                });
            } catch (e) {
                console.warn("Failed to parse gauges for row during registry compile", e);
            }
        });

        if (activeNwsGauges.size > 0) {
            const nwsList = Array.from(activeNwsGauges);
            const nwsSites = await nwsProvider.getSiteListing(nwsList);
            
            // Clear old NWS entries
            Object.keys(gaugeRegistry).forEach(k => {
                if (k.startsWith("NWS:")) delete gaugeRegistry[k];
            });

            for (const site of nwsSites) {
                const fullId = `NWS:${site.id}`;
                gaugeRegistry[fullId] = {
                    ...site,
                    id: fullId
                };
            }
            await logToD1(env, "INFO", "registry", `Updated NWS active registry: ${nwsSites.length} gauges found.`);
        }
    } catch (e: any) {
        await logToD1(env, "WARN", "registry", `Failed to compile active NWS registry. Error: ${e.message || e}`);
    }

    return gaugeRegistry;
}

/**
 * Replaces one provider's registry entries with its full site listing. On failure,
 * or an empty listing, the existing entries are kept so a temporary outage loses nothing.
 */
export async function refreshProviderListing(env: Env, gaugeRegistry: Record<string, GaugeSite>, provider: GaugeProvider): Promise<void> {
    if (!provider.getFullSiteListing) {
        console.log(`- Provider ${provider.id} does not support full site listing.`);
        return;
    }
    const prefix = `${provider.id}:`;
    try {
        const newSites = await provider.getFullSiteListing(env);
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
