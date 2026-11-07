# بسمان للعطور — Basman Perfumes

The online store for **Basman Perfumes**, Rukab Street, Ramallah. Customers browse fragrances in Arabic or English, order from their phone and **pay cash on delivery**. The owners manage products, prices, stock and orders from a simple Arabic dashboard.

> **Status:** application complete and verified locally (see [Test results](docs/HANDOVER.md#test-results)).
> **Not yet deployed to AWS.** Deployment is prepared (CDK + Amplify) but has not been run against a real account.

| Document | For |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Discovery findings, design system, architecture and why it was chosen |
| [docs/SECURITY.md](docs/SECURITY.md) | Every important security decision |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | AWS deployment, domain, rollback, backup and recovery, maintenance, costs, checklist |
| [docs/HANDOVER.md](docs/HANDOVER.md) | Test results, outstanding configuration, questions for the owners |
| [docs/OWNER-GUIDE-AR.md](docs/OWNER-GUIDE-AR.md) | دليل مختصر لأصحاب المحل (بالعربية) |

---

## What's inside

**Storefront** (Arabic RTL by default, English LTR): curated homepage, catalogue with search (Arabic-aware), category, gender and brand filters, sorting and pagination, product pages with sizes and live stock, a persistent cart, two-step COD checkout with review, and a private confirmation page with a WhatsApp link. Also contact and privacy pages, SEO (hreflang, Open Graph, JSON-LD Store and Product, sitemap, robots) and friendly 404 and error pages.

**Dashboard** (`/ar/admin`): overview (new, open, today and total orders, product count, low-stock alerts), orders with status tabs, search by order number or phone, date filter, a one-tap "next step" status button, call and WhatsApp buttons, printable receipt, CSV export for Excel, and a new-order alert (banner, tab counter, optional chime). Products: add, edit, archive and delete, with images, sizes, prices, sale prices, stock, featured and available flags. Also categories, settings (store info, delivery areas and fees, ordering on/off, retention policy, hero image, announcement bar), password change, and one-click removal of demo content.

## Technology

| Layer | Choice |
| --- | --- |
| App | Next.js 15 (App Router, React 19, TypeScript strict), Tailwind CSS 4 |
| Data | Amazon DynamoDB, single table (`src/server/db/schema.ts`) |
| Images | Validated and re-encoded with `sharp` to WebP; S3 + CloudFront in production, local disk in development |
| Auth | Own server-side sessions, Argon2id password hashes, DynamoDB-backed rate limits |
| Validation | Zod, strict schemas shared by browser and server |
| Tests | Vitest (unit + integration on DynamoDB Local), Playwright (E2E on a production build) |
| Infra | AWS CDK (`infra/`), AWS Amplify Hosting |

## Project structure

```
src/
  app/                    Next.js routes
    [locale]/(store)/     storefront pages (home, shop, products, cart, checkout, order, contact, privacy)
    [locale]/admin/       dashboard (login, overview, orders, products, categories, settings, print)
    api/                  JSON endpoints (cart quote, orders, admin/*)
    media/                local-development image server
  components/             UI (store/, cart/, admin/, ui/)
  config/business.ts      verified business facts + clearly marked placeholders
  lib/                    pure, framework-free logic (money, phone, pricing, search, validation, i18n, dates…)
  server/                 server-only code
    auth/                 password hashing, sessions, guards
    db/                   DynamoDB client + table schema
    repos/                data access (the only code that talks to DynamoDB)
    services/             business logic (orders, catalogue, admin, images, notifications, rate limits)
    storage/              local / S3 image storage
  middleware.ts           locale routing + per-request CSP nonce
scripts/                  DynamoDB Local, table creation, admin accounts, demo seed, retention, brand assets, infra deploy
tests/                    unit/, integration/, e2e/
infra/                    AWS CDK stacks (staging + prod)
docs/                     documentation
```

## Run it locally

Requirements: **Node.js 22**, **Java 17+** (only for DynamoDB Local).

The project ships without local data or passwords: `.env.local`, the local database and any test accounts are created by the steps below.

```bash
npm ci
```

```bash
cp .env.example .env.local
```

Start the local database in its own terminal. It downloads the official AWS DynamoDB Local build once and verifies its checksum:

```bash
npm run db:local
```

```bash
npm run db:create
```

Load the clearly marked demo catalogue (optional; it can be removed from the dashboard in one click):

```bash
npm run db:seed-demo
```

Create the owner account. It asks for a password of at least 12 characters, which is not echoed:

```bash
npm run admin:create -- --username owner --name "Abu Basman" --role owner
```

```bash
npm run dev
```

Open http://localhost:3000 for the store and http://localhost:3000/ar/admin for the dashboard.

After this first-time setup, one command starts both the database and the store:

```bash
npm run start:local
```

### Environment variables

See [.env.example](.env.example). There are **no secrets** in the configuration: in AWS the server gets access through an IAM role. Main variables:

| Variable | Purpose |
| --- | --- |
| `APP_ENV` | `development` / `test` / `production` (production enforces HTTPS, S3, secure cookies, HSTS) |
| `SITE_URL` | Public URL (canonical links, sitemap, CSRF origin check) |
| `DYNAMODB_TABLE` | Table name (`basman-staging`, `basman-prod`) |
| `DYNAMODB_ENDPOINT` | Local only (DynamoDB Local). Must be empty in AWS |
| `STORAGE_DRIVER`, `S3_BUCKET`, `MEDIA_BASE_URL`, `NEXT_PUBLIC_MEDIA_BASE_URL` | Image storage |
| `TRUST_PROXY`, `PROXY_HOPS` | Use `X-Forwarded-For` from the hosting proxy for rate limiting |
| `SES_FROM_ADDRESS`, `ORDER_NOTIFY_EMAIL` | Optional new-order e-mail |

### Admin accounts

There is no public sign-up. Accounts are created only from a terminal with AWS access:

```bash
npm run admin:create -- --username staff1 --name "Staff" --role staff
```

Reset a forgotten password (this also signs the user out everywhere):

```bash
npm run admin:create -- --username owner --reset
```

Roles: **owner** can do everything. **staff** can manage orders, products and categories, but cannot change settings, delete products or categories, or remove demo content.

### Image uploads

Owners upload JPG, PNG or WEBP files up to 8 MB. The server checks the real file type from its bytes, decodes it with a pixel limit, and re-encodes it to WebP at 400, 800 and 1200 px, which strips metadata such as GPS. Files get random server-generated names. Locally they go to `.data/uploads/`; in production they go to a private S3 bucket served through CloudFront.

## Tests

Start DynamoDB Local first (`npm run db:local`) for the integration and E2E tests.

| Command | What |
| --- | --- |
| `npm run typecheck` | TypeScript strict |
| `npm run lint` | ESLint (Next.js rules + `eslint-plugin-security`) |
| `npm run test:unit` | 105 unit tests: pricing, discounts, delivery, stock, order numbers, validation, phone numbers, search, dates, CSV, file sniffing… |
| `npm run test:integration` | 39 tests on a real DynamoDB engine: products, images, orders, idempotency, concurrency, statuses, auth, authorisation, retention |
| `npm run test:e2e` | 30 Playwright tests on a production build: the full 16-step journey, mobile, RTL, edge cases, security |
| `npm run audit` | Dependency audit (production dependencies) |
| `npm run check` | Type-check + lint + unit/integration + audit |

## Deployment, rollback, backups, maintenance

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**. In short: `infra/` provisions everything with CDK (`scripts/deploy-infra.sh`), and Amplify builds and deploys on every push to `main`. Rollback is "redeploy previous build" in Amplify. Data has 35-day point-in-time recovery plus daily and monthly backups.
