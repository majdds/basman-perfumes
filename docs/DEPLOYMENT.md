# Deployment, operations and costs

> **Status:** prepared, **not executed**. No AWS account was available while building. The CDK stacks synthesize cleanly (`cd infra && npx cdk synth`), but nothing below has been run against real AWS. Items marked **⚠ verify** need confirmation on first deployment.

## What gets created

`infra/lib/basman-stack.ts`, one stack per environment (`Basman-staging`, `Basman-prod`):

| Resource | Notes |
| --- | --- |
| DynamoDB table `basman-<env>` | On-demand, 3 GSIs, TTL, PITR (35 days), AWS-managed encryption, deletion protection + retain in prod |
| S3 bucket (images) | Private, SSE-S3, TLS-only, versioned (old versions expire after 90 days), retained in prod |
| CloudFront distribution (images) | Origin Access Control, HTTPS-only, security headers, PriceClass 200 (includes Middle East edges) |
| IAM role for Amplify SSR | Least privilege: one table and its indexes, `products/*` in one bucket, optional SES |
| Amplify app + branch (+ domain) | Created only when `githubRepository` and `githubTokenSecret` are given; otherwise connect the repo in the console and attach the role |
| AWS Backup plan | Daily (35 days) and monthly (1 year) DynamoDB backups |
| CloudWatch alarms → SNS e-mail | DynamoDB errors and throttles, CDN 5xx, write spikes |
| AWS Budget | Monthly cost alert at 80% (actual) and 100% (forecast); default $25 |

Region: **eu-central-1 (Frankfurt)**: close to Palestine, and it supports every service used. ⚠ verify Amplify availability if you choose another region.

## Step-by-step: first deployment

1. **Accounts:** ideally two AWS accounts (staging and production) under AWS Organizations, or at least two stacks in one account. Enable MFA on the root user, then use IAM Identity Center (`aws sso login`).
2. **Code:** push this repository to a private GitHub repository. Create the `main` branch (production) and a `staging` branch.
3. **GitHub token for Amplify:** create a fine-grained token (read access to this repository only) and store it in Secrets Manager:

   ```bash
   aws secretsmanager create-secret --name basman/github-token --secret-string '<token>'
   ```

4. **Deploy staging:**

   ```bash
   ./scripts/deploy-infra.sh staging you@example.com "" owner/basman basman/github-token
   ```

   Confirm the SNS subscription e-mail. The outputs (table, bucket, media URL, role) are written to `infra/cdk-outputs-staging.json`.
5. **First build:** Amplify builds automatically. The build spec (`amplify.yml`) runs type-check, lint and unit tests, then `next build`.
   * ⚠ verify `sharp` and `@node-rs/argon2` load in the SSR runtime: upload an image and log in on staging. If `sharp` fails, add `npm install --os=linux --cpu=x64 sharp` to `preBuild`.
   * ⚠ verify that `SITE_URL` is set; without a custom domain, set it to the Amplify default domain (`https://staging.<appid>.amplifyapp.com`) in the Amplify console.
6. **Create the owner account** for staging, from your machine with staging credentials:

   ```bash
   DYNAMODB_TABLE=basman-staging AWS_REGION=eu-central-1 npm run admin:create -- --username owner --name "..." --role owner
   ```

7. **Configure in the dashboard** (Settings): phone, WhatsApp, address, Maps link, hours, **delivery areas and real fees**.
8. **Smoke test on staging:** place a COD order on a phone, confirm it in the dashboard, upload a product image, export CSV, print a receipt.
9. ⚠ **Verify rate-limit client IP:** place 6 test orders within 10 minutes from one phone. The 6th must be refused ("too many attempts"), while a different network can still order. If everyone shares one limit, or nobody is limited, adjust `PROXY_HOPS` (Amplify environment variable) and redeploy.
10. **Production:** repeat with `prod` and the domain:

    ```bash
    ./scripts/deploy-infra.sh prod you@example.com basman.ps owner/basman basman/github-token
    ```

