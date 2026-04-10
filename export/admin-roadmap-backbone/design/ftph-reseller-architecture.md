# FTPH Reseller Architecture and Subscription Billing Closure
**FTPH Functional Units:** 10.4.1–10.4.5, 10.5.1–10.5.5
**Status:** Implementation-ready delivery slices — pending sprint allocation

---

## Current State

The platform has:
- Multi-association data model (all data scoped by `association_id`)
- Google OAuth sign-in for admin users
- OTP email sign-in for owner portal users
- Stripe hosted checkout (`/api/portal/payments/link/:token/checkout-session`) for owner dues payments
- No subscription/SaaS billing for the platform itself
- No reseller/white-label tenant isolation
- No platform-control tier enforcement

---

## 10.4 — Reseller / Multi-Tenant Platform Control

### 10.4.1 — Tenant Schema

```sql
CREATE TABLE tenants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE NOT NULL,      -- URL prefix or subdomain key
  name            TEXT NOT NULL,
  plan_id         VARCHAR REFERENCES subscription_plans(id),
  status          TEXT NOT NULL DEFAULT 'trial',  -- trial/active/suspended/cancelled
  branding        JSONB,                     -- {logoUrl, primaryColor, companyName, supportEmail}
  created_at      TIMESTAMP DEFAULT NOW(),
  trial_ends_at   TIMESTAMP,
  suspended_at    TIMESTAMP
);

-- Associate existing associations with a tenant
ALTER TABLE associations ADD COLUMN tenant_id UUID REFERENCES tenants(id);
```

**Platform-admin route:** `GET/POST /api/platform/tenants`, `PATCH /api/platform/tenants/:id`

### 10.4.2 — White-Label Branding

Branding resolution order: tenant.branding → platform defaults.

**Branding fields:**
- `companyName` — replaces "CondoManager" in email subjects, portal header
- `logoUrl` — replaces CondoManager logo in portal and email templates
- `primaryColor` — CSS variable override for portal (`--color-primary`)
- `supportEmail` — reply-to in all outbound emails for tenant
- `customDomain` — optional CNAME (e.g. `portal.acmerealty.com`) — requires DNS setup outside platform

**Implementation:**
- `GET /api/portal/association` already returns association data — extend to include resolved branding
- Email templates already use `sendPlatformEmail()` — add `tenantBranding` param to override sender name/reply-to
- Owner portal reads branding from `/api/portal/association` and applies CSS variables on mount

### 10.4.3 — Feature Gates

```ts
const PLAN_FEATURES = {
  starter:    ["portal", "notices", "work-orders"],
  pro:        ["portal", "notices", "work-orders", "financials", "governance", "ai-ingestion"],
  enterprise: ["portal", "notices", "work-orders", "financials", "governance", "ai-ingestion",
               "api-keys", "webhooks", "white-label", "custom-domain"],
};
```

Gate enforcement middleware:
```ts
function requireFeature(feature: string) {
  return async (req, res, next) => {
    const tenant = await resolveTenant(req);
    const plan = PLAN_FEATURES[tenant?.plan ?? "starter"] ?? [];
    if (!plan.includes(feature)) return res.status(402).json({ message: "Feature not available on current plan" });
    next();
  };
}
```

Apply to: `/api/admin/api-keys` (requires `api-keys`), `/api/admin/webhook-endpoints` (requires `webhooks`), AI ingestion routes (requires `ai-ingestion`).

### 10.4.4 — Reseller Accounts

```sql
CREATE TABLE resellers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  commission_pct NUMERIC(5,2) DEFAULT 0,
  api_key_hash TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

ALTER TABLE tenants ADD COLUMN reseller_id UUID REFERENCES resellers(id);
```

Reseller API: `POST /api/reseller/tenants` — provision a new tenant (association group) under reseller; returns tenant slug and initial admin invite token.

Commission tracking: `reseller_billing_events` table records per-tenant monthly revenue share; payout handled externally (v1).

### 10.4.5 — Tenant Isolation Audit

Before GA, run isolation audit:
- Every DB query against association-scoped tables MUST include `associationId` filter
- `assertAssociationScope` is already applied on all write routes
- Add: tenant-level assertion for platform-admin routes — verify `req.tenant` matches queried `tenant_id`
- Audit log table: `tenant_access_events` — who accessed which tenant, when (for compliance)

---

## 10.5 — Subscription Billing Closure

### 10.5.1 — Subscription Plans

```sql
CREATE TABLE subscription_plans (
  id              VARCHAR PRIMARY KEY,      -- 'starter', 'pro', 'enterprise'
  name            TEXT NOT NULL,
  price_monthly   INTEGER NOT NULL,         -- cents
  price_annual    INTEGER,                  -- cents/year (optional discount)
  stripe_price_id TEXT,                     -- Stripe Price ID for the plan
  unit_limit      INTEGER,                  -- max units per association (null = unlimited)
  association_limit INTEGER,                -- max associations per tenant
  features        TEXT[] NOT NULL DEFAULT '{}'
);
```

Seed: starter ($0 trial), pro ($49/mo), enterprise (custom/contact).

### 10.5.2 — Stripe Billing Integration

Platform already uses Stripe for owner payment collection. Extend for SaaS billing:

- `POST /api/platform/tenants/:id/subscribe` — create Stripe Subscription for tenant
  - Requires `stripe_customer_id` on tenant (create Stripe Customer if absent)
  - Creates Stripe Subscription for selected plan's `stripe_price_id`
  - On success: set `tenant.status = 'active'`, store `stripe_subscription_id`

- `POST /api/webhooks/platform-billing` — handle Stripe subscription webhook events:
  - `invoice.payment_succeeded` → confirm active
  - `invoice.payment_failed` → set `status = 'past_due'`, send warning email
  - `customer.subscription.deleted` → set `status = 'cancelled'`, restrict access

### 10.5.3 — Trial and Grace Period

- On tenant creation: `trial_ends_at = NOW() + 14 days`
- `tenant.status = 'trial'` bypasses billing checks
- 3 days before trial end: send conversion email via email provider
- Day of expiry: `status = 'trial_expired'` — read-only mode (portal still works, admin writes blocked)
- Grace period: 7 days before full suspension

### 10.5.4 — Billing Portal (Admin UI)

Admin sidebar: **Billing** (tenant-admin only).

Pages:
- **Current Plan** — plan name, features, unit/association counts vs limits
- **Usage** — units under management, API calls this month, storage used
- **Upgrade / Change Plan** — hosted Stripe Customer Portal link (`POST /api/platform/billing-portal` → Stripe `billingPortal.sessions.create`)
- **Invoices** — list from Stripe API

### 10.5.5 — Usage Enforcement

Hard limits at plan boundaries:
- Unit limit: `POST /api/units` checks `count(*) < plan.unit_limit` — returns 402 with upgrade prompt if exceeded
- Association limit: `POST /api/associations` similarly gated
- API key limit: `starter` = 0 keys, `pro` = 3 keys, `enterprise` = unlimited
- Soft limit alerting: at 80% of limit, add `X-Quota-Warning` header on relevant responses

Usage metering: track `monthly_unit_count`, `monthly_api_calls` in `tenant_usage_snapshots` table — snapshot on 1st of each month via automation sweep.
