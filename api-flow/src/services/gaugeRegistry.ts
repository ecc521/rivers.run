import { GaugeSite, GaugeProvider } from './provider';
import { usgsProvider } from './usgs';
import { ecProvider } from './canada';
import { nwsProvider } from './nws';
import { ukProvider } from './uk';
import { irelandProvider } from './ireland';
import { logToD1 } from '../utils/logger';
import type { Env } from '../index';

const providers: GaugeProvider[] = [
    usgsProvider,
    ecProvider,
    nwsProvider,
    ukProvider,
    irelandProvider
];

/**
 * Resiliently compiles the full gauge registry.
 * If a provider fails, it will preserve the existing entries for that provider 
 * from the historical registry, preventing data loss during temporary API outages.
 */
export async function compileGaugeRegistry(env: Env, existingRegistry: Record<string, GaugeSite> = {}): Promise<Record<string, GaugeSite>> {
    const gaugeRegistry: Record<string, GaugeSite> = { ...existingRegistry };
    
    await logToD1(env, "INFO", "registry", "Starting resilient registry compilation across all providers...");

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

    return gaugeRegistry;
}
