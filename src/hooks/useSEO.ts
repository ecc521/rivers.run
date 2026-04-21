import { useEffect } from "react";

export function useSEO({ title, description, canonical }: { title?: string; description?: string; canonical?: string }) {
  useEffect(() => {
    // 1. Update Title
    if (title) {
       document.title = `${title} | Rivers.run`;
    }

    // 2. Update Meta Description & Social Equivalents
    if (description) {
       const selectors = [
           'meta[name="description"]',
           'meta[property="og:description"]',
           'meta[name="twitter:description"]'
       ];
       selectors.forEach(selector => {
           let el = document.querySelector(selector);
           if (!el) {
               el = document.createElement("meta");
               if (selector.includes("property")) {
                   el.setAttribute("property", selector.split('"')[1]);
               } else {
                   el.setAttribute("name", selector.split('"')[1]);
               }
               document.head.appendChild(el);
           }
           el.setAttribute("content", description);
       });
    }

    // 3. Update Canonical Tag
    if (canonical) {
        let canonicalEl = document.querySelector('link[rel="canonical"]');
        if (!canonicalEl) {
            canonicalEl = document.createElement("link");
            canonicalEl.setAttribute("rel", "canonical");
            document.head.appendChild(canonicalEl);
        }
        canonicalEl.setAttribute("href", canonical);
    }
    
    // Clean up on unmount
    return () => {
       if (title) document.title = "Rivers.run - Whitewater Gauge Maps & Flow Data";
    };
  }, [title, description, canonical]);
}
