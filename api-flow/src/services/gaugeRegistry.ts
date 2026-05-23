import { GaugeSite, GaugeProvider } from './provider';
import { usgsProvider } from './usgs';
import { ecProvider } from './canada';
import { ukProvider } from './uk';
import { irelandProvider } from './ireland';
import { nwsProvider } from './nws';
import { logToD1 } from '../utils/logger';
import type { Env } from '../index';

const providers: GaugeProvider[] = [
    usgsProvider,
    ecProvider,
    ukProvider,
    irelandProvider
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
        if (provider.getFullSiteListing) {
            try {
                // 1. Attempt to fetch new site list
                const newSites = await provider.getFullSiteListing();
                
                // 2. SUCCESS: Clear old entries for this provider and replace with new ones
                const prefix = `${provider.id}:`;
                Object.keys(gaugeRegistry).forEach(k => {
                    if (k.startsWith(prefix)) delete gaugeRegistry[k];
                });

                for (const site of newSites) {
                    const fullId = `${prefix}${site.id}`;
                    gaugeRegistry[fullId] = {
                        ...site,
                        id: fullId
                    };
                }
                await logToD1(env, "INFO", "registry", `Updated ${provider.id}: ${newSites.length} gauges found.`);
            } catch (e: any) {
                // 3. FAILURE: Log and KEEP the existing entries for this provider
                const providerPrefix = provider.id + ":";
                const existingCount = Object.keys(gaugeRegistry).filter(k => k.startsWith(providerPrefix)).length;
                await logToD1(env, "WARN", "registry", `Failed to refresh ${provider.id}. Preserving ${existingCount} existing entries. Error: ${e.message || e}`);
            }
        } else {
            console.log(`- Provider ${provider.id} does not support full site listing.`);
        }
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
                    if (typeof g.id === "string" && g.id.startsWith("NWS:")) {
                        activeNwsGauges.add(g.id.split(":")[1]);
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
