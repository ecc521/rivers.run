# Core Architecture Guidelines (api-core)

This worker serves as the absolute "backend" boundary for the Rivers.run application, structurally wired to Cloudflare D1 (SQLite) and Firebase Auth Web Crypto.

## 1. Authentication
*   **Never trust client auth payloads**: All protected requests require a standard `Authorization: Bearer <Firebase_ID_Token>`.
*   These are validated purely offline-edge via Google's `securetoken` JWK structures mapped inside `src/auth.ts`. There is no heavy `firebase-admin` running!
*   Always check the `user` context explicitly parsed from Hono (e.g. `c.get("user")`). Roles (`admin`, `moderator`) are physically baked into the JWT logic claims!

## 2. D1 SQL Database & Rate Limiting
*   SQLite rows are incredibly performant but strictly constrained.
*   **CRITICAL:** Every mutation API explicitly limits string sizes manually in `src/schema.ts` (e.g., maximum 25,000 characters for writeups, 50kB hard threshold for all payloads). Do **not** bypass these limits.
*   For reading arrays from D1 (e.g. the standard `tags` or `gauges` TEXT blocks), you must parse them natively out of JSON strings within the REST response logic (e.g. `JSON.parse(result.tags)`).

## 3. Swagger / OpenAPI Structuring
This project uses native Zod payloads. If tasked with building new `PUT/POST` hooks, append them structurally to `schema.ts`. Our ultimate goal is to hook `@hono/zod-openapi` onto this endpoint repository, turning these types directly into an auto-generated JSON spec served to humans at `api.rivers.run/docs`.
