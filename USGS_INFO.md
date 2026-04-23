# USGS API Integration & Deprecation Information

This document explains the current state of USGS API endpoints as of our most recent integration updates, the reasons behind our strategic choices, and a roadmap for future-proofing.

## Why the Old Code Failed

The original `rivers.run` script was fetching the USGS gauges list using the legacy NWIS GUI Inventory endpoint:
`https://waterdata.usgs.gov/nwis/inventory?data_type=rt&data_type=peak&group_key=NONE&format=sitefile_output&sitefile_output_format=rdb_gz...`

This endpoint suddenly stopped working because **USGS completely retired the NWIS Web GUI**. That URL now returns a `301 Moved Permanently` and redirects directly to a USGS blog post announcing the retirement of the centralized water data UI. This broke the automated gzip download.

## Why We Reverted Back to Legacy Data Services (for now)

The USGS is officially replacing all legacy services with their modernized **OGC API - Features** (`api.waterdata.usgs.gov`), which provides robust JSON schemas and better performance.

We *attempted* to migrate to this new OGC API. However, we found a critical parity gap in their filtering capabilities:
1. **The Problem:** The old endpoint allowed us to filter stations by `hasDataTypeCd=iv` and `parameterCd=00060` (which gave us a highly targeted list of ~4,700 active stations after filtering for relevance). The original legacy script incorrectly attempted to use `data_type=rt`, which is now deprecated and unreliable.
2. **The OGC Flaw:** The modern OGC API `monitoring-locations` collection considers a "location" to be static metadata. It intentionally does not provide a query parameter like `active=true` or `hasRealtimeData=true` because active sensors are considered transient. Filtering purely by `site_type_code=ST` (Stream) without an active flag forces the API to return **hundreds of thousands** of historical or decommissioned stream sensors.

### The "Future-Proof" Workaround (If we used OGC API today)
If we were forced to implement the "active" filter strictly using the new OGC API today, the workflow would be incredibly heavy:
1. We would have to query the USGS `observations/latest-continuous` collection which holds the live water measurements for the entire country.
2. We would download metadata for millions of observation points.
3. We would run a distinct/deduplication process locally to extract only the unique `monitoring-location-id` values from sensors that had pushed a reading in the last 24-48 hours.
4. We would then batch-query the `monitoring-locations` API to get the names and coordinates for those ~4.7k unique IDs.

## Our Pragmatic Approach
Due to immense developer pushback regarding this specific limitation, USGS extended the final deprecation timeline for the legacy `waterservices` REST API (which does natively support active status filtering) into **2027**. 

Therefore, we have refactored our `siteDataParser.js` script to hit the still-active legacy data endpoint instead:
`https://waterservices.usgs.gov/nwis/site/?format=rdb&siteStatus=active&siteType=ST&hasDataTypeCd=iv`

### The Current Implementation
Because `waterservices.usgs.gov` restricts wide-scale geographic queries (returning HTTP 400 if you query the entire bounding box of the US at once), the new `siteDataParser` code efficiently chunks the 50 US states into smaller batches, downloads them concurrently, and seamlessly compiles the resulting `usgsSites.txt` file for the rivers map.

### Action Items for 2026/2027
Before the final API shutdown, we should routinely check the USGS OGC API documentation to see if they introduce a dedicated `active-locations` subset or reinstate filtering capabilities. If they do not, we will need to implement the heavy `latest-continuous` workaround described above.
