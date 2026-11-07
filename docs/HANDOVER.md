# Handover

## Test results

Tests were last run on **5 November 2026** (Lighthouse on 2 November) on macOS (Node 22.23, DynamoDB Local 3.3.2, Chromium from Playwright 1.64.1) against the final code. They are **local verification only**: nothing has been tested on AWS yet.

| Check | Command | Result |
| --- | --- | --- |
| Type-check (strict) | `npm run typecheck` | ✅ 0 errors |
| Lint (Next.js + security plugin) | `npm run lint` | ✅ 0 errors, 0 warnings |
| Unit tests | `npm run test:unit` | ✅ **105 / 105** passed |
| Integration tests (real DynamoDB engine) | `npm run test:integration` | ✅ **39 / 39** passed (repeated 3× for the concurrency tests) |
| End-to-end (production build, desktop + Pixel 7) | `npm run test:e2e` | ✅ **30 / 30** passed |
| Dependency audit, production deps | `npm audit --omit=dev` | ✅ 0 vulnerabilities |
| Dependency audit, dev tooling | `npm audit` | ⚠ 14 moderate (app) + 2 moderate (infra): `minimatch` ReDoS in ESLint/CDK tooling, not shipped |
| CDK synth (staging + prod) | `cd infra && npx cdk synth` | ✅ no warnings, valid templates |
| CSP violations on key pages | headless Chromium probe | ✅ none |

### E2E coverage

* **Full journey (16 steps):** homepage → switch to English (persists) → browse → search (Arabic query on the English site) → product details → choose size and add to cart → change quantity (survives reload) → checkout → details (delivery fee by area) → review → place COD order → confirmation with WhatsApp link (and the page is private to that browser) → owner logs in (Arabic) → finds the order by number → confirms → preparing → out for delivery → delivered → verified, final, printable, in the CSV.
* **Edge cases:** empty cart, out-of-stock product, Arabic validation errors, double-click submission (exactly one order), `Idempotency-Key` replay and mismatch, network failure after the server committed (retry → still one order), server 500 message, stock reduced since the item was added.
* **Security:** admin pages and all admin APIs without a session or with a forged cookie, CSRF (foreign origin and no origin), staff vs owner permissions, logout invalidation, cookie flags, malformed uploads (SVG, PHP renamed to `.jpg`, corrupt JPEG, wrong content type), order rate limit, login brute-force lock, client-supplied prices and extra fields, oversized and non-JSON bodies, media path traversal, security headers, no stack traces.
* **Dashboard settings:** a new password must be typed twice (a mismatch is refused before anything is sent); a turned-off delivery area shows a "temporarily paused" note at checkout, cannot be selected for an order, and is refused by the server too.
* **Mobile and RTL:** no horizontal overflow in either direction on 8 pages (Arabic and English), filter sheet on screen, logo and cart mirrored correctly, mobile menu search, mobile checkout, dashboard bottom navigation.

### Bugs found by testing and fixed

1. `total` is a DynamoDB reserved word, so **every order would have failed** in production → fixed with an expression attribute name.
2. Two simultaneous submissions with the same idempotency key could error instead of replaying → idempotency is re-checked after any transaction conflict.
3. `/shop`, `/contact` and `/privacy` were being prerendered at build time, which meant a stale catalogue and **CSP-blocked scripts** → all pages now render per request.
4. The checkout honeypot field created horizontal scroll in RTL on phones → now clipped instead of offset.
5. The mobile filter sheet opened partly off-screen in English → now a fixed sheet.
6. Product-size labels rendered as "مل 50" → bidi fix.
7. Zod's eval probe triggered a CSP violation → jitless mode.
8. Metadata was streamed into `<body>` (missing meta description for crawlers) → rendered in `<head>`.
9. 11 font files were preloaded and competed with the main image → only the body font is preloaded.
10. An IAM description containing "—" would have **failed the CloudFormation deployment** → fixed (found by template validation).

### Lighthouse (measured, mobile emulation, simulated slow 4G)

Production build served locally (`next start`); demo catalogue. Full reports: `docs/lighthouse/*.report.html`.

