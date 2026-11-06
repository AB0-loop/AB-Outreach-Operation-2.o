# Release gates — status as of 6 Nov 2026

Each gate is marked **PASSED** only when it was actually executed. "Built" is not "proven".

| # | Gate | Status | Evidence |
|---|---|---|---|
| 1 | Production proof: persistent URL, production database, login, backups, recovery | **NOT PASSED** | No Google Cloud project, Neon production credentials or domain have been provided. The app has only run in a sandbox preview. The sandbox did prove three things: a backup was taken and restore-verified into an isolated database before the schema change; the build passes; the health check passes. None of that is production. |
| 2 | Discovery proof: real search batch, every result manually inspected | **NOT PASSED** | Needs `GOOGLE_PLACES_API_KEY`, a Google Cloud API key with **Places API (New)** enabled and billing attached. That is the only search key this system uses; there is no `GOOGLE_SEARCH_API_KEY`. Google's Custom Search JSON API is closed to new customers and ends 1 Jan 2027, so it is deliberately not used. Until a key exists, only websites seeded by staff are processed. |
| 3 | Contact proof: independent re-check against source | **PASSED (narrow scope)** | `scripts/contact-audit.ts` re-fetched each source page outside the crawler: 8/8 contacts still published on the exact page (results stored as `source_recheck`). This proves publication only, not ownership or that someone answers. Note: one email (hello@tamarindtree.co) is on a different domain from the website (thetamarindtree.in). |
| 4 | Automation proof: scheduled worker discovers, processes and reports with no human involvement | **NOT PASSED** | The worker self-schedules and drains the queue when started (tested here). No hourly Cloud Scheduler trigger exists yet, and discovery has nothing to search without a key. |
| 5 | Commercial proof: four-week campaign of calls, meetings, partnerships, referrals and orders | **NOT STARTED** | Real business data so far: 4 partner businesses, 8 contacts, 0 calls, 0 meetings, 0 referrals, 0 orders, ₹0. |

## What this system does and does not guarantee

- **Guaranteed:** no record is knowingly fabricated by the system.
  - Automated records come from a fetched page and store the URL and exact excerpt.
  - Human entries are labelled `human_entry` (evidence) or carry `humanEntered` (audit).
  - Test records are flagged `is_test` and excluded from every report, scorecard and the call queue (end-to-end test asserts this).
  - Test runs delete their data.
- **Not guaranteed:** that every extracted fact is correct. Pages can be outdated, keyword relevance can be wrong, and names can be detected wrongly. Weak evidence stays at a low level on the contact ladder and goes to human review.
- **Correction recorded:** the first four partner records were created from setup notes whose "excerpts" were paraphrases. They are now labelled human-entered and annotated as such.

## Contact evidence ladder (replaces the bare "verified")

Source published → format valid / domain mail-enabled → independently corroborated (business website + Google listing agree) → human confirmed (a logged call reached the business). An MX record shows the domain accepts mail; it does not prove the mailbox exists.

## Partner scoring policy

No predictive partner score is shown. The scorecard lists measured counts: calls, answered, minutes, meetings held, agreed, referrals, completed consultations, orders won, revenue and margin (shown only when cost is recorded). Introduce weighted scoring only after a meaningful sample, for example 20 or more partners with 8 or more weeks of outcomes.
