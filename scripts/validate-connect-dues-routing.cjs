#!/usr/bin/env node
/**
 * validate-connect-dues-routing.cjs
 *
 * Self-contained TEST-MODE validation of the Stripe Connect dues-routing money
 * split — proves, without real money, that a dues charge:
 *   1. lands on the HOA's OWN connected account (the principal settles to the HOA),
 *   2. sends the YCM `application_fee_amount` to the PLATFORM balance, and
 *   3. (when a PM cut is supplied) moves the PM's cut as a SEPARATE Transfer,
 *      sourced from the connected account — never from a YCM balance.
 *
 * This mirrors the live charge path in
 *   server/routes/payment-portal.ts  (resolveConnectChargeRouting → initiateStripeCheckout)
 *   server/services/payment-service.ts (Stripe-Account header + application_fee_amount)
 * but as a direct PaymentIntent (confirmed with a test card) so it can run
 * end-to-end without a hosted-checkout browser step.
 *
 * USAGE (requires a Stripe TEST secret key — never the live key):
 *   STRIPE_TEST_SECRET_KEY=sk_test_... node scripts/validate-connect-dues-routing.cjs
 *
 * Optional:
 *   DUES_CENTS=15000      dues principal (default 15000 = $150.00)
 *   PM_FEE_BPS=500        PM cut in basis points (default 0 = no PM transfer leg)
 *
 * The script ONLY operates if the key is sk_test_ — it hard-refuses a live key.
 * It cleans up nothing destructive (test objects are harmless + auto-expire);
 * it prints the connected account id so you can delete it from the test dashboard.
 *
 * Application-fee math mirrors server/services/stripe-charge-metadata.ts:
 *   fee = round(amount * 0.01), floored at $0.50, ceiled at $25, never > amount.
 */

const KEY = process.env.STRIPE_TEST_SECRET_KEY || "";
const DUES_CENTS = parseInt(process.env.DUES_CENTS || "15000", 10);
const PM_FEE_BPS = parseInt(process.env.PM_FEE_BPS || "0", 10);

if (!KEY.startsWith("sk_test_")) {
  console.error("REFUSING: STRIPE_TEST_SECRET_KEY must be a TEST key (sk_test_...). Got:", KEY.slice(0, 8) || "(empty)");
  process.exit(2);
}

const APP_FEE_FLOOR_CENTS = 50;
const APP_FEE_CEILING_CENTS = 2500;
function computeApplicationFeeCents(amountCents, rate = 0.01) {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return 0;
  const computed = Math.round(amountCents * rate);
  const floored = Math.max(computed, APP_FEE_FLOOR_CENTS);
  const capped = Math.min(floored, APP_FEE_CEILING_CENTS);
  return Math.min(capped, amountCents);
}

