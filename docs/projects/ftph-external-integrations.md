# FTPH External Integrations — Banking, Accounting, Identity
**FTPH Functional Units:** 10.1.1–10.1.5, 10.2.2–10.2.5
**Status:** Implementation-ready delivery slices — pending sprint allocation

---

## Current State

The platform has:
- Stripe for owner payment collection (hosted checkout + ACH)
- Google OAuth for admin sign-in only (10.2.1 — complete)
- Manual bank statement ingestion via AI ingestion engine
- No live banking feed (Plaid/TrueLayer)
- No accounting sync (QuickBooks/Xero)
- No non-Google SSO (Microsoft, SAML)

---

## Delivery Priority Order

1. **10.1.1** Plaid banking feed (highest operational value — replaces manual upload)
2. **10.1.2** QuickBooks Online sync (finance team demand)
3. **10.2.2** Microsoft SSO (common for property management firms on M365)
4. **10.1.3** Xero sync (secondary accounting, international)
5. **10.2.3** SAML/SSO enterprise (enterprise plan gating)
6. **10.1.4** Twilio SMS channel (communications expansion)
7. **10.2.4** Apple Sign-In (owner portal mobile)
8. **10.1.5** DocuSign/HelloSign bridge
9. **10.2.5** Passwordless magic link (owner portal alternate)

---

## 10.1.1 — Plaid Bank Feed

**Purpose:** Replace manual bank statement upload with live transaction sync for owner ledger reconciliation.

**Flow:**
1. Admin connects association bank account via Plaid Link (hosted OAuth widget)
2. Platform stores `access_token` (encrypted), `item_id`, `account_id` in `plaid_connections` table
3. Plaid sends transaction webhook → platform upserts to `plaid_transactions` staging table
4. Transactions appear in the AI ingestion review queue as `bank-statement` records — same review/import flow as manual uploads

**Schema:**
```sql
CREATE TABLE plaid_connections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id  VARCHAR REFERENCES associations(id),
  item_id         TEXT UNIQUE NOT NULL,
  access_token    TEXT NOT NULL,        -- encrypted at rest
  account_id      TEXT NOT NULL,
  institution_name TEXT,
  cursor          TEXT,                 -- Plaid sync cursor
  last_synced_at  TIMESTAMP,
  status          TEXT DEFAULT 'active',
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE plaid_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id   UUID REFERENCES plaid_connections(id),
  plaid_txn_id    TEXT UNIQUE NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  date            DATE NOT NULL,
  name            TEXT,
  category        TEXT[],
  pending         BOOLEAN DEFAULT false,
  reviewed        BOOLEAN DEFAULT false,
  ingestion_job_id UUID REFERENCES ai_ingestion_jobs(id),
  created_at      TIMESTAMP DEFAULT NOW()
);
```

**Routes:**
- `POST /api/integrations/plaid/link-token` — create Plaid Link token for frontend widget
- `POST /api/integrations/plaid/exchange-token` — exchange public token → access token, store connection
- `GET /api/integrations/plaid/connections` — list connections for association
- `DELETE /api/integrations/plaid/connections/:id` — disconnect, revoke Plaid access token
- `POST /api/webhooks/plaid` — handle `TRANSACTIONS_SYNC_UPDATES_AVAILABLE` → trigger sync

**Environment variables needed:** `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` (sandbox/production)

---

## 10.1.2 — QuickBooks Online Sync

**Purpose:** Push owner ledger entries and vendor invoices to QBO for accountant access.

**Flow:**
- One-way push: CondoManager → QBO (authoritative source remains CondoManager)
- Association admin connects QBO via OAuth 2.0
- On financial events (invoice approved, payment received, charge posted) → create/update QBO object via QBO API

**Schema:**
```sql
CREATE TABLE qbo_connections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id  VARCHAR REFERENCES associations(id),
  realm_id        TEXT UNIQUE NOT NULL,     -- QBO company ID
  access_token    TEXT NOT NULL,            -- encrypted
  refresh_token   TEXT NOT NULL,            -- encrypted
  token_expires_at TIMESTAMP,
  status          TEXT DEFAULT 'active',
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE qbo_sync_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES qbo_connections(id),
  entity_type TEXT NOT NULL,   -- 'Invoice', 'Payment', 'Customer'
  entity_id   TEXT NOT NULL,   -- CondoManager internal ID
  qbo_id      TEXT,
  action      TEXT NOT NULL,   -- 'create'/'update'/'delete'
  status      TEXT NOT NULL,   -- 'success'/'error'
  error_msg   TEXT,
  synced_at   TIMESTAMP DEFAULT NOW()
);
```

**Sync triggers:**
- Vendor invoice approved → create QBO Invoice
- Owner payment received → create QBO Payment against Customer
- Recurring charge posted → create QBO Invoice

**Routes:**
- `GET /api/integrations/qbo/auth-url` — return QBO OAuth URL
- `GET /api/integrations/qbo/callback` — handle OAuth redirect, store tokens
- `GET /api/integrations/qbo/connections` — list/status
- `POST /api/integrations/qbo/sync-now` — manual full sync
- `DELETE /api/integrations/qbo/connections/:id` — disconnect

