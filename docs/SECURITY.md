# Security

This document records the security decisions and where each one is enforced and tested. Test references point to `tests/`.

## Threat model (short)

The assets are customer personal data (names, phones, addresses), the order flow, stock and prices, and the owners' dashboard. The adversaries are spam bots, curious or malicious customers tampering with requests, credential-guessing attackers, and malicious uploads. Out of scope: compromise of the owners' own devices, and of AWS itself.

## Authentication

| Control | Implementation | Tested |
| --- | --- | --- |
| No public registration | Accounts created only by CLI with AWS access (`scripts/create-admin.ts`) | — |
| Password policy | ≥ 12 characters, not one repeated character, not on a weak list, not all digits (NIST 800-63B style) | `unit/validation` |
| Hashing | **Argon2id**, m=19 MiB, t=2, p=1 (OWASP); constant-time dummy verify for unknown users | `integration/auth` |
| Sessions | 256-bit random token in an `HttpOnly`, `SameSite=Strict` cookie (`Secure` and the `__Host-` prefix in production). Only the **SHA-256 of the token** is stored server-side | `integration/auth`, `e2e/security` |
| Expiry | 2 h idle and 12 h absolute; checked on every request; account re-checked each request (disabled users are cut off immediately) | `integration/auth` |
| Logout | Deletes the server-side session; replaying the old cookie returns 401 | `e2e/security` |
| Password change | Signs out all other devices | `integration/auth` |
| Brute force | 5 failed attempts per account per 15 min (lock), 20 attempts per IP per 15 min, identical error for unknown user and wrong password | `integration/auth`, `e2e/security` |

## Authorisation

* Every admin API handler is wrapped by `adminRoute()` (`src/server/admin-route.ts`), which verifies the session **on the server for every request**. Admin pages call `requireAdminPage()`. Middleware is never relied on for access control.
* Roles: `owner` / `staff`. Settings, deletions and demo removal are owner-only. These are enforced in the API (`{ role: "owner" }`), not only hidden in the UI.
* Customers can only view **their own** confirmation page: a random token in an `HttpOnly` cookie, compared by hash in constant time. Other browsers see "this order cannot be shown" (`e2e/journey`).
* Order statuses can only be changed through the authenticated API, with optimistic concurrency (a stale screen cannot overwrite a newer change).

## Input, API and database

| Risk | Control |
| --- | --- |
| Mass assignment | All zod schemas are `.strict()`: unknown fields are rejected (`unit/validation`, `e2e/security`). System fields (`isDemo`, `status`, `version`, prices on orders) cannot be set by clients |
| Price tampering | The browser sends only product id, variant id and quantity; **all prices and totals are recomputed on the server** from strongly-consistent reads; extra fields are refused |
| Overselling / race conditions | Stock is decremented inside a DynamoDB transaction conditioned on `stock >= qty` **and** the product version used for pricing; 5 concurrent buyers for 2 items → exactly 2 orders (`integration/orders`) |
| Duplicate orders | `Idempotency-Key` header required; an idempotency record is written in the same transaction; replays return the original order; a key reused with a different body is rejected (`integration/orders`, `e2e/checkout-edge`) |
| NoSQL injection | All DynamoDB calls use expression attribute values (parameterised). Ids are regex-validated before use as keys. Pagination cursors are validated against an allow-list of key names (`unit/security-helpers`) |
| Spam | Per-IP rate limits (5 orders / 10 min), honeypot field, request size caps (32–64 KB), required JSON content type |
| Error handling | Generic error codes to clients and structured logs server-side; no stack traces (`e2e/security`) |
| CORS | No CORS headers are sent, so browsers block cross-origin reads. State-changing requests require a same-origin `Origin` / `Sec-Fetch-Site` (CSRF defence, `e2e/security`) |
| CSV export | Formula injection neutralised (`=`, `+`, `-`, `@`, tab, CR are prefixed) |

## Web security

