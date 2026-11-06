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

## 2026-11-02 — Combined connector and independent phone cross-check

- Kept the primary worker, extraction, security, verification, reporting and call-queue design.
- Added a dedicated Google Places connector: Text Search pagination, Place Details by stored ID, domain-matched listing lookup and per-endpoint daily caps.
- Added an independent business-phone cross-check: daily refresh, manual trigger, demotion when a number stops matching, outcome-only storage, and cross-check figures in the daily report.
- Hardened the job-claim test so it can't consume real queued work.
- Tests: 33 unit/integration (three consecutive passing runs), 17-check E2E unchanged and passing.

## 2026-11-06 — Option B with release-gate corrections

- **Removed:** Gmail OAuth, message drafts, approvals for messages, dry-run and live send, mailbox and OAuth storage, the inbound webhook, sending settings, and email eligibility. Six empty tables were dropped after a restore-verified backup.
- **Added:**
  - partner pipeline (stage plus next follow-up);
  - referral-to-consultation-to-order attribution with margin;
  - callback dates (due follow-ups lead the call queue);
  - corporate segment view;
  - measured-count partner scorecard (no predictive score);
  - contact evidence ladder;
  - evidence `origin` (automated or human);
  - test-data exclusion from all reporting.
- **Fixed:** a "meeting booked" call no longer creates a customer consultation for the partner. The report renames "auto-qualified" to "contacts for review", which are not leads.
- **Corrected:** four setup paraphrases are now labelled human-entered.
- **Gate 3:** 8/8 contacts re-confirmed on their source pages.
- **Tests:** 32 unit/integration (two runs); 25-check end-to-end.