**Environment variables needed:** `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_REDIRECT_URI`

---

## 10.1.3 — Xero Sync

Same architecture as QBO — swap QBO API calls for Xero API. Shared `accounting_sync_log` table with `provider` field (`'qbo'|'xero'`). Limit to one active accounting connection per association.

**Environment variables needed:** `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`

---

## 10.1.4 — Twilio SMS Channel

**Purpose:** Add SMS as a delivery channel alongside email for notices, reminders, OTP.

**Schema addition:**
```sql
ALTER TABLE persons ADD COLUMN sms_opted_in BOOLEAN DEFAULT false;
ALTER TABLE persons ADD COLUMN sms_opted_in_at TIMESTAMP;
```

**`sendSms(to, body)` function in `sms-provider.ts`** — mirrors `email-provider.ts` pattern:
- Uses Twilio REST API if `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_FROM_NUMBER` configured
- Falls back to simulation (logs message, returns `status: 'simulated'`)

**Integration points:**
- Notice sends: extend `noticeSends` with `channel: 'email'|'sms'`; governance reminder rules get `channelPreference` field
- OTP login: if resident has phone + `sms_opted_in`, offer SMS OTP alternative
- Work order status changes: optional SMS notification to requesting owner

**Environment variables needed:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`

---

## 10.1.5 — DocuSign / HelloSign Bridge

The platform already implements digital signature natively (FTPH 9.3). The external bridge is needed only for associations that have existing DocuSign/HelloSign contracts.

**Architecture:** Thin adapter in `signature-provider.ts`:
```ts
interface SignatureProvider {
  sendForSignature(params: SignatureRequest): Promise<{ externalId: string; signingUrl: string }>;
  getStatus(externalId: string): Promise<{ status: 'pending'|'completed'|'declined' }>;
}
```

Implementations: `NativeSignatureProvider` (9.3 implementation), `DocuSignProvider`, `HelloSignProvider`.

Association-level setting: `signatureProvider: 'native'|'docusign'|'hellosign'`.

**Environment variables needed:** `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_ACCOUNT_ID` or `HELLOSIGN_API_KEY`

---

## 10.2.2 — Microsoft Entra ID (Azure AD) SSO

**Purpose:** Admin sign-in via Microsoft work accounts — common for management firms on M365.

**Flow:** OAuth 2.0 PKCE with Microsoft identity platform (v2 endpoint).

**Implementation:**
- Add `microsoft` as a provider option alongside `google` in `admin_users.authProvider`
- `GET /api/auth/microsoft/url` — return Microsoft OAuth URL
- `GET /api/auth/microsoft/callback` — exchange code → access token → fetch user profile → upsert `admin_users`
- Session creation identical to Google OAuth flow

**Environment variables needed:** `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT` (or 'common' for multi-tenant)

---

## 10.2.3 — SAML / Enterprise SSO

**Purpose:** Enterprise plan feature — allow management firms to use their own IdP (Okta, OneLogin, ADFS).

**Architecture:** Use `passport-saml` or `node-saml`:
- Per-tenant SAML configuration stored in `saml_configurations` table: `entityId`, `ssoUrl`, `certificate`, `attributeMap`
- SP metadata endpoint: `GET /api/auth/saml/:tenantSlug/metadata`
- ACS endpoint: `POST /api/auth/saml/:tenantSlug/callback`
- Gate behind `enterprise` plan feature flag

---

## 10.2.4 — Apple Sign-In

**Purpose:** Owner portal mobile — Apple requires Sign-in with Apple for apps with social login.

**Scope:** Owner portal only (not admin). Uses Apple's OAuth 2.0 flow.
- `GET /api/portal/auth/apple/url`
- `POST /api/portal/auth/apple/callback`
- On success: upsert portal session same as OTP flow

**Environment variables needed:** `APPLE_CLIENT_ID`, `APPLE_KEY_ID`, `APPLE_TEAM_ID`, `APPLE_PRIVATE_KEY`

---

## 10.2.5 — Passwordless Magic Link (Owner Portal)

**Purpose:** Alternative to OTP for owners who prefer a click-through link over a code.

**Implementation:** Already nearly implemented — extend the OTP flow:
- On `POST /api/portal/request-login`, if `deliveryMethod: 'link'`:
  - Generate signed JWT (15min expiry) instead of 6-digit OTP
  - Send email with `https://{domain}/portal/magic?token={jwt}`
  - `GET /api/portal/verify-magic?token=` — validate JWT, create session
- No new DB table needed — same `portal_login_tokens` table, `tokenType: 'otp'|'magic-link'`

---

## Integration Configuration UI (Admin)

Admin sidebar: **Integrations** page — cards for each provider:
- Status badge: Connected / Not configured / Error
- Connect / Disconnect button
- Last sync timestamp where applicable
- Deep link to provider's dashboard

Gate visibility by plan: Plaid/QBO/Xero visible on pro+, SAML on enterprise only.