* **Content Security Policy** with a per-request nonce and `strict-dynamic`; `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, and `upgrade-insecure-requests` in production. Zod runs in jitless mode so nothing needs `eval`. A verification run found **no CSP violations** on the main pages. `style-src` allows `'unsafe-inline'`, which Next.js needs for style attributes; styles cannot run script.
* `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera, microphone, geolocation and payment off), `Cross-Origin-Opener-Policy`, HSTS with preload in production, and `X-Powered-By` removed.
* **XSS:** React escapes output; there is no user HTML rendering. JSON-LD is serialised with `<` escaped.
* **HTTPS:** enforced by Amplify (HTTP → HTTPS redirect rule) and CloudFront (`REDIRECT_TO_HTTPS`); HSTS in production.
* The admin area sends `Cache-Control: no-store` and `X-Robots-Tag: noindex`.

## File uploads

1. Authenticated users only, with an upload rate limit.
2. Size limit of 8 MB, checked against both the header and the actual size.
3. Type detected from **magic bytes** (JPEG, PNG or WebP only); SVG, GIF, PDF, PHP etc. are rejected even when renamed.
4. Decoded by `sharp` with a 40-megapixel limit (decompression bombs) and `failOn: "error"` (corrupt files).
5. Re-encoded to WebP, which strips EXIF/GPS metadata and any appended payload; originals are never stored.
6. Object keys are **server-generated UUIDs**, validated by regex before every filesystem or S3 access, so path traversal is impossible (`unit/security-helpers`, `e2e/security`).
7. Images are served with `Content-Security-Policy: default-src 'none'; sandbox` and `nosniff`.

## AWS security

* **No AWS credentials** in code, configuration or the browser. The server uses the Amplify **compute role**: DynamoDB item operations on one table and its indexes (no Scan, no table administration), and S3 Put/Delete under `products/*` of one bucket. SES `SendEmail` is added only if configured, and only from the configured sender.
* S3: all public access blocked, owner-enforced object ownership, SSE-S3 encryption, TLS required, versioning, and read access only by CloudFront via **Origin Access Control**.
* DynamoDB: encrypted at rest, deletion protection in prod, PITR, and no network endpoint to expose.
* **Separate environments:** independent `Basman-staging` and `Basman-prod` stacks with separate tables, buckets and roles. Separate AWS accounts are recommended (see deployment).
* **Logs:** structured JSON; a logger safety net redacts personal-data and secret keys; IPs are stored only as salted hashes.

## Privacy

* Collected: name, phone, area, address, notes, and optional e-mail. Nothing else; no accounts.
* No analytics or advertising trackers. The only cookies are the language choice, the order-confirmation token and the admin session.
* Privacy policy at `/ar/privacy` and `/en/privacy`.
* **Retention:** personal data on delivered or cancelled orders older than *N* days (default 730, set in Settings) is anonymised, keeping only amounts and items. Run it with the "Apply now" button or schedule `npm run retention:run` (`integration/orders`).

## Dependency and static analysis

* `npm audit --omit=dev`: **0 vulnerabilities** in production dependencies. Next.js' bundled PostCSS was overridden to a patched version (8.5.32).
* Development-only findings: 14 moderate (app) and 2 moderate (infra), all the same `minimatch` ReDoS inside ESLint and CDK tooling. This is not shipped and not reachable at runtime; it should be re-checked on each dependency update.
* ESLint with `eslint-plugin-security`: 0 errors, 0 warnings. A real finding (invisible bidi characters in a regex) was fixed; three false positives are annotated with justifications.

## Known limitations

* Rate limits rely on the client IP from `X-Forwarded-For` behind Amplify (`TRUST_PROXY=true`, `PROXY_HOPS=1`). **Verify the hop count after the first deployment** (see the deployment checklist). The per-account login lock does not depend on it.
* No WAF by default (about $5+ per month). Add AWS WAF with a rate-based rule if bot traffic appears.
* No two-factor authentication for owners. It is a reasonable next step once the owners are comfortable with the dashboard.
