# api (rivers-run-api)

This Cloudflare Worker is the backend boundary for Rivers.run, wired to Cloudflare D1
(SQLite) and Firebase Auth verified via Web Crypto. Built on Hono (`OpenAPIHono`).
Entry point: `src/index.ts`. Deployed to `api.rivers.run`.

## 1. Authentication & Authorization

- **Never trust client auth payloads.** Protected requests require a standard
  `Authorization: Bearer <Firebase_ID_Token>`.
- Tokens are verified entirely offline at the edge against Google's `securetoken` JWKs
  (`https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system...`) in
  `src/auth.ts`. There is no `firebase-admin`. The JWK set is cached.
- Read the authenticated user from Hono context: `c.get("user")`.
- **Roles are NOT in the JWT.** The JWT only establishes identity (`uid`). The role is
  looked up from the D1 `users` table (`SELECT role FROM users WHERE user_id = ?`) and
  exposed as `d1Role`. Valid roles: `user`, `moderator`, `admin`, `super-admin`,
  `banned` (see `UserRoleSchema` in `src/schema.ts`). Use the gatekeeper middleware in
  `src/auth.ts` (admin/moderator checks) rather than re-deriving roles.

## 2. D1 SQL Database & Payload Limits

- SQLite rows are performant but constrained. Mutation payloads enforce explicit string
  limits via Zod schemas in `src/schema.ts` (e.g. `writeup` max 25,000 chars; list
  titles 100; descriptions 5,000). Do **not** bypass these limits.
- A hard request-size ceiling of **100KB** is enforced by `checkPayloadSize` middleware
  (returns HTTP 413). Keep this in mind when adding large-body endpoints.
- Array-valued columns (`tags`, `gauges`) are stored as JSON TEXT in D1. Parse them out
  when reading (`JSON.parse(row.tags)`) and serialize when writing.

## 3. OpenAPI / Swagger

- This worker uses `@hono/zod-openapi`: routes are defined with `createRoute` + Zod
  schemas carrying `.openapi(...)` metadata. New `PUT`/`POST` endpoints should define
  their payload schema in `src/schema.ts` and register the route with `app.openapi(...)`.
- The generated spec is served at `/openapi.json`, with a human-facing Scalar reference
  UI at `/docs` (i.e. `api.rivers.run/docs`), configured near the bottom of
  `src/index.ts`. Keep new endpoints documented so the spec stays complete.

## Commands

Lint and test from the repository root (`npm run lint`, `npm test`). Within this
workspace: `npm run dev` (wrangler dev, port 8788), `npm run deploy`.
