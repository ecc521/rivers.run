import { useEffect, useState } from "react";
import { Source, Layer } from "react-map-gl/maplibre";

export const WeatherRadarLayer: React.FC<{ mode: "off" | "live" | "60min" }> = ({ mode }) => {
    const [frames, setFrames] = useState<string[]>([]);
    const [activeIndex, setActiveIndex] = useState<number>(0);

    useEffect(() => {
        if (mode === "off") {
            setFrames([]);
            return;
        }

        let animationInterval: any = null;
        const baseUrl = "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0";
        
        if (mode === "live") {
            setFrames([`${baseUrl}/nexrad-n0q-900913/{z}/{x}/{y}.png`]);
            setActiveIndex(0);
        } else if (mode === "60min") {
            const offsets = ["-m50m", "-m45m", "-m40m", "-m35m", "-m30m", "-m25m", "-m20m", "-m15m", "-m10m", "-m05m", ""];
            const paths = offsets.map(offset => `${baseUrl}/nexrad-n0q-900913${offset}/{z}/{x}/{y}.png`);
            
            setFrames(paths);
            setActiveIndex(0);
             
            animationInterval = setInterval(() => {
                setActiveIndex(prev => (prev + 1) % paths.length);
            }, 750);
        }
        
        return () => { 
            if (animationInterval) clearInterval(animationInterval); 
        };
    }, [mode]);

    if (mode === "off" || frames.length === 0) return null;

    return (
        <>
            {frames.map((url, i) => (
                <Source key={url} id={`radar-${i}`} type="raster" tiles={[url]} tileSize={256} maxzoom={8}>
                    <Layer 
                        id={`radar-layer-${i}`} 
                        type="raster" 
                        paint={{ "raster-opacity": i === activeIndex ? 0.5 : 0 }} 
                    />
                </Source>
            ))}
        </>
    );
};
