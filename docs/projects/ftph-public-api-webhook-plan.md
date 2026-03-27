# FTPH Public API and Webhook Delivery Plan
**FTPH Functional Units:** 10.3.1–10.3.5
**Status:** Implementation-ready delivery slices — pending sprint allocation

---

## Current State

The platform has:
- Internal admin API (`/api/...`) behind `requireAdmin` + role guards
- Owner portal API (`/api/portal/...`) behind `requirePortal` (OTP session)
- Stripe payment webhooks at `/api/webhooks/payments`
- Webhook secret management: `webhook_secrets` table + `GET/POST /api/admin/webhook-secrets`
- No public API key system, no outbound webhooks, no developer portal

---

## 10.3.1 — API Key Management

**Schema additions:**
```sql
CREATE TABLE api_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id  VARCHAR REFERENCES associations(id),
  name        TEXT NOT NULL,
  key_prefix  TEXT NOT NULL,          -- e.g. "cm_live_"
  key_hash    TEXT NOT NULL,          -- SHA-256 of full key (never stored plain)
  scopes      TEXT[] NOT NULL DEFAULT '{}',  -- ["read:owners","write:work-orders",...]
  environment TEXT NOT NULL DEFAULT 'live',  -- 'live' | 'test'
  last_used_at TIMESTAMP,
  expires_at  TIMESTAMP,
  revoked_at  TIMESTAMP,
  created_by  TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);
```

**Routes:**
- `GET /api/admin/api-keys` — list keys for association (prefix + scopes only, never full key)
- `POST /api/admin/api-keys` — create key, return full key once only
- `PATCH /api/admin/api-keys/:id/revoke` — revoke
- `DELETE /api/admin/api-keys/:id` — delete

**Auth middleware:**
```ts
async function requireApiKey(req, res, next) {
  const bearer = req.headers.authorization?.replace("Bearer ", "");
  if (!bearer) return next(); // fall through to session auth
  const prefix = bearer.slice(0, 12);
  const hash = sha256(bearer);
  const [key] = await db.select().from(apiKeys)
    .where(and(eq(apiKeys.keyPrefix, prefix), eq(apiKeys.keyHash, hash), isNull(apiKeys.revokedAt)));
  if (!key) return res.status(401).json({ message: "Invalid API key" });
  req.apiKey = key;
  req.associationId = key.associationId;
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id));
  next();
}
```

---

## 10.3.2 — Public REST Resources (v1)

Base path: `/api/v1/` — accepts API key bearer token.

**Scope-gated read endpoints (initial set):**

| Endpoint | Scope | Description |
|---|---|---|
| `GET /api/v1/owners` | `read:owners` | Active ownerships with person name + unit |
| `GET /api/v1/units` | `read:units` | Unit list for association |
| `GET /api/v1/persons` | `read:persons` | Person directory |
| `GET /api/v1/work-orders` | `read:work-orders` | Work order list |
| `GET /api/v1/work-orders/:id` | `read:work-orders` | Single work order |
| `GET /api/v1/financial/accounts` | `read:financials` | Financial account balances |
| `GET /api/v1/notices` | `read:notices` | Sent notice history |
| `POST /api/v1/work-orders` | `write:work-orders` | Create work order |
| `PATCH /api/v1/work-orders/:id` | `write:work-orders` | Update status/assignment |

All v1 routes return `{ data: [...], meta: { associationId, page, perPage, total } }`.

Rate limiting: 120 req/min per API key via `express-rate-limit` keyed on `req.apiKey.id`.

---

## 10.3.3 — Webhook Framework

**Outbound webhooks — schema:**
```sql
CREATE TABLE webhook_endpoints (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id  VARCHAR REFERENCES associations(id),
  url             TEXT NOT NULL,
  events          TEXT[] NOT NULL,   -- ["owner.created","work_order.updated",...]
  secret          TEXT NOT NULL,     -- HMAC signing secret (stored encrypted)
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE webhook_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id     UUID REFERENCES webhook_endpoints(id),
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending/delivered/failed
  attempts        INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMP,
  response_status INTEGER,
  response_body   TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);
```

**Dispatch function:**
```ts
async function dispatchWebhook(associationId: string, eventType: string, payload: object) {
  const endpoints = await db.select().from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.associationId, associationId),
               eq(webhookEndpoints.isActive, true),
               sql`${webhookEndpoints.events} @> ARRAY[${eventType}]::text[]`));
  for (const ep of endpoints) {
    const body = JSON.stringify({ event: eventType, data: payload, timestamp: new Date().toISOString() });
    const sig = `sha256=${hmacSha256(ep.secret, body)}`;
    // Queue delivery (attempt inline, retry via sweep)
    await db.insert(webhookDeliveries).values({ endpointId: ep.id, eventType, payload, status: "pending" });
    attemptWebhookDelivery(ep, body, sig);
  }
}
```

Events to instrument (initial set):
`owner.created`, `owner.updated`, `work_order.created`, `work_order.status_changed`, `payment.received`, `notice.sent`, `meeting.scheduled`

**Admin routes:**
- `GET/POST /api/admin/webhook-endpoints`
- `PATCH/DELETE /api/admin/webhook-endpoints/:id`
- `GET /api/admin/webhook-endpoints/:id/deliveries` — delivery history + retry

---

## 10.3.4 — Webhook Retry and Delivery Health

Retry policy: exponential backoff — 1m, 5m, 30m, 2h, 24h (max 5 attempts).
Add to `runAutomationSweep()`:
```ts
await retryFailedWebhookDeliveries(); // process pending/failed with next_attempt_at <= now
```

Failure alerting: after 5 failed attempts, mark endpoint `consecutiveFailures++`; at 10, auto-disable and send platform alert to association admin.

---

## 10.3.5 — Developer Portal (Admin UI)

Admin sidebar section: **Developer** (visible to platform-admin only initially).

Pages:
- **API Keys** — list, create, revoke keys; show scopes, last used, expiry
- **Webhooks** — list endpoints, add/edit, view delivery log per endpoint, manual retry button
- **API Logs** — last 500 API key requests (endpoint, status, latency) — sourced from request middleware logging to `api_request_logs` table

No external developer portal URL needed for v1 — everything is in the existing admin UI.
