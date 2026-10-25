# Architecture and decision record

## Chosen approach

A lean CRM and evidence workflow implementing the strongest parts of both candidate approaches:

- Option A retained: provenance, deterministic safety, human approval, suppression, idempotency, migrations and measurable outcomes.
- Option B retained: inbound/referral priority, networking rather than directory marketing, and cautious infrastructure economics.
- Rejected: generic scraping, autonomous agents, bulk Gmail, guessed contacts, premature AI, microservices and overlapping managed platforms.

## Components

```text
Cloud Run web service ─┐
                       ├─ Neon PostgreSQL (Singapore)
Cloud Run Job worker ──┘
       ▲
Cloud Scheduler (IAM)

Secret Manager → runtime secrets
GCS → private logical backups
```

One codebase owns UI, APIs and worker logic. Jobs are persistent PostgreSQL rows claimed with `FOR UPDATE SKIP LOCKED`, bounded retries and dead-letter status.

## Database

All new objects live in `aurum_acquisition`; the migration journal lives in `aurum_acquisition_migrations`. Previous/public tables are not read or modified.

Scores are separate:

- `identity_confidence`: strength/freshness of identity evidence;
- `commercial_fit`: relevance to Aurum;
- `eligibility_checks`: exact contact, purpose, relationship and expiry;
- `stage`: actual funnel outcome.

Database CHECK constraints protect score and money ranges. Canonical duplicate pairs and send idempotency have unique constraints.

## Communication boundary

Dry run and live send use separate routes. Dry run has no provider import and always returns `providerInvoked: false`. Live send is owner-only and rechecks:

- environment permission;
- workspace mode and kill switch;
- latest prospect and message approvals;
- latest unexpired eligibility for the exact contact;
- prospect suppression and global contact fingerprint suppression;
- contact verification;
- connected mailbox;
- mailbox/global cap reservations under a PostgreSQL advisory lock;
- earlier successful send and idempotency key.

Gmail uses `openid`, `email`, and `gmail.send` only. Reply reading is deliberately manual in the MVP.

## AI decision

No AI provider is enabled. The deterministic system remains fully usable. Add a provider interface only after human research produces enough consultations/orders to measure whether extraction or drafting saves time. AI will never control eligibility, suppression, approval or sending.

## Deployment economics

Recommended: Cloud Run + Neon Launch + Cloud Run Jobs/Scheduler + GCS.

Planning estimate: **$2–10/month / ₹176–₹880 at ₹88/USD**, excluding tax, optional mailbox, AI, and unusual logs/egress. This is not a guarantee.

Why not e2-micro: 1 GB RAM, US-only compute free tier, operational maintenance, and an in-use external IPv4 around $3.65/month. Why not Vercel Hobby: commercial use is prohibited. Why not Supabase Pro: its extra features are unnecessary here.

Official sources:

- Cloud Run pricing: https://cloud.google.com/run/pricing
- Cloud Run SLA: https://cloud.google.com/run/sla
- Cloud Scheduler pricing: https://cloud.google.com/scheduler/pricing
- GCP IPv4: https://cloud.google.com/vpc/network-pricing
- Neon plans: https://neon.com/docs/introduction/plans
- Neon regions: https://neon.com/docs/introduction/regions
- Supabase: https://supabase.com/pricing
- Vercel fair use: https://vercel.com/docs/limits/fair-use-guidelines
