# Source and data-quality report

Observation/run date: **25 October 2026**.

## Acquisition priority

1. Aurum website/WhatsApp inbound.
2. Planner, stylist, venue, photography and complementary premium partnerships.
3. Explicit need/referrals.
4. Corporate/professional introductions.
5. Outbound only after separate review.

## Actual run

A controlled `source.health_check` job fetched Aurum's owned homepage:

- HTTP: 200;
- response: 267,857 bytes, HTML;
- job attempts: 1;
- status: completed;
- prospects created by healthcheck: 0.

A read-only inspection found the public form submits to Web3Forms and then best-effort `/api/bookings`. This application provides a signed inbound webhook and manual/CSV interim workflow, but no production site connection is claimed.

## Actual referral sample

Four first-party business records were retained:

- Panigrahana Weddings;
- Dreamstrokes;
- The Tales of Tradition;
- The Tamarind Tree.

Each has a first-party URL and concise service/location/partnership evidence. No personal names or contact points were stored.

Explicit denominators:

| Metric | Result |
|---|---:|
| Discovered/selected business records | 4 |
| Retained with commercial evidence | 4/4 (100%) |
| Contacts stored | 0/4 (0%) |
| Independently verified contacts | — (0 contacts) |
| Eligible contacts | 0/4 (0%) |
| Human approved | 0/4 (0%) |
| Consultations | 0/4 (0%) |
| Orders | 0/4 (0%) |

The deterministic initial score is a review priority, not qualification or permission. All four remain in review.

## Access decisions

- Aurum owned site: permitted health monitoring; booking records need authorised access.
- Partner sites: manual research only; terms and robots were reviewed individually; do not bulk-copy or use wedding-enquiry forms for vendor pitches.
- EEMA/TiE/BCIC: use public events for relationship development, not attendee/member marketing lists.
- LinkedIn/Instagram/Google Maps: no scraping adapter.

## Acceptance standard for expansion

A source is added only after a 20-record or full-run human sample reaches ≥95% factual accuracy, records source permissions, produces commercial evidence, and demonstrates consultations or useful partner conversations. Raw count alone is not success.
