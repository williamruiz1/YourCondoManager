# FTPH Owner Experience Backlog — Amenity Booking, Digital Signature, Voting
**FTPH Functional Units:** 9.2.1–9.2.5, 9.3.1–9.3.5, 9.4.1–9.4.5
**Status:** Implementation-ready delivery slices — pending sprint allocation

---

## 9.2 — Amenity Booking

The owner portal currently has: payments, autopay, payment methods, announcements, documents, notices, contact updates, occupancy reporting. Amenity booking is absent.

### Delivery Slices

**9.2.1 — Amenity Registry (Admin)**
- DB table: `amenities` — id, associationId, name, description, location, capacity, bookingWindowDays, advanceNoticeMins, isActive
- Admin CRUD: `GET/POST /api/amenities`, `PATCH/DELETE /api/amenities/:id`
- Scoped to association (assertAssociationScope)

**9.2.2 — Availability Slots**
- DB table: `amenity_slots` — id, amenityId, startsAt, endsAt, maxConcurrent
- Recurring slot generator: admin can define weekly schedules; slots materialize 90 days out via automation sweep
- `GET /api/amenities/:id/slots?from=&to=` returns available slots with booking counts

**9.2.3 — Booking CRUD (Portal)**
- DB table: `amenity_bookings` — id, amenityId, slotId, personId, unitId, associationId, status (pending/confirmed/cancelled), guestCount, notes, createdAt
- `POST /api/portal/amenity-bookings` — creates booking, checks capacity, sends confirmation notice
- `GET /api/portal/amenity-bookings` — owner's upcoming bookings
- `DELETE /api/portal/amenity-bookings/:id` — cancellation with configurable cutoff window

**9.2.4 — Booking Review (Admin)**
- `GET /api/amenities/bookings` — admin view of all bookings with filters (amenityId, date range, status)
- `PATCH /api/amenities/bookings/:id/status` — approve/cancel with reason
- Optional: auto-confirm mode per amenity (no admin approval required)

**9.2.5 — Guest Management**
- Extend `amenity_bookings` with `guests: jsonb` — [{name, email}]
- Guest count vs capacity enforced at booking creation
- Notice send on booking confirmed includes guest list

---

## 9.3 — Digital Signature

Used for: lease addenda, bylaw acknowledgements, move-in/out checklists, rule acceptance.

### Delivery Slices

**9.3.1 — Document Signature Request (Admin)**
- DB table: `signature_requests` — id, associationId, documentId, title, requestedBy, dueDate, status (draft/sent/completed/expired)
- DB table: `signature_request_recipients` — id, requestId, personId, email, signingOrder, status (pending/signed/declined), signedAt, tokenHash
- `POST /api/signature-requests` — create request, attach document, assign recipients
- `POST /api/signature-requests/:id/send` — generates per-recipient tokens, sends signing links via email provider

**9.3.2 — Signing Flow (Tokenized, Unauthenticated)**
- `GET /api/sign/:token` — validate token, return document + field positions
- `POST /api/sign/:token/submit` — captures signature data (typed name + timestamp + IP + user-agent), marks recipient signed
- When all recipients signed: mark request completed, send completion notice to requestedBy

**9.3.3 — Signature Storage**
- DB table: `signature_audit_trail` — id, requestId, recipientId, action, ip, userAgent, timestamp, payloadHash
- Store signed document reference (PDF generation out of scope for v1 — store audit trail + signedAt only)

**9.3.4 — Portal Signing Queue**
- `GET /api/portal/signature-requests` — pending signature requests for logged-in owner
- Portal page: "Documents to Sign" — lists pending items, deep-links to signing flow

**9.3.5 — Completion Reporting (Admin)**
- `GET /api/signature-requests` with status filters
- Completion percent per request
- Reminder send: `POST /api/signature-requests/:id/remind` — resends to unsigned recipients

---

## 9.4 — Community Voting / Digital Proxy

Used for: board elections, bylaw amendments, special assessments, quorum polls.

### Delivery Slices

**9.4.1 — Vote Campaign (Admin)**
- DB table: `vote_campaigns` — id, associationId, title, description, voteType (election/resolution/poll), openAt, closeAt, quorumPercent, status, createdBy
- DB table: `vote_questions` — id, campaignId, questionText, choiceType (single/multi/yes-no), options: jsonb
- `POST /api/vote-campaigns`, `GET /api/vote-campaigns`
- `POST /api/vote-campaigns/:id/publish` — validates campaign, sends opening notice to eligible voters

**9.4.2 — Voter Eligibility**
- Eligible = active ownership in association at campaign open date
- Eligibility list computed from `ownerships` where endDate IS NULL or endDate >= openAt
- One vote per ownership unit (not per person) unless campaign sets `votePerOwner=true`
- DB table: `vote_ballots` — id, campaignId, unitId, personId, token, status (pending/cast), castAt

**9.4.3 — Ballot Submission (Tokenized)**
- `GET /api/vote/:token` — return campaign + questions for ballot
- `POST /api/vote/:token/submit` — validate eligibility, prevent double-vote, store answers
- DB table: `vote_answers` — id, ballotId, questionId, selectedOptions: jsonb, submittedAt, ip

**9.4.4 — Portal Voting**
- `GET /api/portal/vote-campaigns` — open campaigns for logged-in owner's units
- Portal page: "Community Votes" — list open and past campaigns, inline ballot for open ones

**9.4.5 — Results and Quorum Reporting (Admin)**
- `GET /api/vote-campaigns/:id/results` — vote counts per question/option, participation rate, quorum met Y/N
- Results visible after campaign closes or if admin previews early
- PDF-ready summary: total eligible, total cast, per-question breakdown

---

## Schema Migration Order

1. `amenities` → `amenity_slots` → `amenity_bookings`
2. `signature_requests` → `signature_request_recipients` → `signature_audit_trail`
3. `vote_campaigns` → `vote_questions` → `vote_ballots` → `vote_answers`

## Integration Points

- All booking/signing/voting confirmation notices route through `sendPlatformEmail()` (now live)
- Amenity bookings appear in automation sweep for reminder notices (extend `runScheduledNotices`)
- Signature request reminders: add `signature_reminder_rules` pattern mirroring `governance_reminder_rules`
- Vote campaigns: quorum check on close can trigger board package generation