11. **Domain and HTTPS:** Amplify issues the TLS certificate automatically. If the domain is registered outside Route 53 (for example a `.ps` domain through a PalNIC registrar), add the CNAME and verification records Amplify shows under *Hosting → Custom domains*. HTTPS works once the records propagate.
12. **Do not seed demo products in production.** Add real products from the dashboard (or seed in staging only, for the owners' demo).
13. Activate the `project` **cost allocation tag** in Billing so the budget filter works.

## Updating the site

Push to `staging`, check the staging site, then merge into `main`. Amplify builds and deploys automatically, with zero downtime. For infrastructure changes, run `npx cdk diff` first, then `cdk deploy`.

## Rollback

* **Application:** Amplify console → app → `main` → *Deployments* → choose the last good build → **Redeploy this version**. It takes about a minute, and data is unaffected.
* **Code:** `git revert <commit>` then push. This is the preferred permanent fix.
* **Infrastructure:** `git revert` the CDK change and `cdk deploy`. The table and bucket have `RETAIN` and deletion protection, so a bad change cannot delete data.

## Backup and recovery

| Scenario | Recovery |
| --- | --- |
| Wrong edit or deletion in the last 35 days | DynamoDB **point-in-time restore** to a new table at the minute before the mistake. Copy the needed items back, or point `DYNAMODB_TABLE` at the restored table and redeploy |
| Older data | Restore from the **AWS Backup** daily (35 days) or monthly (1 year) recovery points |
| Deleted or overwritten image | S3 versioning keeps previous versions for 90 days |
| Region outage | Accept the downtime (this is the cost-appropriate choice for this business). Restores can be made to another region from backups if ever needed |

Test a restore once a year: restore PITR to `basman-prod-restore-test`, check order counts, then delete it.

## Monitoring

* Alarm e-mails go to the address passed as `alertEmail`.
* Server logs: Amplify console → *Monitoring → Hosting compute logs* (CloudWatch). Logs are structured JSON without personal data.
* Useful log events: `order.placed`, `auth.login_failed`, `order.notify_failed`.

## Maintenance

| Frequency | Task |
| --- | --- |
| Monthly | `npm outdated` and `npm audit`; apply patch updates on `staging` first and run `npm run check` and `npm run test:e2e` |
| Monthly | Glance at the AWS bill and budget e-mails |
| Quarterly | Review dashboard accounts (remove ex-staff with a `--reset` to a random password, or delete the `ADMIN#` item) |
| Yearly | Restore test (above); renew the domain |
| As needed | Run "Apply now" for data retention, or schedule `npm run retention:run` |

## Monthly cost estimate

Assumptions: about 10,000 visits (~60,000 page views), 300 orders, 300 products, 1 GB of images, eu-central-1. Prices are approximate public on-demand list prices; confirm with the AWS Pricing Calculator.

| Item | Type | Estimate (USD/month) |
| --- | --- | --- |
| CloudWatch alarms (4 × $0.10) | Fixed | 0.40 |
| Route 53 hosted zone (only if DNS is on Route 53) | Fixed | 0.50 |
| Domain (e.g. `.com` ≈ $14/year; `.ps` varies by registrar) | Fixed | ≈ 1.20 |
| **Fixed subtotal** | | **≈ 1–2** |
| Amplify SSR requests + compute | Usage | ≈ 1–2 |
| Amplify data transfer (~15–20 GB) | Usage | ≈ 2–3 |
| Amplify build minutes (~100 min) | Usage | ≈ 1 |
| DynamoDB on-demand reads and writes, PITR, backups | Usage | < 1 |
| S3 storage and requests | Usage | < 0.10 |
| CloudFront (images) | Usage | ≈ 0 (within the always-free 1 TB tier) |
| CloudWatch Logs | Usage | < 0.50 |
| SES (optional, $0.10 per 1,000 e-mails) | Usage | ≈ 0 |
| **Usage subtotal** | | **≈ 4–7** |
| **Total** | | **≈ $5–9 / month** |

Traffic growth mainly increases Amplify transfer and compute. Ten times the traffic is roughly $30–50 a month. There are no instance or idle charges, so a quiet month costs close to the fixed portion.

## Deployment checklist

- [ ] Separate staging and production stacks (ideally separate accounts); root MFA on
- [ ] Repository private; `.env*` never committed (`git status` is clean of env files)
- [ ] `Basman-staging` deployed; alarm e-mail subscription confirmed
- [ ] Staging build passes (type-check, lint, unit tests in `amplify.yml`)
- [ ] `sharp` and Argon2 verified on staging (image upload and login)
- [ ] `SITE_URL` correct on each branch
- [ ] Owner account created with a strong password, stored in a password manager
- [ ] Settings filled: phone, WhatsApp, address, Maps link, **hours**, **delivery areas and real fees**
- [ ] Rate-limit client IP verified (`PROXY_HOPS`)
- [ ] Full staging smoke test on a real phone (Arabic and English)
- [ ] `Basman-prod` deployed with the domain; DNS records added; HTTPS working; `http://` redirects
- [ ] No demo products in production (or removed with the dashboard button)
- [ ] Real products, photos and categories added
- [ ] Privacy policy reviewed with the owners
- [ ] Cost allocation tag activated; budget e-mail received as a test
- [ ] Owners trained with [OWNER-GUIDE-AR.md](OWNER-GUIDE-AR.md)
- [ ] Restore test done once
