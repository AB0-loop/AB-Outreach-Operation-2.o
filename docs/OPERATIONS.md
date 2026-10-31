# Operations, deployment and recovery

## Environment separation

Use different GCP projects, Neon projects/databases, OAuth clients, Secret Manager secrets and GCS buckets for staging and production. Never share Aurum resources with Bespoke Zero.

## Cloud Run deployment

1. Create Artifact Registry repository `aurum` in the chosen region.
2. Build with `gcloud builds submit --config cloudbuild.yaml`.
3. Run migration from a controlled one-off job using the migration-owner `DATABASE_URL`.
4. Deploy web service from the immutable `$SHORT_SHA` image, request-based billing, minimum instances 0 initially, conservative max instances/concurrency, and pooled Neon URL.
5. Create worker job from the same image overriding command to `npx tsx scripts/worker.ts --once` and setting `NODE_OPTIONS=--conditions=react-server`.
6. Schedule the worker using Cloud Scheduler with a dedicated service account and `roles/run.invoker` only.
7. Seed sources once with the same server condition.
8. Verify `/api/health`, login, dry-run, job completion and backup freshness.

Rollback: redeploy the previous immutable image revision. Database migrations must be backward-compatible for one release; take a backup before migration. Never roll back by dropping production data.

## OAuth callback

Exact formula: `${APP_BASE_URL}/api/integrations/gmail/callback`.

Create a Web Application OAuth client in the Aurum-owned Google Cloud project. Configure only the actual HTTPS staging/production callbacks. Connect a controlled test mailbox before any business mailbox.

## Worker

Run locally:

`NODE_OPTIONS='--conditions=react-server' npx tsx scripts/worker.ts --once`

Jobs use atomic claims, stale-lock recovery, exponential retry and dead-letter status. Source health checks create no prospects.

## Backup and restore

Backup:

`./scripts/backup.sh /secure/private/path`

Upload dump and checksum to a private versioned GCS bucket using a write-limited service account. Target initial retention: 14 daily, 8 weekly, 6 monthly. Production RPO target 24 hours; RTO target 4 hours—operational goals, not SLA.

Restore check:

`./scripts/restore-check.sh /path/file.dump`

The script validates checksum, creates an isolated temporary database, restores, verifies acquisition tables, and drops the database. This process was executed successfully in the sandbox.

## Test commands

- Unit/database: `npx vitest run`
- HTTP E2E: start a temporary server with ephemeral test secrets, then `node scripts/e2e.mjs`.
- Final: typegen, TypeScript, build and platform healthcheck.

## Safe pause

1. Set kill switch on and mode disabled.
2. Stop Scheduler/worker job.
3. Inspect sending reservations and provider IDs.
4. Process any opt-out/complaint.

Restart only after database, backup, mailbox, DNS, suppression and dry-run checks pass.

## Autonomous schedule

Create a Cloud Scheduler job that runs the worker Cloud Run Job **hourly** (for example `0 * * * *`, time zone Asia/Kolkata). One trigger runs everything: the worker schedules the day's discovery and the 20:00 IST report itself. Set `GOOGLE_PLACES_API_KEY` in Secret Manager. Restrict the key to the Places API, and to the worker's egress where possible. Monitor `dead_letter` jobs and the "Recent discovery runs" panel. See `docs/DISCOVERY.md`.
