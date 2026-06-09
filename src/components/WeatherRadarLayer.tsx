import { useEffect, useMemo, useState } from "react";
import { Source, Layer } from "react-map-gl/maplibre";

const baseUrl = "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0";

export const WeatherRadarLayer: React.FC<{ mode: "off" | "live" | "60min" }> = ({ mode }) => {
    const [activeIndex, setActiveIndex] = useState<number>(0);

    const frames = useMemo(() => {
        if (mode === "off") return [];
        if (mode === "live") {
            return [`${baseUrl}/nexrad-n0q-900913/{z}/{x}/{y}.png`];
        }
        const offsets = ["-m50m", "-m45m", "-m40m", "-m35m", "-m30m", "-m25m", "-m20m", "-m15m", "-m10m", "-m05m", ""];
        return offsets.map(offset => `${baseUrl}/nexrad-n0q-900913${offset}/{z}/{x}/{y}.png`);
    }, [mode]);

    useEffect(() => {
        setActiveIndex(0);

        if (mode !== "60min" || frames.length === 0) return;

        const animationInterval = setInterval(() => {
            setActiveIndex(prev => (prev + 1) % frames.length);
        }, 750);

        return () => {
            clearInterval(animationInterval);
        };
    }, [mode, frames.length]);

    if (mode === "off" || frames.length === 0) return null;

    return (
        <>
            {frames.map((url, i) => (
                <Source key={`${mode}-${url}`} id={`radar-${mode}-${i}`} type="raster" tiles={[url]} tileSize={256} maxzoom={8}>
                    <Layer 
                        id={`radar-layer-${mode}-${i}`} 
                        type="raster" 
                        paint={{ "raster-opacity": i === activeIndex ? 0.5 : 0 }} 
                    />
                </Source>
            ))}
        </>
    );
};
