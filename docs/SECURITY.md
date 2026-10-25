# Security and communication controls

## Implemented and tested

- Argon2id passwords.
- Random opaque sessions stored as HMAC hashes.
- HttpOnly Secure SameSite=Strict session cookie and separate hashed CSRF token.
- Server-side role permissions.
- Strict origin checks outside development.
- Trusted-proxy requirement outside development.
- Atomic PostgreSQL rate-limit upsert.
- Zod request validation.
- HMAC-signed inbound webhook.
- HMAC contact fingerprints; no plain contact in suppression rows.
- AES-256-GCM OAuth token encryption.
- PKCE, expiring one-use OAuth state, verified Google email.
- Exact-contact eligibility and expiry at send time.
- Prospect and contact-fingerprint suppression at send time.
- Advisory-lock cap reservation and unique idempotency.
- Structurally provider-free dry run.
- Audit records for approvals, settings, sources and communications.
- Fail-closed missing settings/dependencies.

## Production requirements

- Secret Manager; never `.env` in an image.
- Separate migration owner and app role. App role gets DML and sequence usage only in `aurum_acquisition`.
- Cloud Run ingress/access policy appropriate to an admin application.
- Rotate any credential ever shared outside a secret manager.
- Configure monitoring for 5xx, dead-letter jobs, missing backups and budget.
- Add MFA through an identity provider before adding multiple operators with broad roles.

## Legal/provider posture

This is engineering guidance, not legal advice. Public availability is not blanket marketing permission. Obtain India-qualified review for the actual processing/outreach facts before a live pilot.

Gmail policies prohibit spam/unsolicited commercial mail. Sending limits are ceilings, not permission. The MVP prioritises inbound, referrals and relationships.

No SMS, WhatsApp marketing, automated calls or Gmail read scopes are implemented.

## Domain observations

At audit time `aurumbespoke.com` had Cloudflare routing MX/SPF and no observed DMARC; `aurumbespoke.in` had no observed web/mail DNS. Routing is not an outbound mailbox. No DNS was changed.