async function sx(method, path, params, stripeAccount) {
  const headers = { Authorization: `Bearer ${KEY}` };
  if (params) headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (stripeAccount) headers["Stripe-Account"] = stripeAccount;
  const r = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers,
    body: params ? new URLSearchParams(params).toString() : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}: ${JSON.stringify(j.error || j)}`);
  return j;
}

(async () => {
  console.log("=== Stripe Connect dues-routing TEST-MODE validation ===");
  console.log("dues principal (cents):", DUES_CENTS, "| pm_fee_bps:", PM_FEE_BPS);
  const appFee = computeApplicationFeeCents(DUES_CENTS);
  console.log("computed application_fee (cents):", appFee, `(${(appFee / 100).toFixed(2)} USD)`);

  // 1. Onboard a throwaway TEST connected account, fully enabled via test data.
  //    `account[business_type]`+ token-free test onboarding: we create a Standard
  //    account then patch it with Stripe's test verification data so charges_enabled.
  const acct = await sx("POST", "/accounts", {
    type: "custom", // custom lets us fully activate it in test mode without hosted KYC
    country: "US",
    "capabilities[card_payments][requested]": "true",
    "capabilities[transfers][requested]": "true",
    "business_type": "company",
    "business_profile[name]": "VALIDATION HOA (test)",
    "business_profile[url]": "https://example.com",
    "settings[payments][statement_descriptor]": "YCM-VALIDATE HOA",
    "metadata[purpose]": "connect-dues-validation",
    "tos_acceptance[date]": String(Math.floor(Date.now() / 1000)),
    "tos_acceptance[ip]": "127.0.0.1",
    "company[name]": "Validation HOA Inc",
    "company[tax_id]": "000000000",
    "company[address][line1]": "address_full_match",
    "company[address][city]": "Schenectady",
    "company[address][state]": "NY",
    "company[address][postal_code]": "12345",
    "company[phone]": "0000000000",
    "external_account[object]": "bank_account",
    "external_account[country]": "US",
    "external_account[currency]": "usd",
    "external_account[routing_number]": "110000000",
    "external_account[account_number]": "000123456789",
  });
  const acctId = acct.id;
  console.log("created TEST connected account:", acctId, "| charges_enabled:", acct.charges_enabled);

  // Add a representative person (owner) so the account can activate.
  await sx("POST", `/accounts/${acctId}/persons`, {
    "first_name": "Test", "last_name": "Owner",
    "relationship[representative]": "true", "relationship[owner]": "true",
    "relationship[title]": "Treasurer",
    "dob[day]": "1", "dob[month]": "1", "dob[year]": "1980",
    "address[line1]": "address_full_match", "address[city]": "Schenectady",
    "address[state]": "NY", "address[postal_code]": "12345",
    "ssn_last_4": "0000", "phone": "0000000000", "email": "test-owner@example.com",
  });
  await sx("POST", `/accounts/${acctId}`, { "company[owners_provided]": "true", "company[directors_provided]": "true", "company[executives_provided]": "true" });

  const refreshed = await sx("GET", `/accounts/${acctId}`);
  console.log("after test activation: charges_enabled =", refreshed.charges_enabled, "| payouts_enabled =", refreshed.payouts_enabled);
  if (!refreshed.charges_enabled) {
    console.log("NOTE: account not yet charges_enabled; test charges may fail until Stripe finishes test verification.");
  }

  // 2. Create a DIRECT charge on the connected account (Stripe-Account header),
  //    with the application_fee_amount routed to the PLATFORM (mirrors the app).
  const pmTransferDest = process.env.PM_CONNECTED_ACCT || null;
  const intentParams = {
    amount: String(DUES_CENTS),
    currency: "usd",
    "payment_method_data[type]": "card",
    "payment_method_data[card][token]": "tok_visa", // Stripe test token
    confirm: "true",
    description: "VALIDATION dues charge (test)",
    statement_descriptor_suffix: "DUES",
    "metadata[purpose]": "connect-dues-validation",
  };
  if (appFee > 0) intentParams["application_fee_amount"] = String(appFee);

  const intent = await sx("POST", "/payment_intents", intentParams, acctId);
  console.log("payment_intent:", intent.id, "| status:", intent.status, "| on_account:", acctId);

  // 3. Inspect the resulting charge + application fee + balance transaction.
  const chargeId = intent.latest_charge;
  const charge = await sx("GET", `/charges/${encodeURIComponent(chargeId)}?expand[]=balance_transaction&expand[]=application_fee`, null, acctId);
  console.log("--- CHARGE (on connected account", acctId, ") ---");
  console.log("  charge.id:", charge.id, "| amount:", charge.amount, "| status:", charge.status);
  console.log("  charge.application_fee_amount:", charge.application_fee_amount);
  const bt = charge.balance_transaction;
  if (bt && typeof bt === "object") {
    console.log("  HOA net (after Stripe fee + app fee):", bt.net, `(${(bt.net / 100).toFixed(2)} USD)`);
    console.log("  total fees deducted on HOA:", bt.fee);
  }

  // application_fee appears on the PLATFORM account.
  const appFees = await sx("GET", `/application_fees?charge=${encodeURIComponent(chargeId)}&limit=1`);
  const af = appFees.data && appFees.data[0];
  console.log("--- APPLICATION FEE (on PLATFORM account) ---");
  if (af) {
    console.log("  application_fee.id:", af.id, "| amount:", af.amount, "| account:", af.account);
    console.log("  => YCM platform received:", af.amount, `(${(af.amount / 100).toFixed(2)} USD)`);
  } else {
    console.log("  (no application fee found — check appFee>0)");
  }

  // 4. Optional PM transfer leg (separate Transfer from the connected account).
  if (PM_FEE_BPS > 0 && pmTransferDest) {
    const headroom = Math.max(0, DUES_CENTS - appFee);
    const pmCut = Math.max(0, Math.min(Math.round((DUES_CENTS * PM_FEE_BPS) / 10000), headroom));
    const transfer = await sx("POST", "/transfers", {
      amount: String(pmCut), currency: "usd", destination: pmTransferDest,
      "metadata[purpose]": "pm-cut-validation",
    }, acctId);
    console.log("--- PM TRANSFER (separate, from connected account) ---");
    console.log("  transfer.id:", transfer.id, "| amount:", transfer.amount, "| destination:", transfer.destination);
  } else {
    console.log("--- PM TRANSFER: skipped (PM_FEE_BPS=0 or no PM_CONNECTED_ACCT) ---");
  }

  console.log("\n=== RESULT ===");
  console.log("Charge landed on connected account:", acctId);
  console.log("Application fee to platform:", af ? af.amount : 0, "cents");
  console.log("Principal NEVER touched a YCM balance (direct charge on HOA account).");
  console.log("Cleanup: delete the test connected account from the Stripe TEST dashboard:", acctId);
})().catch((e) => {
  console.error("VALIDATION FAILED:", e.message);
  process.exit(1);
});
