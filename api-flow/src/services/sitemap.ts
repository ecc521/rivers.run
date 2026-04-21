import type { Env } from "../index";
import { logToD1 } from "../utils/logger";

function slugify(text: string) {
  if (!text) return '';
  const cleaned = text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '');
  return cleaned.split('-').filter(Boolean).join('-');
}

export async function generateSitemap(env: Env, registryMetadata: Record<string, any>) {
    console.log("Generating Sitemap with streams...");
    try {
        const SITE_URL = 'https://rivers.run';
        const date = new Date().toISOString().split('T')[0];

        // 1. Fetch D1 data
        const [riverNamesRaw, listsRaw] = await env.DB.batch([
            env.DB.prepare("SELECT id, name, section, isGauge FROM rivers"),
            env.DB.prepare("SELECT id, title FROM community_lists WHERE is_published = 1")
        ]);

        const curatedRivers = (riverNamesRaw.results as any[]) || [];
        const curatedRiverIdsSet = new Set(curatedRivers.map(r => r.id));
        const lists = (listsRaw.results as any[]) || [];

        // 2. Stream XML to R2
        const { readable, writable } = new (globalThis as any).TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();

        // Coordinate the streaming writer and the R2 put
        const streamErrorPromise = (async () => {
            try {
                await writer.write(encoder.encode(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`));

                // Static Routes
                const staticRoutes = ['', '/map', '/lists', '/clubs', '/favorites', '/faq', '/settings', '/terms', '/privacy', '/disclaimer'];
                for (const route of staticRoutes) {
                    const p = (route === '' || route === '/map') ? '1.0' : '0.8';
                    await writer.write(encoder.encode(`  <url>\n    <loc>${SITE_URL}${route}</loc>\n    <lastmod>${date}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${p}</priority>\n  </url>\n`));
                }

                // Curated Rivers (Priority 0.7)
                for (const river of curatedRivers) {
                    let slug = slugify(river.name);
                    if (river.section) slug += '-' + slugify(river.section);
                    const prefix = river.isGauge ? '/gauge' : '/river';
                    await writer.write(encoder.encode(`  <url>\n    <loc>${SITE_URL}${prefix}/${river.id}/${slug}</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.7</priority>\n  </url>\n`));
                }

                // Standalone Gauges (Priority 0.4)
                for (const [fullId, meta] of Object.entries(registryMetadata)) {
                    if (curatedRiverIdsSet.has(fullId)) continue; 
                    const slug = slugify(meta.name || fullId);
                    await writer.write(encoder.encode(`  <url>\n    <loc>${SITE_URL}/gauge/${fullId}/${slug}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.4</priority>\n  </url>\n`));
                }

                // Public Lists (Priority 0.5)
                for (const list of lists) {
                    const slug = slugify(list.title);
                    await writer.write(encoder.encode(`  <url>\n    <loc>${SITE_URL}/lists/${list.id}/${slug}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.5</priority>\n  </url>\n`));
                }

                await writer.write(encoder.encode(`</urlset>`));
                return null;
            } catch (err) {
                console.error("Sitemap stream writer error:", err);
                return err;
            } finally {
                await writer.close();
            }
        })();

        // Start the R2 put
        await env.FLOW_STORAGE.put("sitemap.xml", readable as any, {
            httpMetadata: { contentType: "application/xml" }
        });
        
        // Wait for the stream source to finish and check for errors
        const streamError = await streamErrorPromise;
        if (streamError) {
            throw streamError;
        }

        await logToD1(env, "INFO", "maintenance", "Sitemap streaming generation successful.");
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await logToD1(env, "ERROR", "maintenance", `Sitemap generation failed: ${msg}`, e);
        console.error("Sitemap generation failed:", e);
    }
}
