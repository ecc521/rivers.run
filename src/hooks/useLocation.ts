import { useState, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import type { PositionOptions } from '@capacitor/geolocation';

export interface LocationState {
    latitude: number | null;
    longitude: number | null;
    loading: boolean;
    error: string | null;
}

export function useLocation() {
    const [state, setState] = useState<LocationState>({
        latitude: null,
        longitude: null,
        loading: false,
        error: null,
    });

    const requestLocation = useCallback(async (optionsContext?: { enableHighAccuracy?: boolean }) => {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        
        try {
            // Under Capacitor, this will request permissions natively and accurately 
            // map down through the WebView to the iOS/Android hardware GPS API. 
            // It automatically degrades cleanly into HTML5 navigator.geolocation on a browser!
            const options: PositionOptions = {
                enableHighAccuracy: optionsContext?.enableHighAccuracy ?? true,
                timeout: 10000,
                maximumAge: 3000
            };
            
            // Explicitly check/request permissions internally via the plugin for native platforms
            try {
                const permission = await Geolocation.checkPermissions();
                if (permission.location !== 'granted') {
                    const request = await Geolocation.requestPermissions({ permissions: ['location'] });
                    if (request.location !== 'granted') {
                        throw new Error("Location permission denied.");
                    }
                }
            } catch (permError: any) {
                // Web browsers handle location permissions automatically via the DOM Geolocation API prompt.
                // Capacitor throws "Not implemented on web." for the explicit permission request methods.
                // We can safely ignore this error and fall through to getCurrentPosition.
                if (permError.message !== 'Not implemented on web.') {
                    throw permError;
                }
            }

            const position = await Geolocation.getCurrentPosition(options);
            
            setState({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                loading: false,
                error: null,
            });
            
            return {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            };
        } catch (err: any) {
            console.error("Geolocation Error:", err);
            setState((prev) => ({
                ...prev,
                loading: false,
                error: err.message || "Failed to retrieve location",
            }));
            return null;
        }
    }, []);

    return { ...state, requestLocation };
}
