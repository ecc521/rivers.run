import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import type { AdvancedSearchQuery } from "../utils/SearchFilters";
import { getShareBaseUrl } from "../utils/url";


interface ShareMapModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentQuery: AdvancedSearchQuery;
    mapCenter: [number, number];
    mapZoom: number;
}

interface ShareUrlParams {
    baseUrl: string;
    linkType: "map" | "list";
    shareMapState: boolean;
    shareFilters: boolean;
    pinCoordinates: boolean;
    currentQuery: AdvancedSearchQuery;
    mapCenter: [number, number];
    mapZoom: number;
}

function buildShareUrl(params: ShareUrlParams): string {
    const url = new URL(params.baseUrl);
    
    if (params.shareMapState && params.linkType === "map") {
        url.searchParams.set("lat", params.mapCenter[0].toFixed(5));
        url.searchParams.set("lng", params.mapCenter[1].toFixed(5));
        url.searchParams.set("zoom", params.mapZoom.toString());
    }

    if (params.shareFilters) {
        if (params.currentQuery.name) url.searchParams.set("name", params.currentQuery.name);
        if (params.currentQuery.section) url.searchParams.set("section", params.currentQuery.section);
        if (params.currentQuery.distanceMax) {
            url.searchParams.set("distanceMax", params.currentQuery.distanceMax.toString());
            
            let modeToShare = params.currentQuery.mapRadiusMode || "current";
            let latToShare = params.currentQuery.userLat;
            let lonToShare = params.currentQuery.userLon;

            if (params.pinCoordinates) {
                if (modeToShare === "current") {
                    modeToShare = "custom";
                } else if (modeToShare === "center") {
                    if (params.linkType === "list" || !params.shareMapState) {
                        modeToShare = "custom";
                        latToShare = params.mapCenter[0];
                        lonToShare = params.mapCenter[1];
                    }
                }
            } else {
                if (modeToShare === "current") {
                    latToShare = undefined;
                    lonToShare = undefined;
                } else if (modeToShare === "center") {
                    if (params.linkType === "list") {
                        modeToShare = "current"; 
                        latToShare = undefined;
                        lonToShare = undefined;
                    } else {
                        latToShare = undefined;
                        lonToShare = undefined;
                    }
                }
            }

            url.searchParams.set("radiusMode", modeToShare);
            if (latToShare !== undefined) url.searchParams.set("userLat", typeof latToShare === "number" ? latToShare.toFixed(5) : latToShare);
            if (lonToShare !== undefined) url.searchParams.set("userLon", typeof lonToShare === "number" ? lonToShare.toFixed(5) : lonToShare);
        }
        if (params.currentQuery.favoritesOnly) url.searchParams.set("favoritesOnly", "true");
        
        // Only add skill/flow if not default
        if (params.currentQuery.skillMin !== 1) url.searchParams.set("skillMin", params.currentQuery.skillMin!.toString());
        if (params.currentQuery.skillMax !== 8) url.searchParams.set("skillMax", params.currentQuery.skillMax!.toString());
        if (params.currentQuery.flowMin !== 0) url.searchParams.set("flowMin", params.currentQuery.flowMin!.toString());
        if (params.currentQuery.flowMax !== 4) url.searchParams.set("flowMax", params.currentQuery.flowMax!.toString());
    }

    return url.toString();
}

