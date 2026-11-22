# Security Policy

## Reporting a Vulnerability

For reports, email support@rivers.run

## Accepted Risks

These are known and accepted. They come from a November 2026 audit of `api/` and
`api-flow/`. Please don't report them unless you find a way to make them worse
than described here.

- **Suggestion drafts can be read by ID.** `GET /my-submissions/{id}` uses
  sequential IDs so the "restore your suggestion" email link works without an
  account. It returns only the proposed river data, never the submitter's UID,
  IP or email, and that data is meant to become public anyway.
- **Email addresses are not verified at signup.** Someone could sign up with
  another person's address and turn on the daily digest. Every digest has a
  one-click unsubscribe, and all user text in emails is HTML-escaped.
- **Apple Watch sync codes are short.** Codes are 5 digits and live for 15
  minutes, so they can be guessed by trying them all. A hit only reveals a list
  ID, and only while someone has a code open.
- **Anonymous suggestions and reports are not rate limited.** We will add limits
  if they are abused.
- **API keys are for attribution, not access control.** Requests from rivers.run,
  the apps and localhost skip the key check, and those headers can be faked
  outside a browser. The data served is public.
- **Some error responses include internal error text.** The source is public, so
  this reveals nothing new.
- **The 100KB request limit trusts `Content-Length`.** A chunked body can skip
  it, but every field still has a length limit in the request schemas.
