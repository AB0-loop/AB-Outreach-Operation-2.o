# Changelog

## 2026-10-25 — Initial clean build

- Selected inbound/referral-first strategy and Cloud Run + Neon architecture.
- Created isolated 24-table constrained schema and independent migrations.
- Added authentication, RBAC, CSRF, atomic rate limits and structured logs.
- Added manual/CSV/signed-inbound prospect entry with provenance and deduplication.
- Added scoring, exact-contact eligibility, suppression, approvals and evidence-linked drafts.
- Added provider-free dry-run and owner-only fail-closed Gmail send route.
- Added manual response, consultation, order, revenue and cost tracking.
- Added persistent jobs, safe source checks, retries and dead-letter visibility.
- Added Cloud Run packaging, backup/restore scripts and operating documentation.
- Executed source healthcheck, four-record referral sample, 17 automated tests, 14-check E2E and isolated restore test.
- No DNS changed, service purchased or real outreach sent.

## 2026-10-31 — Autonomous discovery engine

- Added hourly self-scheduling worker: daily Google Places discovery, first-party website crawling, contact extraction, verification, scoring, and 20:00 IST report.
- Added robots.txt-respecting, SSRF-safe crawler; email, Cloudflare-email, phone and WhatsApp extraction; libphonenumber and MX verification; Places-phone corroboration.
- Added contact verification history, provider usage caps, discovery query management, website seeding, daily reports, prioritised human call queue and call logging with an enforced DND confirmation.
- Added LinkedIn/web research links and manual evidence entry (no automated LinkedIn access).
- Live run on 4 first-party partner sites: 4/4 processed, 8 contacts (3 role emails, 5 phones), 5 call-ready; fixed a duplicate caused by an SEO page title.
- Tests: 26 unit/integration, 17-check E2E.