export const ShareMapModal: React.FC<ShareMapModalProps> = ({
    isOpen,
    onClose,
    currentQuery,
    mapCenter,
    mapZoom
}) => {
    const [shareFilters, setShareFilters] = useState(true);
    const [shareMapState, setShareMapState] = useState(true);
    const [linkType, setLinkType] = useState<"map" | "list">("map");
    const [pinCoordinates, setPinCoordinates] = useState(true);
    const [generatedUrl, setGeneratedUrl] = useState("");
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setCopied(false);
            return;
        }

        const baseUrl = linkType === "map" 
            ? getShareBaseUrl(window.location.pathname)
            : getShareBaseUrl("/");

            
        const newUrl = buildShareUrl({
            baseUrl, linkType, shareMapState, shareFilters,
            pinCoordinates, currentQuery, mapCenter, mapZoom
        });

        setGeneratedUrl(newUrl);
    }, [isOpen, shareFilters, shareMapState, currentQuery, mapCenter, mapZoom, linkType, pinCoordinates]);

    if (!isOpen) return null;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(generatedUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy", err);
        }
    };

    return ReactDOM.createPortal(
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(15, 23, 42, 0.75)",
                backdropFilter: "blur(8px)",
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px",
                animation: "fadeIn 0.2s ease-out",
            }}
            onClick={onClose}
        >
            <div
                style={{
                    width: "100%",
                    maxWidth: "500px",
                    backgroundColor: "var(--surface)",
                    borderRadius: "16px",
                    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
                    display: "flex",
                    flexDirection: "column",
                    position: "relative",
                    padding: "24px",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <h2 style={{ margin: 0, color: "var(--text)" }}>Share Map View</h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: "none",
                            border: "none",
                            fontSize: "24px",
                            cursor: "pointer",
                            color: "var(--text-muted)",
                        }}
                    >
                        ✕
                    </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "15px", marginBottom: "20px" }}>
                    <div style={{ display: "flex", gap: "20px" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--text)", cursor: "pointer" }}>
                            <input 
                                type="radio" 
                                name="linkType"
                                checked={linkType === "map"} 
                                onChange={() => setLinkType("map")} 
                                style={{ width: "16px", height: "16px", cursor: "pointer" }}
                            />
                            Link to Map View
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--text)", cursor: "pointer" }}>
                            <input 
                                type="radio" 
                                name="linkType"
                                checked={linkType === "list"} 
                                onChange={() => setLinkType("list")} 
                                style={{ width: "16px", height: "16px", cursor: "pointer" }}
                            />
                            Link to List View
                        </label>
                    </div>

                    {linkType === "map" && (
                        <div style={{ display: "flex", flexDirection: "column" }}>
                            <label style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text)", cursor: "pointer" }}>
                                <input 
                                    type="checkbox" 
                                    checked={shareMapState} 
                                    onChange={(e) => setShareMapState(e.target.checked)} 
                                    style={{ width: "20px", height: "20px", cursor: "pointer" }}
                                />
                                Share Map Zoom & Focus Location
                            </label>
                            <span style={{ fontSize: "0.8em", color: "var(--text-muted)", marginLeft: "30px", marginTop: "2px" }}>
                                Preserves the exact view of the map you're looking at right now so the recipient sees the same area.
                            </span>
                        </div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text)", cursor: "pointer" }}>
                            <input 
                                type="checkbox" 
                                checked={shareFilters} 
                                onChange={(e) => setShareFilters(e.target.checked)} 
                                style={{ width: "20px", height: "20px", cursor: "pointer" }}
                            />
                            Share Filters & Advanced Search Radius
                        </label>
                        <span style={{ fontSize: "0.8em", color: "var(--text-muted)", marginLeft: "30px", marginTop: "2px" }}>
                            Includes your current search filters (Class, Flow, Name, Distance Radius, etc) in the generated link.
                        </span>
                    </div>

                    {shareFilters && currentQuery.distanceMax !== undefined && (
                        <div style={{ display: "flex", flexDirection: "column", marginLeft: "24px" }}>
                            <label style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text)", cursor: "pointer", fontSize: "0.9em" }}>
                                <input 
                                    type="checkbox" 
                                    checked={pinCoordinates} 
                                    onChange={(e) => setPinCoordinates(e.target.checked)} 
                                    style={{ width: "20px", height: "20px", cursor: "pointer" }}
                                />
                                Lock Radius Coordinates
                            </label>
                            <span style={{ fontSize: "0.8em", color: "var(--text-muted)", marginLeft: "30px", marginTop: "2px" }}>
                                If checked, the link will pin your exact coordinates for the radius origin. If unchecked, the radius will dynamically evaluate from the recipient's device location.
                            </span>
                        </div>
                    )}
                </div>

                <div style={{ display: "flex",flexDirection: "column", gap: "10px" }}>
                    <label style={{ fontSize: "0.85em", fontWeight: "bold", color: "var(--text-secondary)", textTransform: "uppercase" }}>Generated Link</label>
                    <div style={{ display: "flex", gap: "10px" }}>
                        <input 
                            type="text" 
                            disabled 
                            value={generatedUrl} 
                            style={{
                                flex: 1,
                                padding: "10px",
                                borderRadius: "8px",
                                border: "1px solid var(--border)",
                                backgroundColor: "var(--surface-hover)",
                                color: "var(--text)",
                                fontSize: "0.9em"
                            }}
                        />
                        <button 
                            onClick={handleCopy}
                            style={{
                                padding: "10px 16px",
                                borderRadius: "8px",
                                border: "none",
                                backgroundColor: copied ? "var(--success, #10b981)" : "var(--primary)",
                                color: "white",
                                fontWeight: "bold",
                                cursor: "pointer",
                                transition: "all 0.2s"
                            }}
                        >
                            {copied ? "Copied!" : "Copy"}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
