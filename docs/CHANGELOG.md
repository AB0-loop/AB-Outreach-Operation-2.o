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
