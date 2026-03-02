import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { River } from '../models/River';
import { Gauge, GaugeInfo } from '../models/Gauge';

const RIVER_DATA_URL = 'https://rivers.run/riverdata.json';
const FLOW_DATA_URL = 'https://rivers.run/flowdata3.json';

const CACHE_KEY_RIVER = 'river_data';
const CACHE_KEY_FLOW = 'flow_data';
const CACHE_KEY_TIMESTAMP = 'data_timestamp';

export class DataService {
    static async getRivers(forceRefresh = false): Promise<River[]> {
        let riverData: any[] = [];
        let flowData: Record<string, GaugeInfo> = {};

        // Try loading from cache first
        if (!forceRefresh) {
            try {
                const cachedRiver = await AsyncStorage.getItem(CACHE_KEY_RIVER);
                const cachedFlow = await AsyncStorage.getItem(CACHE_KEY_FLOW);

                if (cachedRiver && cachedFlow) {
                    riverData = JSON.parse(cachedRiver);
                    flowData = JSON.parse(cachedFlow);
                }
            } catch (e) {
                console.error("Error reading cache", e);
            }
        }

        // If no data or refresh requested, fetch from network
        if (riverData.length === 0 || forceRefresh) {
            try {
                const [riverResponse, flowResponse] = await Promise.all([
                    axios.get(RIVER_DATA_URL),
                    axios.get(FLOW_DATA_URL)
                ]);

                riverData = riverResponse.data;
                flowData = flowResponse.data;

                // Cache the data
                // Note: AsyncStorage has a 6MB limit on Android by default.
                // riverdata.json is small, but flowdata3.json can be large (25MB mentioned).
                // We might need to handle this.
                // However, user mentioned "around 25MB" data limits.
                // Storing 25MB in AsyncStorage might fail on Android without configuration.
                // We'll try. If it fails, we catch the error.

                try {
                    await AsyncStorage.setItem(CACHE_KEY_RIVER, JSON.stringify(riverData));
                    await AsyncStorage.setItem(CACHE_KEY_FLOW, JSON.stringify(flowData));
                    await AsyncStorage.setItem(CACHE_KEY_TIMESTAMP, Date.now().toString());
                } catch (cacheError) {
                    console.warn("Failed to cache data (likely too large)", cacheError);
                }

            } catch (e) {
                console.error("Error fetching data", e);
                // If fetch fails and we have no cache, return empty array or throw
                if (riverData.length === 0) {
                     // If we are offline and have no cache, we can't do anything.
                     throw e;
                }
            }
        }

        // Process data
        const gauges: Record<string, Gauge> = {};
        // flowData keys are gaugeIDs
        for (const gaugeID in flowData) {
            gauges[gaugeID] = new Gauge(gaugeID, flowData[gaugeID]);
        }

        const rivers = riverData.map(data => {
            const river = new River(data);
            const gauge = gauges[river.gauge];
            if (gauge) {
                river.updateFlow(gauge);
            }
            return river;
        });

        return rivers;
    }
}
