import { GaugeSite, GaugeProvider } from './provider';
import { usgsProvider } from './usgs';
import { canadaProvider } from './canada';
import { nwsProvider } from './nws';
import { ukProvider } from './uk';
import { irelandProvider } from './ireland';
import { franceProvider } from './france';

const providers: GaugeProvider[] = [
    usgsProvider,
    canadaProvider,
    nwsProvider,
    ukProvider,
    irelandProvider,
    franceProvider
];

/**
 * Resiliently compiles the full gauge registry.
 * If a provider fails, it will preserve the existing entries for that provider 
 * from the historical registry, preventing data loss during temporary API outages.
 */
export async function compileGaugeRegistry(existingRegistry: Record<string, GaugeSite> = {}): Promise<Record<string, GaugeSite>> {
    const gaugeRegistry: Record<string, GaugeSite> = { ...existingRegistry };
    
    console.log("Registry: Starting resilient compilation across all providers...");

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
                console.log(`- Updated ${provider.id}: ${newSites.length} gauges.`);
            } catch (e) {
                // 3. FAILURE: Log and KEEP the existing entries for this provider
                const providerPrefix = provider.id + ":";
                const existingCount = Object.keys(gaugeRegistry).filter(k => k.startsWith(providerPrefix)).length;
                console.error(`- CRITICAL: Failed to refresh ${provider.id}. Preserving ${existingCount} existing entries. Error:`, e);
            }
        } else {
            console.log(`- Provider ${provider.id} does not support full site listing.`);
        }
    }

    return gaugeRegistry;
}
