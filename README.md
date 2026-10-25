# Aurum Bespoke Acquisition

A small, evidence-first acquisition and relationship system for Aurum Bespoke. It follows:

**Discover → evidence → score → verify contact → eligibility → review → appropriate communication → response → consultation → order → revenue.**

## Strategy

Inbound consultation requests and referral partnerships are primary. Professional events support introductions. Outbound email is optional, disabled by default, and never drives qualification.

## Stack

- Next.js 16 / TypeScript
- PostgreSQL via Drizzle, isolated `aurum_acquisition` schema
- One Cloud Run service plus the same image as a Cloud Run Job
- Neon Launch PostgreSQL in Singapore recommended for production
- Cloud Scheduler, Secret Manager and private GCS backups

## Local start

1. Copy `.env.example` to `.env` and configure secrets.
2. Apply migration: `npx drizzle-kit migrate`.
3. Seed source registry: `NODE_OPTIONS='--conditions=react-server' npx tsx scripts/seed-sources.ts`.
4. Run `npm run dev`.
5. Open `/` and create the owner with `ADMIN_BOOTSTRAP_TOKEN`.

Sending remains disabled after bootstrap.

## Validation

- `npx vitest run`
- `npm run lint`
- `npx next typegen`
- `npm exec tsc -- --noEmit --pretty false`
- `npm run build`
- `build_and_start`

The E2E test uses ephemeral secrets and deletes its fixtures. See `docs/OPERATIONS.md`.

## Documentation

- `docs/ARCHITECTURE.md`
- `docs/SOURCE-REPORT.md`
- `docs/SECURITY.md`
- `docs/OPERATIONS.md`
- `docs/LAUNCH-CHECKLIST.md`
- `docs/CHANGELOG.md`
