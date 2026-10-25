# Launch checklist

## Verified now

- [x] Isolated schema and independent migration journal.
- [x] Migration applied without modifying preserved public tables.
- [x] 17 unit/database tests pass.
- [x] 14-check HTTP E2E passes with zero provider sends.
- [x] Real source health job completed.
- [x] Four real first-party partner records retain evidence.
- [x] Backup restored into isolated database successfully.
- [x] Dry-run structurally excludes provider code.
- [x] Live sending disabled and kill switch active.

## Required before staging

- [ ] Authoritative Git remote and protected main branch.
- [ ] Staging GCP/Neon/Secret Manager/GCS resources.
- [ ] Least-privilege application and migration DB users.
- [ ] Immutable Cloud Run image and worker job deployed.
- [ ] Budget, uptime, 5xx, dead-letter and backup alerts.
- [ ] Staging owner created and MFA/access boundary chosen.

## Required before live communication

- [ ] Explicit owner approval.
- [ ] India-qualified legal/privacy/provider review.
- [ ] Mailbox ownership and continuity verified.
- [ ] OAuth test, revocation and reconnection verified.
- [ ] SPF/DKIM/DMARC verified where applicable.
- [ ] Bounce/complaint/opt-out operating procedure staffed.
- [ ] Every recipient has exact current eligibility and no suppression.
- [ ] Prospect and message separately approved.
- [ ] Controlled-recipient provider test completed.

## Business acceptance

- [ ] Authorised inbound records reach consultation tracking.
- [ ] 20 partner records manually sampled at ≥95% factual accuracy.
- [ ] Partner conversations and introductions measured.
- [ ] First consultations and orders attributed to acquisition source.
- [ ] Cost and time per qualified consultation reported.

**Verdict:** software foundation is staging-ready after cloud/secret configuration; genuine outreach is blocked pending the unchecked approvals above. No customer outcome is claimed.