| Page | Performance | Accessibility | Best practices | SEO | LCP | CLS |
| --- | --- | --- | --- | --- | --- | --- |
| `/ar` (home) | 100 | 100 | 100 | 100 | 0.9 s | 0 |
| `/en` (home) | 100 | 100 | 100 | 100 | 0.9 s | 0.002 |
| `/ar/shop` | 86 | 100 | 100 | 100 | 4.2 s | 0 |
| `/en/shop` | 89 | 100 | 100 | 100 | 3.8 s | 0.002 |
| `/ar/products/oud-al-layl-demo` | 87 | 100 | 100 | 69¹ | 4.1 s | 0 |
| `/ar/contact` | 100 | 100 | 100 | 100 | 0.8 s | 0 |
| `/ar/cart` | 100 | 100 | 100 | 63¹ | 0.8 s | 0.041 |
| `/ar/checkout` | 100 | 100 | 100 | 63¹ | 0.8 s | 0.006 |

¹ Intentional `noindex`: demo products, cart and checkout must not appear in Google. Real product pages are indexable. The SEO deduction is only the "is crawlable" audit.

The 4 s LCP on listing pages is Lighthouse's *simulated* estimate for the product image on slow 4G. The observed (unthrottled) load was under 100 ms, and removing the remaining font preload did not change it. Production adds CloudFront edge caching for images, which these local numbers do not include. **Re-measure on the deployed site.**

## What still requires real infrastructure

| Item | How to verify |
| --- | --- |
| Amplify SSR build and runtime (incl. `sharp` and Argon2 native modules) | Deployment steps 5–8 |
| IAM compute role works and nothing more is allowed | Log in, upload an image, place an order on staging |
| Client IP behind Amplify for rate limiting (`PROXY_HOPS`) | Deployment step 9 |
| CloudFront image delivery, HTTPS, custom domain | Open an image URL; check redirects |
| Alarms, budget and SNS e-mails | Confirm the subscription; trigger a test |
| Backup plan and PITR restore | Yearly restore test |
| Optional SES e-mail | Verify the sender identity and leave the SES sandbox |
| Lighthouse on the real domain | Re-run on 3–4 pages after launch |

## Outstanding configuration items

* Official **logo** files (SVG/PNG) to replace the typographic wordmark in `src/components/store/Logo.tsx`.
* **Homepage photo** (optional): upload in Settings.
* **Real product photos** and the catalogue itself.
* `SITE_URL` and the custom **domain**.
* **Delivery areas and fees**: the demo seed uses placeholders (20/30/40/70 ₪) that **must be replaced**.
* Business **hours** and **Google Maps** link.
* Owner and staff **accounts**.
* Optional SES sender and recipient for e-mail alerts.

## Questions for the owners

1. **Domain:** do you own one (e.g. `basman.ps`, `basmanperfumes.com`)? Who manages the DNS?
2. **WhatsApp:** is 0569 398 080 the WhatsApp number for orders, or is there a separate one?
3. **Opening hours**, and the exact **Google Maps** pin of the shop?
4. **Delivery:** which areas do you deliver to, at what fees, and with any free-delivery threshold? Who delivers (your own driver or a company)?
5. **Claims:** may the site say "since 1965"? Do you want to mention official distributor or accreditation status (for example "Premium Brands")? If so, please provide written confirmation.
6. **Logo:** can you provide the original logo file?
7. **Catalogue:** how many products, which categories, and who will enter them? Will you track stock quantities, or only mark products available or unavailable?
8. **Staff:** who will use the dashboard, and should anyone have limited (staff) access?
9. **Notifications:** is the dashboard alert enough, or do you want an e-mail for every new order?
10. **Data retention:** how long should customer details be kept on completed orders? (Default: 2 years.)
11. **Returns and exchanges:** do you have a policy to publish?
12. **Prices:** do prices vary by size? Do you run promotions we should model (e.g. "buy 2")? The current system supports per-size prices and sale prices only.

## Demo before deployment

Run locally (README → *Run it locally*), seed demo data, and present the store and dashboard. Everything demo is labelled "تجريبي / DEMO" and can be removed in one click.
