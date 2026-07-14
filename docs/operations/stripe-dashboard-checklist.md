# Stripe Dashboard Checklist — YourCondoManager (William, ~5 min)

> Everything the API can't set on your own platform account (Stripe locks branding/invoice/business fields to the dashboard). Prepared 2026-06-30. Account: platform `acct_1TFH9pAoad3tIYtu` (live).
> Already done for you via API: 9 coupons + 9 promo codes, customer billing portal, Klarna/BNPL removed, ACH (bank debit) turned on, Connect webhook upgraded, logo uploaded to Stripe.

## 1. Branding — Settings → Business → Branding
- **Logo + Icon:** set to the uploaded YCM mark (`file_1TnyyTAoad3tIYtu8prDoaGz`, or upload `client/public/brand/ycm-logo-canonical.png`).
- **Brand color:** `#014D4A` · **Accent:** `#2DBDB0`.
- *(This also brands the HOA Connect onboarding screen.)*

## 2. Public details — Settings → Business
- **Support email:** `support@yourcondomanager.org`
- **Support URL:** `https://yourcondomanager.org`

## 3. Invoice template — Settings → Billing → Invoices
- **Default footer:** e.g. *"Payment due upon receipt. Thank you for your business. Questions: support@yourcondomanager.org"*
- **Default memo:** HOA-appropriate language.
- Toggle **logo on invoices** ON.

## 4. Customer emails — Settings → Billing → Customer emails
- Toggle Stripe-sent **receipts** + **invoice/payment-failure emails** if you want Stripe to send them (you also have app-side emails via Resend now).

## 5. Connect loss liability — Settings → Connect → (loss settings)  *(best practice)*
- Assign **connected-account negative-balance liability to Stripe** for Standard direct-charge accounts, so an HOA refunding into a negative balance isn't yours to chase.

## 6. Stripe Tax — Settings → Tax  *(SaaS side only, lower urgency)*
- Currently **pending**. Enable if you want automatic sales tax on the **subscription** plans (HOA dues are not a taxable sale, so this is for the SaaS billing only). Complete origin address + enable `automatic_tax`.

---
**Not on your plate (handled / in progress by agents):** coupons, promo codes, billing portal, Klarna removal, ACH-on, Connect webhook, refunds + idempotency + ACH-return hardening, per-tenant email aliases, community URLs.
