/**
 * Adds the "Plan Sign-Up & Subscription Billing" project to the admin roadmap.
 *
 * Scope: end-to-end flow for a prospect to select a plan on the pricing page,
 * complete a Stripe Checkout session, and land in a provisioned workspace —
 * plus the lifecycle management (trials, upgrades, dunning, cancellation).
 *
 * Leverages existing infrastructure where possible:
 *  - Platform secrets store (already handles Stripe keys per-association)
 *  - Stripe checkout session + webhook pattern (already implemented for owner payments)
 *  - AdminUser + Association creation (already done in NewAssociationPage / POST /api/admin/associations)
 *  - TenantConfig model (already exists)
 *  - Platform Controls page (already exists — billing tab will live here)
 */

import { db } from "../server/db";
import { roadmapProjects, roadmapWorkstreams, roadmapTasks } from "../shared/schema";

type TaskDef = {
  title: string;
  description: string;
  effort: "small" | "medium" | "large";
  priority: "low" | "medium" | "high" | "critical";
};

type WorkstreamDef = {
  title: string;
  description: string;
  orderIndex: number;
  tasks: TaskDef[];
};

const workstreams: WorkstreamDef[] = [
  // ── 1. Platform Stripe Configuration ─────────────────────────────────────
  {
    title: "Platform Stripe Configuration",
    description:
      "Set up the platform-level Stripe account (distinct from per-association payment gateways). Create Products and recurring Prices for each plan tier. Store the platform Stripe secret key, publishable key, and webhook signing secret in the existing platform secrets store. This workstream is a prerequisite for all others.",
    orderIndex: 0,
    tasks: [
      {
        title: "Add platform Stripe secret key to platform secrets store",
        description:
          "Extend the existing platform-secrets-store to support a dedicated platform Stripe key (PLATFORM_STRIPE_SECRET_KEY) separate from association-level Stripe gateway connections. Add a new 'Platform Billing' section to the Platform Controls page (platform-controls.tsx) where a platform-admin can paste in the Stripe secret key, publishable key, and webhook signing secret — mirroring the existing Twilio config card pattern. Store values via the existing setSecret() API.",
        effort: "small",
        priority: "critical",
      },
      {
        title: "Create Stripe Products and Prices for each plan tier",
        description:
          "In Stripe dashboard: create three Products (Self-Managed, Property Manager, Enterprise). For Self-Managed, create recurring monthly Prices for each unit-count tier (1-25 units: $99/mo, 26-75 units: $149/mo, 76+ units: $199/mo). For Property Manager, create a single $449/mo Price. Enterprise will use custom quotes (no Price needed). Record all Stripe Price IDs in environment config / platform secrets store so checkout sessions can reference them dynamically. Add a STRIPE_PLAN_PRICE_IDS config field (JSON map of plan slug → price ID) to the platform secrets store.",
        effort: "small",
        priority: "critical",
      },
      {
        title: "Register Stripe webhook endpoint for platform subscription events",
        description:
          "Add a new POST /api/webhooks/platform/stripe endpoint to server/routes.ts. Verify the webhook signature using the platform Stripe webhook secret (from platform secrets store) — follow the exact same HMAC-SHA256 pattern already used in the existing POST /api/webhooks/payments handler. Register this endpoint URL in the Stripe dashboard listening for: customer.subscription.created, customer.subscription.updated, customer.subscription.deleted, invoice.payment_succeeded, invoice.payment_failed, checkout.session.completed.",
        effort: "medium",
        priority: "critical",
      },
    ],
  },

  // ── 2. Subscription Data Model ────────────────────────────────────────────
  {
    title: "Subscription Data Model",
    description:
      "Add the database tables and server-side storage methods needed to track platform-level subscriptions, plan tiers, and trial state. Follows the existing Drizzle ORM schema patterns in shared/schema.ts.",
    orderIndex: 1,
    tasks: [
      {
        title: "Add platformSubscriptions table to schema",
        description:
          "In shared/schema.ts, add a platformSubscriptions table with columns: id (uuid pk), associationId (fk → associations, unique), plan ('self-managed' | 'property-manager' | 'enterprise'), status ('trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid'), stripeCustomerId, stripeSubscriptionId (nullable for trials), currentPeriodStart, currentPeriodEnd, trialEndsAt (nullable), cancelAtPeriodEnd (boolean), unitTier (nullable integer for self-managed tier), createdAt, updatedAt. Add a unique index on stripeSubscriptionId. Run the migration.",
        effort: "medium",
        priority: "critical",
      },
      {
        title: "Add storage methods for subscription CRUD",
        description:
          "In server/storage.ts, add: createPlatformSubscription(data), getPlatformSubscriptionByAssociationId(associationId), getPlatformSubscriptionByStripeId(stripeSubscriptionId), updatePlatformSubscription(id, data), listAllPlatformSubscriptions() (platform-admin only). Follow existing storage method patterns. Expose these via interface definition.",
        effort: "medium",
        priority: "critical",
      },
      {
        title: "Add GET /api/admin/billing/subscription and GET /api/platform/billing/summary routes",
        description:
          "Add GET /api/admin/billing/subscription (requireAdmin) — returns the current association's platformSubscription record including plan, status, trial end date, and next billing date. Add GET /api/platform/billing/summary (requireAdmin + platform-admin role) — returns all subscriptions with plan, status, and MRR for the billing dashboard. These endpoints will be consumed by the Platform Controls billing tab.",
        effort: "small",
        priority: "high",
      },
    ],
  },

  // ── 3. Sign-Up & Checkout Flow ────────────────────────────────────────────
  {
    title: "Sign-Up & Checkout Flow",
    description:
      "Build the end-to-end path from pricing page CTA → plan selection → Stripe Checkout → workspace provisioning. Leverages the existing NewAssociationPage and AdminUser creation flows. The goal is zero manual steps after a successful payment.",
    orderIndex: 2,
    tasks: [
      {
        title: "Add /signup route and PlanSignupPage",
        description:
          "Create client/src/pages/plan-signup.tsx and register it at /signup in App.tsx. The page collects: full name, work email, organization name, association type, estimated unit count (drives tier selection for self-managed). On submit, calls POST /api/public/signup/start which creates a pending AdminUser + Association record, creates a Stripe Customer, and returns a Stripe Checkout session URL. Redirect to Stripe Checkout. Pre-fill plan and price from URL query params (?plan=property-manager) so pricing page CTAs can deep-link directly.",
        effort: "large",
        priority: "critical",
      },
      {
        title: "Add POST /api/public/signup/start endpoint",
        description:
          "New public (no-auth) endpoint in server/routes.ts: POST /api/public/signup/start. Accepts: name, email, organizationName, associationType, unitCount, plan. Steps: (1) validate inputs and check email not already registered; (2) create a Stripe Customer with email + name metadata; (3) create a Stripe Checkout Session in 'subscription' mode with the correct Price ID, a 14-day trial, success_url pointing to /signup/success?session_id={CHECKOUT_SESSION_ID}, and cancel_url pointing back to /pricing; (4) insert a pending AdminUser record (isActive=false) and a stub Association record (name = organizationName); (5) return { checkoutUrl } to the client.",
        effort: "large",
        priority: "critical",
      },
      {
        title: "Add /signup/success route and post-checkout provisioning",
        description:
          "Create client/src/pages/plan-signup-success.tsx at route /signup/success. On load, the page calls GET /api/public/signup/complete?session_id=X which: (1) retrieves the Stripe checkout.session.completed event data; (2) activates the AdminUser (isActive=true), sets a temporary password or sends a magic-link email; (3) creates the platformSubscription record; (4) creates the TenantConfig record; (5) redirects the user to /app with their new workspace ready. Show a loading/confirmation UI while provisioning runs. Handle the case where the session is already completed (idempotent).",
        effort: "large",
        priority: "critical",
      },
      {
        title: "Update pricing page CTAs to link to /signup with plan param",
        description:
          "In client/src/pages/pricing.tsx, replace all onStartGoogleSignIn() CTA calls with navigation to /signup?plan=self-managed, /signup?plan=property-manager, and mailto:sales@condomanager.com for Enterprise. For authenticated users who are already in a workspace, show 'Manage Plan' linking to the billing tab in Platform Controls instead. Self-Managed tier picker (unit count) should be embedded inline on the pricing page before redirecting.",
        effort: "medium",
        priority: "high",
      },
      {
        title: "14-day free trial — no credit card required",
        description:
          "Configure Stripe Checkout with payment_method_collection: 'if_required' and trial_period_days: 14. During the trial, the workspace is fully functional. Add a trial banner component (client/src/components/trial-banner.tsx) shown at the top of the workspace layout when subscription status is 'trialing' — displays days remaining and a 'Upgrade Now' CTA that opens the Stripe Customer Portal. Hide the banner for platform-admin accounts.",
        effort: "medium",
        priority: "high",
      },
    ],
  },

  // ── 4. Plan Enforcement & Feature Gating ─────────────────────────────────
  {
    title: "Plan Enforcement & Feature Gating",
    description:
      "Enforce subscription status and plan limits server-side. Gate workspace access when a subscription is canceled or payment is past due. Enforce unit count caps per plan tier. Add a middleware helper so individual routes can declare their required plan.",
    orderIndex: 3,
    tasks: [
      {
        title: "Add requireActiveSubscription middleware",
        description:
          "In server/routes.ts, add a requireActiveSubscription middleware that: (1) skips for platform-admin role (internal team); (2) fetches the platformSubscription for the current association; (3) allows access if status is 'trialing', 'active', or within a 3-day grace period for 'past_due'; (4) returns HTTP 402 with { code: 'subscription_required', status, trialEndsAt } for canceled or expired subscriptions. Apply this middleware to all /api/admin/* routes that represent paid features (financial, documents, governance) but NOT to /api/admin/billing/* or /api/auth/* routes.",
        effort: "medium",
        priority: "high",
      },
      {
        title: "Enforce unit count limits per plan tier",
        description:
          "In the POST /api/admin/units route (create unit), add a check: if plan is 'self-managed', count existing units and compare to the tier cap (25, 75, or unlimited). If the cap is reached, return HTTP 403 with { code: 'unit_limit_reached', limit, current }. On the client (units.tsx), catch this error and show an upgrade prompt modal. For the property-manager plan, enforce a max of 10 associations — check in POST /api/admin/associations.",
        effort: "medium",
        priority: "high",
      },
      {
        title: "Subscription-expired workspace lock screen",
        description:
          "In App.tsx (or workspace layout), add a subscription status check on mount using a lightweight GET /api/admin/billing/subscription query. If status is 'canceled' or 'unpaid' (and not platform-admin), render a full-page lock screen instead of the workspace — showing the plan that expired, an 'Update Payment Method' button (opens Stripe Customer Portal), and a 'Contact Support' link. The lock screen should be accessible at all /app/* routes but not block /app/new-association or auth flows.",
        effort: "medium",
        priority: "high",
      },
    ],
  },

  // ── 5. Billing Portal & Subscription Management ───────────────────────────
  {
    title: "Billing Portal & Subscription Management",
    description:
      "Surface subscription and invoice data in the Platform Controls page. Provide a Stripe Customer Portal link for self-service payment method changes, plan upgrades, and cancellation. Add a platform-admin billing overview for MRR and subscription health.",
    orderIndex: 4,
    tasks: [
      {
        title: "Add Billing tab to Platform Controls page",
        description:
          "In client/src/pages/platform-controls.tsx, add a 'Billing' tab (alongside existing Twilio and other tabs). The tab shows: current plan name + status badge, next billing date, trial end date (if trialing), a 'Manage Billing' button that opens the Stripe Customer Portal, current unit count vs plan limit, and a plan comparison CTA for upgrades. Data comes from GET /api/admin/billing/subscription. Follow the existing card layout pattern in platform-controls.tsx.",
        effort: "medium",
        priority: "high",
      },
      {
        title: "Add POST /api/admin/billing/portal-session endpoint",
        description:
          "New endpoint POST /api/admin/billing/portal-session (requireAdmin). Creates a Stripe Customer Portal session for the current association's Stripe Customer ID (from platformSubscriptions.stripeCustomerId). Returns { url } and the client redirects to it. The portal allows the customer to: update payment method, download invoices, cancel subscription. Configure the portal in Stripe dashboard to allow self-service cancellation and plan switching between self-managed tiers.",
        effort: "small",
        priority: "high",
      },
      {
        title: "Platform-admin billing dashboard in Platform Controls",
        description:
          "For platform-admin users only, add a 'Platform Billing' section in Platform Controls (below the existing Twilio config) showing: total active subscriptions, MRR breakdown by plan, trial count, past_due count, recently canceled. Data comes from GET /api/platform/billing/summary. Display as a simple KPI grid with plan breakdown table — use the existing editorial card/bento pattern.",
        effort: "medium",
        priority: "medium",
      },
      {
        title: "Invoice history in billing tab",
        description:
          "Extend the Billing tab to include an invoice history table. Add GET /api/admin/billing/invoices endpoint that fetches the Stripe invoice list for the customer (via Stripe API: GET /v1/invoices?customer=X&limit=10) and returns: invoice number, amount, status, period, and a PDF download URL (from invoice.invoice_pdf). Render as a simple table below the plan status card.",
        effort: "medium",
        priority: "medium",
      },
    ],
  },

  // ── 6. Subscription Lifecycle & Webhooks ──────────────────────────────────
  {
    title: "Subscription Lifecycle & Webhooks",
    description:
      "Handle all Stripe subscription lifecycle events to keep platform subscription state in sync. Implement dunning email notifications for failed payments. Trigger workspace provisioning on checkout completion.",
    orderIndex: 5,
    tasks: [
      {
        title: "Handle checkout.session.completed webhook",
        description:
          "In the POST /api/webhooks/platform/stripe handler: on checkout.session.completed, extract the Stripe Customer ID, Subscription ID, and metadata (associationId, adminUserId). Call the provisioning logic: activate AdminUser, create platformSubscription record with status='trialing' (or 'active' if no trial), create TenantConfig. This must be idempotent — check if the subscription already exists before creating. Log all actions to console and store the raw event in a platformWebhookEvents table (reuse paymentWebhookEvents pattern).",
        effort: "large",
        priority: "critical",
      },
      {
        title: "Handle subscription status change webhooks",
        description:
          "In the webhook handler, process: customer.subscription.updated → update platformSubscriptions.status, currentPeriodEnd, cancelAtPeriodEnd. customer.subscription.deleted → set status='canceled'. invoice.payment_succeeded → set status='active', update currentPeriodEnd. invoice.payment_failed → set status='past_due'. Each handler must be idempotent (use stripeSubscriptionId as lookup key). After updating, invalidate any relevant server-side caches.",
        effort: "medium",
        priority: "critical",
      },
      {
        title: "Failed payment dunning email notification",
        description:
          "When invoice.payment_failed webhook is received, send a transactional email to the association admin (using the existing email provider infrastructure in server/email-provider.ts) with subject 'Action required: payment failed for your CondoManager subscription'. Email body: payment amount, failure reason (from Stripe event), a link to update their payment method via Stripe Customer Portal. Use the existing email template pattern. Retry email if email provider fails (wrap in try/catch, log failure).",
        effort: "medium",
        priority: "high",
      },
      {
        title: "Trial expiry reminder emails",
        description:
          "Add a scheduled job (or cron-style endpoint) POST /api/internal/billing/send-trial-reminders that queries all platformSubscriptions with status='trialing' where trialEndsAt is in 3 days or 1 day. Send a reminder email via the existing email provider: 'Your CondoManager trial ends in X days — add a payment method to continue.' Include the Stripe Customer Portal URL. The endpoint should be idempotent (track sent reminders to avoid duplicates). Wire this to a daily cron via the existing scheduling infrastructure if available, or document it as a manual trigger.",
        effort: "medium",
        priority: "medium",
      },
    ],
  },
];

