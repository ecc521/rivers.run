import { useEffect } from "react";

export function useSEO({ title, description }: { title?: string; description?: string }) {
  useEffect(() => {
    // 1. Update Title
    if (title) {
       document.title = `${title} | Rivers.run`;
    }

    // 2. Update Meta Description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (description) {
       if (!metaDescription) {
           metaDescription = document.createElement("meta");
           metaDescription.setAttribute("name", "description");
           document.head.appendChild(metaDescription);
       }
       metaDescription.setAttribute("content", description);
    }
    
    // Clean up title on unmount - this ensures if we go back to root without a hook, it resets
    // But since Home doesn't have a specific title hook right now, we can leave it or restore
    return () => {
       if (title) document.title = "Rivers.run";
    };
  }, [title, description]);
}
