# Discovery, design and architecture

## 1. Discovery (2 November 2026)

### Brand research

Both official accounts were publicly readable without logging in. Only the profile, bio and visible tiles were reviewed; no content was downloaded or reused.

| Source | Findings |
| --- | --- |
| Instagram `@basman_perfumes` (≈10.3K followers) | Logo: deep **burgundy Arabic calligraphy "بسمان"** with an ornamental "1", on white. Slogan: «عطركم من بسمان أكبر ضمان لكم». Bio: "established 1965", "accredited by many international companies and official agencies", location "رام الله شارع ركب مقابل الوردة الحمراء". Story highlights by brand: Valentino, JPG, Gucci, YSL, Givenchy, Jimmy Choo, Calvin Klein, Chloé, Boss, plus "Sales". Posts: dark, moody product photography with the logo watermark. |
| Facebook "Basman بسمان" (≈36K followers) | Intro: "specialists in original perfumes since 1965, accredited by Premium Brands". Address: شارع ركب - مقابل الورده الحمراء, Ramallah. Phone **0569 398 080**. Price range "$". Recent post promoting **CLINT by L'Orientale Fragrances** (oriental line). Opening hours not listed. |

**What they sell:** international designer perfumes and oriental lines (e.g. L'Orientale), with sales and promotions.

**Positioning:** a mixture. It is a **heritage local boutique** (calligraphic logo, "since 1965", a known street address) selling **premium international brands**. The website therefore aims for "established Ramallah perfumer, presented with the restraint of a luxury house".

### How business information is handled

* **Used (verified on their public pages):** name, logo style and colours, address, phone, social links, the slogan, "since 1965".
* **Not used:** "accredited by international companies / Premium Brands" and any authenticity guarantee. These are official-partnership claims that must come from the owners in writing.
* **Placeholders:** opening hours, Google Maps pin, WhatsApp number (assumed to be the same mobile), delivery areas and fees. All are editable in **Settings**; the site hides or neutrally words anything not yet set.
* **Real brand names and products are not invented.** The demo catalogue uses generic names, the brand "DEMO", a visible "DEMO" mark on images, and is removable in one click.

## 2. Design direction

"Ramallah perfumer, luxury restraint." The palette is taken from the logo, with packaging neutrals added:

| Token | Value | Use |
| --- | --- | --- |
| `ivory` | `#FBF8F3` | Page background |
| `cream` / `sand` / `line` | `#F4EEE4` / `#E9DFCF` / `#DDD1BD` | Surfaces, dividers, borders |
| `burgundy` / `burgundy-deep` | `#7A1E22` / `#5A1418` | Brand colour from the logo: primary buttons, prices on sale, wordmark |
| `champagne` / `gold` | `#C4A46B` / `#8A6A35` | Ornament lines, eyebrows (gold is the AA-contrast text variant) |
| `charcoal` / `ink` / `muted` | `#1E1A17` / `#2D2723` / `#6A6058` | Headings, body, secondary text (all ≥ 4.5:1 on ivory) |
| `success` / `warning` / `danger` / `info` | Muted, desaturated variants | States |

**Typography:** IBM Plex Sans Arabic for UI and body (excellent Arabic legibility, with Latin included), Amiri for Arabic display headings (classical naskh), Cormorant Garamond for English display, and Aref Ruqaa for the "بسمان" wordmark, echoing their calligraphic logo. Body text is 17 px. Fonts are self-hosted at build time (no Google requests from visitors). Only the body font is preloaded.

**Layout:** proper RTL built from logical properties (`ms-`/`me-`, `start`/`end`, `border-s`), so the whole layout mirrors, not just the text alignment. Directional icons flip in RTL. Prices, phone numbers and order numbers are isolated LTR runs. Latin digits are used everywhere, matching local price tags.

**Components:** buttons (primary, dark, secondary, ghost, danger, WhatsApp; 48 px minimum touch targets), fields with hint and error, cards, badges, alerts, skeleton loaders, empty states, quantity stepper, toggle switch, confirmation dialog and toasts in the dashboard. Hover effects are subtle, there are no pop-ups or countdown timers, and `prefers-reduced-motion` is respected.

**Hero visual:** without licensed photography, the homepage shows a small vector still-life: an arched niche (a nod to Ramallah's stone arches) with two bottles in burgundy and gold. The owners can replace it from **Settings → Homepage image**.

**Logo:** a typographic wordmark is used until the official vector logo is supplied (`src/components/store/Logo.tsx`).

**Dashboard UX for non-technical owners:** Arabic first; large text and buttons; one big "next step" button per order (Confirm → Preparing → Out for delivery → Delivered); call and WhatsApp buttons; plain-language confirmations before cancelling, deleting or marking delivered; a bottom tab bar on phones; and a red banner, tab counter and optional chime when a new order arrives.

## 3. Architecture

```
                      ┌──────────────────────────────────────────────────────┐
  Customer / owner ──►│ AWS Amplify Hosting (CDN + HTTPS + Next.js SSR)       │
  (phone, browser)    │  • storefront & dashboard pages                       │
                      │  • /api/* (orders, admin) — validation & auth here    │
                      └──────────────┬──────────────────────┬─────────────────┘
                                     │ IAM compute role     │ IAM compute role
                                     ▼ (least privilege)    ▼
                       Amazon DynamoDB (on-demand)    Amazon S3 (private)
                       products, orders, sessions,    product images
                       rate limits, settings          ▲
                       PITR 35 days + AWS Backup      │ Origin Access Control
                                                      │
  Customer ─────────────────────► Amazon CloudFront (images only, HTTPS)
  CloudWatch alarms → SNS e-mail · AWS Budgets alert · optional SES new-order e-mail
```

### Why this architecture

| Requirement | Decision |
| --- | --- |
| **Low, predictable cost** | Everything is pay-per-use: no running servers, no RDS instance (~$15+/month), no NAT gateway (~$35/month), no load balancer (~$18/month). The expected bill for a store this size is a few dollars a month ([costs](DEPLOYMENT.md#monthly-cost-estimate)). |
| **Simplicity / no maintenance** | No operating system or database server to patch. Amplify builds and deploys on `git push`; DynamoDB and S3 are fully managed. |
| **Security** | No public database endpoint at all: DynamoDB is reached over IAM-signed HTTPS, using a role scoped to one table. No AWS keys anywhere in the app. The image bucket is private and readable only through CloudFront. |
| **Reliability** | DynamoDB, S3, CloudFront and Amplify are multi-AZ managed services. Orders use DynamoDB transactions, so an order, its stock decrement and its idempotency record either all commit or none do. |
| **Why DynamoDB, not PostgreSQL?** | The data is small (hundreds of products, a few thousand orders a year) with simple access patterns, and Amplify's SSR runtime cannot reach a private VPC database without extra paid networking. Relational queries are not needed: the catalogue is read whole (cached 30 s) and filtered in memory, orders are paged by date and looked up by number or phone through indexes. |
| **Why not Cognito?** | Two or three owner accounts do not need a user pool, hosted UI or federation. A small, well-tested session system (Argon2id, server-side sessions, lockout) is easier to explain and support, and every rule is visible in code. Cognito can be adopted later without touching the storefront. |
| **Why Amplify Hosting?** | It is the managed AWS option with first-class Next.js SSR support (HTTPS, CDN, preview branches, one-click rollback). Its compute role gives the server AWS permissions without keys. |
| **No microservices** | One Next.js application with clear internal layers. |

### Code layers

| Layer | Location | Rule |
| --- | --- | --- |
| Frontend | `src/app/**/page.tsx`, `src/components` | No direct data access. Client components call `/api/*` only. |
| API / HTTP | `src/app/api`, `src/server/admin-route.ts`, `src/server/http.ts` | Origin check, auth, rate limit, JSON parsing, zod validation, error mapping |
| Business logic | `src/server/services`, `src/lib` (pure) | Pricing, stock, statuses, retention, notifications |
| Data access | `src/server/repos`, `src/server/db` | The only code that talks to DynamoDB |
| Auth | `src/server/auth` | Passwords, sessions, guards |
| Storage | `src/server/storage` | Local disk or S3 behind one interface |
| Configuration | `src/server/env.ts` (validated), `src/config/business.ts`, Settings in DB | |

### Data model (single DynamoDB table)

See `src/server/db/schema.ts`: products (with a slug lock item), categories, settings, orders (GSI1 by date, GSI2 by phone, sparse GSI3 for open orders), order counter, idempotency records (24 h TTL), admin users, sessions (TTL), rate-limit counters (TTL).

Money is stored as integer **agorot** to avoid rounding errors. Dates are ISO UTC and displayed in **Asia/Hebron** time.

### Product flexibility

A product has bilingual name and description, a brand, an optional category, gender and fragrance family, up to 8 images, and **1–10 variants** (label, optional size in ml, optional SKU, price, optional sale price, optional stock tracking). A gift set, an oud oil or a 100 ml EDP fit the same model without irrelevant required fields.

### Best sellers

Deliberately **not** shown yet: there is no sales history, and the brief forbids fabricated data. Once real orders exist, a "best sellers" row can be derived from delivered orders.