async function main() {
  console.log("Creating 'Plan Sign-Up & Subscription Billing' project…");

  const [project] = await db
    .insert(roadmapProjects)
    .values({
      title: "Plan Sign-Up & Subscription Billing",
      description:
        "End-to-end implementation of SaaS subscription billing for the CondoManager platform. Enables prospects to select a plan on the pricing page, complete a Stripe Checkout session, and land in a fully provisioned workspace — with trial management, plan enforcement, self-service billing portal, and subscription lifecycle automation. Leverages existing Stripe checkout/webhook patterns, platform secrets store, AdminUser/Association creation flows, and the Platform Controls page.",
      status: "active",
      isCollapsed: 0,
    })
    .returning();

  console.log(`Created project: ${project.id}`);

  for (const wsDef of workstreams) {
    const [ws] = await db
      .insert(roadmapWorkstreams)
      .values({
        projectId: project.id,
        title: wsDef.title,
        description: wsDef.description,
        orderIndex: wsDef.orderIndex,
        isCollapsed: 0,
      })
      .returning();

    console.log(`  Workstream: ${ws.title}`);

    for (const taskDef of wsDef.tasks) {
      await db.insert(roadmapTasks).values({
        projectId: project.id,
        workstreamId: ws.id,
        title: taskDef.title,
        description: taskDef.description,
        status: "todo",
        effort: taskDef.effort,
        priority: taskDef.priority,
        dependencyTaskIds: [],
      });
      console.log(`    [todo] ${taskDef.title}`);
    }
  }

  const totalTasks = workstreams.reduce((n, ws) => n + ws.tasks.length, 0);
  console.log(`\nDone — ${workstreams.length} workstreams, ${totalTasks} tasks.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
