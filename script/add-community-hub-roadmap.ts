import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks, roadmapWorkstreams } from "../shared/schema";

type TaskDef = {
  title: string;
  description: string;
  effort: "small" | "medium" | "large";
  priority: "low" | "medium" | "high" | "critical";
  status: "todo" | "in-progress" | "done";
};

type WorkstreamDef = {
  title: string;
  description: string;
  orderIndex: number;
  tasks: TaskDef[];
};

type ProjectDef = {
  title: string;
  description: string;
  workstreams: WorkstreamDef[];
};

const project: ProjectDef = {
  title: "Association Community Hub",
  description:
    "A configurable, role-aware association microsite and operational resident hub inside Your Condo Manager. Provides each association with a dedicated digital front door connecting residents, owners, board members, and property managers to platform workflows — notices, documents, tickets, governance — through a single canonical entry point. Includes a differentiated Community Infrastructure Map for visual issue intake and maintenance planning. Opt-in per association as a service add-on (property managers) or feature add-on (self-managed boards). Builds on existing communityAnnouncements, portalAccess, and association hierarchy schema.",
  workstreams: [
    // ── WS 1: Service Intent & Operating Model ──────────────────────────────────
    {
      title: "Service Intent & Operating Model",
      description:
        "Define the operating model, user roles, access boundaries, and service packaging for the Community Hub. Establishes who this serves, how it integrates, and what the opt-in/enablement model looks like.",
      orderIndex: 0,
      tasks: [
        {
          title: "Define target user profiles and role-to-feature mapping",
          description:
            "Document the five user profiles (public/anonymous, tenant, owner, board member, property manager/admin) and map which hub sections each profile can view and interact with. Clarify multi-role scenarios (owner + board member). This matrix drives every visibility and access decision downstream.",
          effort: "small",
          priority: "critical",
          status: "todo",
        },
        {
          title: "Define opt-in enablement model per association",
          description:
            "Design how associations activate the Community Hub: admin toggle in association settings, default-off. For managed associations the property manager enables it as a service add-on. For self-managed associations it is a feature add-on. Define what 'enabled' means at the schema level (hub_enabled flag on associations or a hub_config record).",
          effort: "small",
          priority: "high",
          status: "todo",
        },
        {
          title: "Define content governance and publishing authority rules",
          description:
            "Establish who can create, edit, publish, and delete each content type (notices, info blocks, quick actions, map issues). Define approval requirements: board notices may require board-member or manager role; map issues from residents may need moderation. Document the authority matrix.",
          effort: "small",
          priority: "high",
          status: "todo",
        },
        {
          title: "Define public vs authenticated boundary model",
          description:
            "Specify exactly which content types and sections are public-safe (association overview, public notices, community highlights, neighborhood links) vs require authentication (resident notices, request submission, owner documents, map interaction). Establish the principle: only publish what improves navigation, awareness, or coordinated action.",
          effort: "small",
          priority: "critical",
          status: "todo",
        },
        {
          title: "Define privacy and safety guardrails",
          description:
            "Document privacy rules: unit-level resident complaints are never public; tenant-to-owner issues are private; internal board deliberation is private; security-sensitive infrastructure items are restricted. Define anti-abuse measures: rate limiting, bot protection, submission review queues. These guardrails must be enforced server-side, not UI-only.",
          effort: "small",
          priority: "critical",
          status: "todo",
        },
        {
          title: "Define tiering and packaging boundaries",
          description:
            "Outline three potential tiers: Standard (landing page, links, contacts, public notices), Enhanced (authenticated resident hub, document access, branded page, notices center), Premium (Community Infrastructure Map, issue visualization, planning tools). Mark tier gates in feature specs. Final pricing deferred but architecture must support gating.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
      ],
    },

    // ── WS 2: Schema, Data Model & API Foundation ───────────────────────────────
    {
      title: "Schema, Data Model & API Foundation",
      description:
        "Design and implement the database schema extensions and core API layer for the Community Hub. Builds on existing tables (associations, communityAnnouncements, portalAccess, buildings, units) and adds new entities for hub configuration, action links, info blocks, map layers, and map issues.",
      orderIndex: 1,
      tasks: [
        {
          title: "Design HubPageConfig schema and association opt-in flag",
          description:
            "Create hub_page_configs table: association_id (FK, unique), is_enabled, logo_url, banner_image_url, community_description, section_order (jsonb array of section keys), enabled_sections (jsonb array), theme_color, created_at, updated_at. Add hub_enabled flag or rely on config record existence. This is the master config per association hub.",
          effort: "medium",
          priority: "critical",
          status: "todo",
        },
        {
          title: "Design ActionLink schema for quick actions",
          description:
            "Create hub_action_links table: id, association_id (FK), label, icon_key, route_type (internal | external), route_target (path or URL), order_index, is_enabled, auto_derived (boolean — true if system-generated from enabled modules), created_at, updated_at. Max 8 per association enforced at API layer. Auto-derive from enabled modules with admin override.",
          effort: "small",
          priority: "high",
          status: "todo",
        },
        {
          title: "Extend communityAnnouncements for hub notices",
          description:
            "Add fields to existing communityAnnouncements table: category (enum: general, maintenance, governance, safety, seasonal, meeting, financial), attachments (jsonb array of {url, filename, type}), visibility_level (enum: public, resident, owner, board, admin — replaces text targetAudience), is_draft (boolean for draft/publish workflow), scheduled_publish_at (timestamp for future scheduling). Migrate existing targetAudience values.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Design InfoBlock schema for community information",
          description:
            "Create hub_info_blocks table: id, association_id (FK), category (enum: trash, parking, emergency, maintenance, rules, amenities, custom), title, body (rich text), external_links (jsonb array of {label, url}), order_index, is_enabled, created_at, updated_at. Predefined categories with custom option per association.",
          effort: "small",
          priority: "high",
          status: "todo",
        },
        {
          title: "Design MapLayer and MapNode schema for infrastructure map",
          description:
            "Create hub_map_layers table: id, association_id (FK), name, base_image_url (uploaded site plan), coordinate_system (jsonb — image dimensions and origin), is_active, created_at, updated_at. Create hub_map_nodes table: id, layer_id (FK), association_id (FK), node_type (enum: building, unit, common-area, parking, amenity, path, infrastructure), label, linked_building_id (FK nullable), linked_unit_id (FK nullable), geometry (jsonb — coordinates/bounds relative to base image), metadata (jsonb), created_at, updated_at.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Design MapIssue schema for location-based findings",
          description:
            "Create hub_map_issues table: id, association_id (FK), map_node_id (FK nullable — can also be freeform coordinate), layer_id (FK), reported_by_portal_access_id (FK), title, description, category (enum: maintenance, repair, safety, landscaping, suggestion, inspection, other), images (jsonb array of {url, caption}), coordinates (jsonb — click position on map), status (enum: reported, under-review, approved, in-progress, resolved, dismissed), visibility_level (enum: reporter-only, board, all-residents, public), priority (enum: low, medium, high, urgent), linked_ticket_id (FK nullable to work orders), reviewed_by, reviewed_at, resolved_at, created_at, updated_at. Auto-timestamp on creation.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Design AuditLog entries for hub content changes",
          description:
            "Extend existing audit logging pattern to track hub content mutations: notice create/edit/publish/delete, info block changes, action link changes, map issue status changes, hub config changes. Track user_id, timestamp, action, entity_type, entity_id, and change_delta. Use existing audit infrastructure if available or create hub_audit_log table.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Build core CRUD API endpoints for hub config and content",
          description:
            "Implement REST endpoints: GET/PUT /api/associations/:id/hub/config (hub page config), GET/POST/PUT/DELETE for action-links, info-blocks. All endpoints scoped by association_id, protected by requireAdmin + role checks. Include validation with Zod schemas. Upsert pattern for hub config.",
          effort: "large",
          priority: "critical",
          status: "todo",
        },
        {
          title: "Build hub notices API with visibility filtering",
          description:
            "Extend existing communityAnnouncements endpoints or create /api/hub/:associationId/notices. Support: list with visibility filtering based on caller role (public anonymous sees only public, authenticated resident sees resident+public, etc.), create with draft/publish, update, delete, pin/unpin. Server-side visibility enforcement — never rely on UI filtering alone.",
          effort: "medium",
          priority: "critical",
          status: "todo",
        },
        {
          title: "Build map layer, node, and issue API endpoints",
          description:
            "Implement: POST /api/associations/:id/hub/map/layers (upload base image + create layer), CRUD for map nodes (define buildings/areas on the layer), CRUD for map issues (report, review, update status, link to ticket). Issue creation supports image upload. Filtering by status, category, date. Permission checks: residents can report, board/managers can review and moderate.",
          effort: "large",
          priority: "high",
          status: "todo",
        },
        {
          title: "Build public hub API with anonymous access path",
          description:
            "Create /api/hub/:associationId/public endpoint that returns only public-safe data: association name, branding, public notices, community description, public info blocks, public quick links. No authentication required. Rate-limited. This powers the public-facing view of the hub. Separate from admin APIs.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
      ],
    },

    // ── WS 3: Authentication & Role-Based Access ────────────────────────────────
    {
      title: "Authentication & Role-Based Access Layer",
      description:
        "Extend the existing portalAccess PIN/email authentication to support the Community Hub's public-to-authenticated flow. Enable tenant authentication alongside owner authentication. Implement session persistence and role-derived content gating.",
      orderIndex: 2,
      tasks: [
        {
          title: "Extend portal access PIN auth to support tenant role",
          description:
            "Currently portalAccess supports owner, tenant, readonly, board-member roles. Verify that the existing PIN/email auth flow works for tenant-role portal access records, not just owners. If tenants are excluded from PIN generation today, extend to include them. Tenants need authenticated access to resident-level hub content and request submission.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Implement hub session persistence (30-day configurable)",
          description:
            "After PIN authentication on the hub, issue a session token (cookie or localStorage) that persists for a configurable duration (default 30 days). Device-based tracking so users don't re-authenticate on every visit. Session should carry: portal_access_id, association_id, role, expiry. Revocable by admin.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Build hub authentication flow UI component",
          description:
            "Create a lightweight inline auth component for the hub page: email input → PIN sent → PIN entry → session established. Should feel native to the hub (not redirect to a separate login page). Show what's behind auth as a teaser (e.g., 'Sign in to view resident notices'). Rate limit PIN requests to prevent abuse.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Implement role-derived content filtering middleware",
          description:
            "Create server middleware that resolves the caller's effective role from their hub session (anonymous, tenant, owner, board-member, admin) and filters all hub API responses accordingly. Visibility levels on content (public, resident, owner, board, admin) are enforced here. No content leaks via URL manipulation. This is the single enforcement point.",
          effort: "medium",
          priority: "critical",
          status: "todo",
        },
        {
          title: "Implement bot protection and rate limiting for public hub",
          description:
            "Add rate limiting to public hub endpoints and PIN request endpoints. Consider CAPTCHA or proof-of-work for PIN requests after N attempts. Prevent enumeration of association IDs. Protect against scraping of public notice content. Log suspicious access patterns.",
          effort: "small",
          priority: "high",
          status: "todo",
        },
      ],
    },

    // ── WS 4: Association Landing Page & Branding ───────────────────────────────
    {
      title: "Association Landing Page & Branding Engine",
      description:
        "Build the core hub page UI — the configurable landing experience that serves as the digital front door for each association. Includes branding, layout configuration, section ordering, and graceful empty states.",
      orderIndex: 3,
      tasks: [
        {
          title: "Create hub page route and shell component",
          description:
            "Add route /community/:associationId that renders the hub page shell. Route is outside the /app auth boundary — publicly accessible. Fetches hub config and renders enabled sections in configured order. Shows graceful 404 if association doesn't exist or hub not enabled. Mobile-first responsive layout.",
          effort: "medium",
          priority: "critical",
          status: "todo",
        },
        {
          title: "Build branding and identity header section",
          description:
            "Render association name (always displayed), logo (with fallback default), optional banner image, and community description. Logo upload handled in admin config. No broken layout if assets missing — use sensible defaults. Header should feel clean and branded without requiring design effort from the admin.",
          effort: "small",
          priority: "high",
          status: "todo",
        },
        {
          title: "Build section ordering and toggle rendering engine",
          description:
            "Read section_order and enabled_sections from HubPageConfig. Render only enabled sections in the specified order. Disabled sections are not rendered (not just hidden). Default template applied if no configuration exists yet (show all available sections in default order). Mobile layout respects the same order hierarchy.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Build Quick Actions tile grid component",
          description:
            "Render action tiles from hub_action_links: icon + label, clickable. Internal routes navigate within platform; external URLs open in new tab. Auto-derived tiles from enabled modules (maintenance → 'Submit Request', documents → 'View Documents') plus admin-configured custom links. Max 6-8 tiles. Disabled actions not shown. Smart routing passes association_id and user_role context automatically — no re-selection needed.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Build Notices & Bulletins feed component",
          description:
            "Render notices from communityAnnouncements filtered by current user's visibility level. Priority/pinned notices at top. Show title, truncated body, category badge, date, and priority indicator. Expand to full notice on click. Expired notices auto-hidden. Support attachments display. Empty state if no notices.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Build Community Information section component",
          description:
            "Render info blocks organized by category (trash, parking, emergency, etc.). Each block shows title, body content, and external resource links (open in new tab). Collapsible sections for mobile-friendly browsing. Admin-editable without HTML knowledge. Empty state for unconfigured associations.",
          effort: "medium",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Build contacts and key information display",
          description:
            "Display key contacts for the association: property manager, board president, emergency contacts, management company info. Pulls from existing association and board member data where possible. Admin can override/supplement. Click-to-call and click-to-email on mobile.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Implement graceful empty states and progressive disclosure",
          description:
            "Every section renders cleanly even if empty: 'No notices yet', 'Community information coming soon', etc. New hubs with no config show a welcoming default template. Sections progressively reveal as admin configures them. The page should always feel complete, never broken or half-built.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
      ],
    },

    // ── WS 5: Notices & Bulletins System ────────────────────────────────────────
    {
      title: "Notices & Bulletins Authoring System",
      description:
        "Build the admin-facing notice creation, management, and publishing workflow. Extends the existing communityAnnouncements system with structured publishing, visibility controls, scheduling, and priority management.",
      orderIndex: 4,
      tasks: [
        {
          title: "Build notice creation form with structured fields",
          description:
            "Admin form for creating notices: title, body (simple rich text — no HTML required), category (dropdown), visibility level, attachments (file upload), priority flag, author name. Support draft state — save without publishing. Validation with Zod schema.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Implement visibility level controls on notices",
          description:
            "Each notice has a visibility_level: public, resident, owner, board, admin. UI shows clear labels for who will see each notice. Enforcement is server-side (WS3 middleware). Board members creating financial notices can target owner-only. Property managers can post public community updates. UI prevents accidental over-exposure.",
          effort: "small",
          priority: "high",
          status: "todo",
        },
        {
          title: "Implement scheduling and expiration for notices",
          description:
            "Add scheduled_publish_at and expires_at to the creation form. Notices with future publish dates stay in draft until the scheduled time. Expired notices auto-hide from the hub feed but remain in an optional archive view. Useful for time-bound content: snow removal alerts, meeting announcements, seasonal reminders.",
          effort: "medium",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Implement priority and pinning for notices",
          description:
            "Priority flag (normal, important, urgent) and pin toggle. Urgent notices render with visual emphasis (color, icon). Pinned notices always appear at top regardless of date. Multiple pinned notices supported with their own ordering. Board members and managers can escalate and de-escalate priority.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Build notice management list with bulk actions",
          description:
            "Admin view of all notices for the association: filterable by status (draft, published, expired, archived), category, visibility. Bulk actions: publish, archive, delete. Edit inline or in modal. Show reach metrics placeholder (views count — future enhancement). Audit log entry on every mutation.",
          effort: "medium",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Add notification event hooks for future push/email sync",
          description:
            "When a notice is published, emit a structured event (e.g., hub:notice:published with association_id, notice_id, visibility_level, priority). No full notification system required in this phase — just the hooks so that the SMS & Push Notifications project can subscribe later. Store event in a lightweight event log table or leverage existing patterns.",
          effort: "small",
          priority: "low",
          status: "todo",
        },
      ],
    },

    // ── WS 6: Community Infrastructure Map ──────────────────────────────────────
    {
      title: "Community Infrastructure Map",
      description:
        "Build the signature differentiated feature: a visual, interactive map of the association's physical layout. Supports uploaded site plan images with zone/building/area annotations, location-based issue reporting with photo upload, and maintenance planning integration. This is the premium-tier anchor feature.",
      orderIndex: 5,
      tasks: [
        {
          title: "Build map initialization and site plan upload",
          description:
            "Admin uploads a site plan image (PNG/JPG) that becomes the base layer. Store image, record dimensions for coordinate system. Support re-upload and replacement. Show upload guidance: 'Upload an aerial view, site plan, or schematic of your community.' Accept simplified layouts — this doesn't need to be GIS-grade. Preview after upload.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Build structure mapping and zone annotation tool",
          description:
            "Admin clicks or draws on the base image to define zones: buildings, units, common areas, parking zones, amenities, paths, infrastructure. Each zone gets a label (building name, unit number, 'Pool', 'Parking Lot A'). Link zones to existing building and unit records where applicable. Click-to-draw rectangles or polygons, or simplified pin placement. Save geometry as JSON coordinates relative to the base image.",
          effort: "large",
          priority: "high",
          status: "todo",
        },
        {
          title: "Build interactive map viewer with clickable zones",
          description:
            "Render the base image with annotated zones overlaid. Zones are clickable — clicking triggers a contextual panel/modal showing zone details and options (view existing issues, create new issue). Pan and zoom support. Mobile-friendly touch interaction. Labels visible at appropriate zoom levels. Clean, simple visual design — not cluttered.",
          effort: "large",
          priority: "high",
          status: "todo",
        },
        {
          title: "Build issue reporting flow from map interaction",
          description:
            "User clicks a zone or a freeform location on the map → modal opens for issue submission. Fields: description, image upload (camera on mobile), category (auto-suggest from description text with manual override), priority suggestion. Submitter's identity captured from hub session. Auto-timestamp. Submitted issues appear as markers on the map. Category options: maintenance, repair, safety, landscaping, suggestion, inspection, other.",
          effort: "large",
          priority: "high",
          status: "todo",
        },
        {
          title: "Build issue review and moderation dashboard",
          description:
            "Board members and property managers see all reported issues on the map and in a list view. Filter by: status (reported, under-review, approved, in-progress, resolved, dismissed), category, date range, reporter. Bulk status updates. Click an issue to see details, images, and history. Approve, escalate, dismiss, or resolve issues. Add internal notes not visible to reporter.",
          effort: "large",
          priority: "high",
          status: "todo",
        },
        {
          title: "Implement map issue visibility and permission model",
          description:
            "Visibility per issue: reporter-only (default for resident submissions pending review), board (approved issues visible to board and managers), all-residents (community-relevant findings), public (rare — only if explicitly set). Residents should not see sensitive infrastructure issues. Board members get full visibility. Map itself can be hidden from non-board users if association prefers. Permission controlled by role from WS3.",
          effort: "medium",
          priority: "critical",
          status: "todo",
        },
        {
          title: "Build issue-to-ticket linking",
          description:
            "Allow board members or managers to convert a map issue into a maintenance work order / ticket. Link map issue to existing ticket_id. Show linked ticket status on the map issue. One-click 'Create Work Order' from issue detail. Bidirectional reference: ticket shows originating map issue, map issue shows linked ticket status. Status sync optional for future enhancement.",
          effort: "medium",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Build map filtering and layer toggle controls",
          description:
            "Filter controls on the map: toggle issue visibility by status, category, date range. Toggle labels on/off. Toggle issue markers on/off. Layer concept for future: multiple overlays (e.g., current issues, planned improvements, inspection history). Start with a single active layer + filter controls.",
          effort: "medium",
          priority: "medium",
          status: "todo",
        },
      ],
    },

    // ── WS 7: Admin Configuration Console ───────────────────────────────────────
    {
      title: "Admin Configuration Console",
      description:
        "Build the association-level admin interface for configuring all aspects of the Community Hub. Lives within each association's settings area. Enables non-technical admins to control branding, sections, content, and permissions without developer involvement.",
      orderIndex: 6,
      tasks: [
        {
          title: "Build hub configuration settings panel in association settings",
          description:
            "Add a 'Community Hub' section within the existing association settings area. Controls: enable/disable hub, logo upload, banner image upload, community description, theme color. Preview link to the live hub page. Toggle-based section enablement. This is the entry point for all hub admin activity.",
          effort: "medium",
          priority: "critical",
          status: "todo",
        },
        {
          title: "Build section ordering and visibility controls",
          description:
            "Admin can drag-and-drop (or numeric priority) to reorder hub sections. Toggle individual sections on/off. Sections: Quick Actions, Notices, Community Info, Contacts, Map. Disabled sections not rendered on the hub. Default order applied for new hubs. Changes persist immediately.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Build quick action link manager",
          description:
            "Admin CRUD for action links: add/edit/remove/reorder. Each link: label, icon (picker from available set), route type (internal/external), target URL/path. Show auto-derived links from enabled modules (greyed, non-deletable but hideable). Enforce max 8 links. Preview how tiles look on the hub.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Build community information block editor",
          description:
            "Admin CRUD for info blocks: select category, write title and body (simple editor — no HTML), add external resource links. Reorder blocks. Enable/disable individual blocks. Predefined category templates to help admins get started (e.g., 'Trash & Recycling' template with placeholder content).",
          effort: "medium",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Build default visibility rules configuration",
          description:
            "Admin sets default visibility for new content types: e.g., new notices default to 'resident' visibility, new map issues default to 'reporter-only' pending review. Configurable per content type. Prevents accidental public exposure of sensitive content. Sensible defaults out of the box.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Build hub audit log viewer",
          description:
            "Admin view of all hub-related changes: who changed a notice, who modified hub config, who published/unpublished content, who changed map issue status. Filterable by action type, user, date. Read-only. Board members want accountability for content changes. Leverages audit entries from WS2.",
          effort: "medium",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Build moderation queue for resident submissions (future-ready)",
          description:
            "Placeholder infrastructure for reviewing resident-submitted content before publication. In MVP, map issues from residents default to 'reported' (not publicly visible) until board/manager reviews. Future: notices submitted by residents, comment moderation, etc. Build the queue pattern now even if only map issues use it initially.",
          effort: "medium",
          priority: "low",
          status: "todo",
        },
      ],
    },

    // ── WS 8: Hub Onboarding & Setup Wizard ─────────────────────────────────────
    {
      title: "Hub Onboarding & Setup Wizard",
      description:
        "Create a guided setup experience for admins enabling the Community Hub for the first time. Walks through branding, contacts, quick links, initial content, and optional map setup so that the hub is useful from day one rather than an empty shell.",
      orderIndex: 7,
      tasks: [
        {
          title: "Build hub setup wizard flow",
          description:
            "Multi-step guided setup triggered when admin enables the hub for the first time. Steps: (1) Association name and description, (2) Logo and banner upload, (3) Key contacts, (4) Quick links selection, (5) First notice creation (optional), (6) Community info quick-fill, (7) Map setup (optional, can skip). Each step skippable. Progress saved incrementally. Completable later.",
          effort: "large",
          priority: "high",
          status: "todo",
        },
        {
          title: "Auto-populate hub from existing association data",
          description:
            "Pre-fill hub config from existing association record: name, address, contact info. Auto-derive quick action links from enabled platform modules. Pull board member contacts from existing board roles. Pre-create info blocks from association type templates (condo vs townhome vs HOA). Reduce setup friction to near-zero for associations already active on the platform.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Build hub preview mode for admin review before publishing",
          description:
            "Admin can preview the hub as each role would see it (public, tenant, owner, board) before making it live. Toggle between role views. Shows exactly what content is visible at each level. 'Go Live' button to make the hub URL active. This prevents accidental premature exposure and builds admin confidence.",
          effort: "medium",
          priority: "medium",
          status: "todo",
        },
      ],
    },

    // ── WS 9: Platform Integration & Discovery ──────────────────────────────────
    {
      title: "Platform Integration & Discovery",
      description:
        "Connect the Community Hub to the broader Your Condo Manager platform: marketing site discovery, owner portal integration, deep-linking from existing workflows, and prospective buyer/new resident experience.",
      orderIndex: 8,
      tasks: [
        {
          title: "Add hub discovery to YCM marketing site",
          description:
            "Add 'Find Your Community' or 'View Your Community Page' to the main YCM landing page. Search by association name or address. Links to the public view of enabled hubs. Positions the hub as a selling point for prospective residents and buyers. Only shows associations with hub enabled and public content available.",
          effort: "medium",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Deep-link hub quick actions to platform modules",
          description:
            "Ensure quick action links pass full context: association_id, user_role, return URL. 'Submit Maintenance Request' opens the maintenance request form pre-scoped to the association. 'View Documents' opens the document portal for that association. 'Pay HOA Fee' links to the payment flow. No re-selection of association needed after clicking through from the hub.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Add hub link to owner portal and board workspace",
          description:
            "Within the existing owner portal and board workspace, add a link or nav item to 'Community Hub' that takes the user to their association's hub page. Creates a bidirectional connection: hub links into platform workflows, platform links back to hub. Contextual: only shown if hub is enabled for that association.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Build new resident and prospective buyer experience",
          description:
            "The public hub view serves as an introduction for people considering the community. Show community highlights, public notices, neighborhood info, and a professional presentation. Optional 'Request Information' or 'Contact Management' CTA for non-residents. This makes the hub a selling tool, not just an operations tool.",
          effort: "medium",
          priority: "low",
          status: "todo",
        },
      ],
    },

    // ── WS 10: Mobile Optimization & Responsive Design ──────────────────────────
    {
      title: "Mobile Optimization & Responsive Design",
      description:
        "Ensure the Community Hub is mobile-first across all sections. This is likely the primary access device for residents. Apply existing mobile UI standards from the Mobile Optimization project.",
      orderIndex: 9,
      tasks: [
        {
          title: "Mobile-first layout for hub landing page",
          description:
            "Design and implement the hub page as mobile-first: single column, touch-friendly tiles, readable typography, adequate spacing. Desktop gets wider layout with optional side-by-side sections. Test across 320px, 375px, 390px, 430px, 768px viewports per existing mobile viewport matrix.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Mobile-optimized map interaction",
          description:
            "Map viewer must work well on mobile: pinch-to-zoom, tap zones, swipe to pan. Issue reporting modal adapted for mobile: camera integration for photo upload, simplified form. Zone labels readable at mobile zoom levels. Performance optimization for image rendering on mobile devices.",
          effort: "large",
          priority: "high",
          status: "todo",
        },
        {
          title: "Mobile-optimized notice reading and info browsing",
          description:
            "Notices render as mobile-friendly cards with expandable detail. Info blocks use accordion/collapsible pattern for mobile. External links clearly indicate new-tab behavior. Attachment downloads work on mobile. Click-to-call for contact numbers. All text readable without horizontal scroll.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Mobile auth flow optimization",
          description:
            "PIN entry optimized for mobile: numeric keyboard, auto-advance between digits, clear error states. Email input with proper keyboard type. Session persistence eliminates repeated auth on mobile. Auth prompt is inline, not a full redirect. Test on iOS Safari, Android Chrome.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
      ],
    },

    // ── WS 11: Verification, QA & Launch ────────────────────────────────────────
    {
      title: "Verification, QA & Launch",
      description:
        "End-to-end verification of the Community Hub across all roles, devices, and scenarios. Security audit of access controls. Performance validation. Launch checklist and rollout plan.",
      orderIndex: 10,
      tasks: [
        {
          title: "Role-based access verification matrix",
          description:
            "Create and execute a test matrix: for each content type and section, verify correct visibility at every role level (anonymous, tenant, owner, board-member, admin). Test URL manipulation — ensure no content leaks. Test API responses directly — ensure server-side filtering works. Document results.",
          effort: "medium",
          priority: "critical",
          status: "todo",
        },
        {
          title: "Privacy and security audit",
          description:
            "Verify: no resident identity exposure in public views, no unit-level issues visible publicly, no building vulnerability info exposed, no association enumeration via hub URLs, rate limiting effective on public endpoints and PIN requests, bot protection working, audit trail complete for all content mutations.",
          effort: "medium",
          priority: "critical",
          status: "todo",
        },
        {
          title: "Mobile device testing across hub features",
          description:
            "Test full hub journey on iOS Safari, Android Chrome, and common mobile viewports. Cover: landing page, auth flow, notice reading, info browsing, map viewing, issue reporting with photo upload, quick action navigation. Document issues and fix. Follow existing mobile test checklist pattern.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Performance validation for map and image-heavy content",
          description:
            "Validate: site plan image loading time, map interaction responsiveness, notice feed with 50+ items, image gallery on map issues. Ensure lazy loading for images, pagination for long lists, acceptable load time on 3G mobile. Optimize as needed.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "End-to-end hub setup and usage journey test",
          description:
            "Test the complete journey: admin enables hub → setup wizard → configure branding → add notices → configure info blocks → set up map → resident visits public page → authenticates → views notices → reports map issue → board reviews issue → creates work order. Every step works without manual intervention.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Launch checklist and rollout plan",
          description:
            "Create launch checklist: database migrations applied, feature flag (hub_enabled) defaults correct, public routes accessible, rate limiting active, monitoring in place, admin documentation ready, first association pilot identified. Define rollout: pilot with one association → fix issues → expand to all opt-in associations.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
      ],
    },
  ],
};

// ── Upsert logic (matches existing pattern) ─────────────────────────────────

async function upsertProject(def: ProjectDef) {
  let [proj] = await db
    .select()
    .from(roadmapProjects)
    .where(eq(roadmapProjects.title, def.title));

  if (!proj) {
    [proj] = await db
      .insert(roadmapProjects)
      .values({ title: def.title, description: def.description, status: "active", isCollapsed: 0 })
      .returning();
    console.log(`\n[+] Created project: ${proj.title}`);
  } else {
    [proj] = await db
      .update(roadmapProjects)
      .set({ description: def.description, updatedAt: new Date() })
      .where(eq(roadmapProjects.id, proj.id))
      .returning();
    console.log(`\n[~] Updated project: ${proj.title}`);
  }

  for (const wsDef of def.workstreams) {
    let [workstream] = await db
      .select()
      .from(roadmapWorkstreams)
      .where(and(eq(roadmapWorkstreams.projectId, proj.id), eq(roadmapWorkstreams.title, wsDef.title)));

    if (!workstream) {
      [workstream] = await db
        .insert(roadmapWorkstreams)
        .values({ projectId: proj.id, title: wsDef.title, description: wsDef.description, orderIndex: wsDef.orderIndex, isCollapsed: 0 })
        .returning();
      console.log(`  [+] Workstream: ${workstream.title}`);
    } else {
      [workstream] = await db
        .update(roadmapWorkstreams)
        .set({ description: wsDef.description, orderIndex: wsDef.orderIndex, updatedAt: new Date() })
        .where(eq(roadmapWorkstreams.id, workstream.id))
        .returning();
      console.log(`  [~] Workstream: ${workstream.title}`);
    }

    for (const taskDef of wsDef.tasks) {
      const [existing] = await db
        .select()
        .from(roadmapTasks)
        .where(and(eq(roadmapTasks.projectId, proj.id), eq(roadmapTasks.workstreamId, workstream.id), eq(roadmapTasks.title, taskDef.title)));

      if (!existing) {
        await db.insert(roadmapTasks).values({
          projectId: proj.id,
          workstreamId: workstream.id,
          title: taskDef.title,
          description: taskDef.description,
          status: taskDef.status,
          effort: taskDef.effort,
          priority: taskDef.priority,
          dependencyTaskIds: [],
        });
        console.log(`    [+] Task: ${taskDef.title}`);
      } else {
        await db
          .update(roadmapTasks)
          .set({ description: taskDef.description, effort: taskDef.effort, priority: taskDef.priority, updatedAt: new Date() })
          .where(eq(roadmapTasks.id, existing.id));
        console.log(`    [~] Task (updated): ${taskDef.title}`);
      }
    }
  }
}

async function run() {
  console.log("Adding Association Community Hub roadmap project...\n");
  await upsertProject(project);
  console.log("\nDone.");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
