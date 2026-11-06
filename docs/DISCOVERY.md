# Autonomous discovery, contact extraction and call queue

## What runs by itself

An hourly Cloud Scheduler trigger starts the worker job. Each run:

1. Self-schedules today's `discovery.daily` and `report.daily` (20:00 IST) jobs — idempotent per day.
2. `discovery.daily` enqueues up to `DISCOVERY_QUERIES_PER_DAY` active searches, least-recently-run first.
3. `discovery.query` calls the official **Google Places API (New) Text Search**, biased to a 35 km radius around Bengaluru, and keeps only operational businesses with a website.
4. For each website, the crawler fetches the homepage plus up to three contact/about pages on the same site. It honours robots.txt, refuses private/IP targets, follows only same-site redirects, enforces size and time limits and waits 750 ms between pages. Directory and social platforms are rejected; only first-party business sites are used.
5. Extraction records, with the page URL and exact excerpt:
   - emails from `mailto:` links, Cloudflare-obfuscated addresses and page text;
   - Indian phone numbers from `tel:` links, WhatsApp links and page text, validated with libphonenumber;
   - the business name, a Bengaluru location mention, and commercial-relevance terms (groom, sherwani, bandhgala, menswear, wedding, vendor coordination, personal styling, corporate events and others).
6. Verification is recorded per contact in `contact_verifications`:
   - phone: valid Indian number, type (mobile or fixed line), and a match against the Google Places listing phone. A match across two independent sources is the only route to `verified`.
   - email: domain MX record, plus whether it matches the website domain. An email stays `published_unverified`; no mailbox probing is done.
7. Deterministic scoring sets identity confidence and commercial fit. High scorers go to `review` (auto-qualified, awaiting human approval), never straight to contacted.
8. `report.daily` stores the day's figures and the top of the call queue.

Businesses already verified in the last 30 days are skipped. Deduplication uses the place ID, website domain, normalised name and compact name, plus contact fingerprints across records.

## Compliance boundaries built in

- **Google Maps Platform terms:** only place IDs are stored. Places phone numbers and websites are used transiently; stored contacts come from the business's own website.
- **Search:** Google Custom Search JSON API is closed to new customers and ends on 1 Jan 2027, so it isn't used.
- **LinkedIn:** its User Agreement prohibits automated access. The system only generates a search link; a human records what they saw through the manual evidence form.
- **Personal data:** only organisation-published business contacts are extracted. Named staff emails are labelled `named_email` so a reviewer can decide. Private individuals' numbers are not targeted.
- **Calling:** TRAI TCCCPR governs commercial communications over telecom networks. Every call log requires a DND/NCPR and calling-policy confirmation, which is enforced by both the API and a database CHECK constraint. "Asked not to be called" creates a permanent suppression. Have the calling script and process reviewed by Indian counsel before scaling.

## Call queue rules

- **Included:** phone contacts on non-test referral-partner or corporate prospects with commercial fit ≥50, or numbers supplied in an inbound request.
- **Excluded:** suppressed, stale, invalid, wrong-number, do-not-call, not-interested or meeting-booked numbers, and anything called in the last 14 days.
- **Priority:** 0.6 × fit + 0.25 × identity confidence + 15 if corroborated + 25 for inbound requesters + 3 for a fixed business line − 8 per earlier attempt.

## Cost

- Places Text Search with website and phone fields is billed at the Enterprise SKU: 1,000 free requests a month, then $35 per 1,000.
- Defaults: 8 searches a day (about 240 a month, inside the free allowance) and a hard cap of 30 a day, enforced atomically in `provider_usage`.
- Crawling, MX checks and scoring add no API cost.

## Combined design (2 Nov 2026)

- **Primary system (kept):** worker and job processing, first-party extraction, security, verification, reporting and the call queue, plus the tested security, deduplication, scoring and sales tracking.
- **Google Places connector (`src/lib/discovery/places.ts`):**
  - Text Search with optional pagination (`DISCOVERY_PAGES_PER_QUERY`, up to 3 pages).
  - Place Details re-requested by stored place ID.
  - Listing-to-website matching for seeded sites, accepted only when the listing's website domain matches the business's own domain.
  - Every call is capped per day by an atomic counter.
- **Independent business-phone cross-check (`src/lib/discovery/crosscheck.ts`):**
  - Source 1 is the number published on the business's website, stored with its page and excerpt. Source 2 is the business's Google listing.
  - A match makes the contact `verified` and `corroborated`. A previously corroborated number that stops matching is demoted.
  - Runs daily (`verify.crosscheck_daily`) for up to `CROSSCHECK_PROSPECTS_PER_DAY` businesses not checked in 30 days, highest commercial fit first. Also available as "Cross-check now" on each prospect page.

### Google terms boundary (enforced in code and tests)

- Stored from Google: place IDs and the match outcome only (`match`, `no_match`, `no_listing_phone`, `no_listing`).
- Never stored: Google's phone number, website, name or address. An integration test asserts that the listing's digits do not appear in any verification record.
- Stored contacts always come from the business's own website.

### Cost

- Place Details with the phone field is Enterprise tier: 1,000 free requests a month, then about $20 per 1,000.
- Defaults are 15 cross-checks a day with a hard cap of 25, so typical monthly use (about 450 discovery-time and refresh checks combined) stays within the free allowance.

## 6 Nov 2026 corrections

- Phone match outcomes are now shown as **"independently corroborated"**, never a bare "verified". See `docs/RELEASE-GATES.md` for the full ladder.
- **Call queue order:** follow-ups due first; then people supplied by an enquiry; then human-confirmed or corroborated numbers; then by commercial fit.
- **Excluded from the queue:** active, paused or declined partners, and numbers scheduled for a future follow-up.
