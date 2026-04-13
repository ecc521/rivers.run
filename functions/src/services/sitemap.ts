import { Bucket } from "@google-cloud/storage";

const SITE_URL = 'https://rivers.run';

function slugify(text: string): string {
    if (!text) return '';
    const cleaned = text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '');
    return cleaned.split('-').filter(Boolean).join('-');
}

export async function generateSitemapToStorage(rivers: any[], bucket: Bucket): Promise<void> {
    console.log("Generating sitemap.xml to Firebase Storage...");
    const date = new Date().toISOString().split('T')[0];

    // Static routes
    const routes = [
        '',
        '/map',
        '/favorites',
        '/clubs',
        '/lists',
        '/faq',
        '/about',
        '/settings',
        '/terms',
        '/privacy',
        '/disclaimer'
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Add static routes
    routes.forEach(route => {
        let priority = '0.8';
        if (route === '' || route === '/map') priority = '1.0';
        
        xml += `  <url>\n    <loc>${SITE_URL}${route}</loc>\n    <lastmod>${date}</lastmod>\n    <priority>${priority}</priority>\n  </url>\n`;
    });

    // Add individual river routes
    rivers.forEach(river => {
        if (river.name && river.id) {
            let slug = slugify(river.name);
            if (river.section) {
                slug += '-' + slugify(river.section);
            }
            
            const priority = river.isGauge ? '0.4' : '0.7';
            let lastModStr = '';
            
            if (river.updatedAt && river.updatedAt._seconds) {
                const modDate = new Date(river.updatedAt._seconds * 1000);
                lastModStr = `\n    <lastmod>${modDate.toISOString().split('T')[0]}</lastmod>`;
            }

            xml += `  <url>\n    <loc>${SITE_URL}/river/${river.id}/${slug}</loc>${lastModStr}\n    <priority>${priority}</priority>\n  </url>\n`;
        }
    });

    xml += `</urlset>`;

    // Save to Google Cloud Storage
    const file = bucket.file("public/sitemap.xml");
    await file.save(xml, {
        metadata: {
            contentType: "application/xml",
            cacheControl: "public, max-age=86400, s-maxage=86400"
        }
    });

    try {
        await file.makePublic();
    } catch {
        console.warn("Non-fatal IAM validation. Exiting specifically for sitemap.xml.");
    }

    console.log(`Successfully generated and uploaded sitemap.xml with ${routes.length + rivers.length} entries.`);
}
