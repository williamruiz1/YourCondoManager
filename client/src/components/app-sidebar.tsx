import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  Building2,
  DoorOpen,
  UserCheck,
  FileText,
  Contact,
  CircleDollarSign,
  ClipboardCheck,
  CalendarDays,
  Bot,
  MessageSquare,
  SlidersHorizontal,
  ListChecks,
  BriefcaseBusiness,
  ClipboardList,
  PackageOpen,
  Shield,
  Layers,
  MessageCircle,
  Megaphone,
  Vote,
  Settings,
  ShieldCheck,
  Wrench,
  SearchCheck,
  Globe,
  CalendarCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarRail,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { canAccessWipRoute } from "@/lib/wip-features";

type AdminRole = "platform-admin" | "board-officer" | "assisted-board" | "pm-assistant" | "manager" | "viewer";

type NavLink = {
  title: string;
  url: string;
  icon: LucideIcon;
  materialIcon?: string;
  activePrefix?: string;
  roles?: AdminRole[];
};

type NavModule = NavLink & {
  children?: NavLink[];
};


// Top-level platform overview — always visible
// [0.1 AC 1, AC 6] "Home" replaces "Dashboard" as the root /app label.
// "Portfolio Health" is subordinate to Home (rendered as a persistent indented
// child in the Overview group), not a peer. "Associations" remains a peer.
const overviewModules: NavModule[] = [
  {
    title: "Home",
    url: "/app",
    icon: LayoutDashboard,
    materialIcon: "home",
    children: [
      {
        title: "Portfolio Health",
        url: "/app/portfolio",
        icon: Layers,
        materialIcon: "layers",
        activePrefix: "/app/portfolio",
        roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"],
      },
    ],
  },
  {
    title: "Associations",
    url: "/app/associations",
    icon: Building2,
    materialIcon: "domain",
    activePrefix: "/app/associations",
  },
];

// Scoped to the selected association — shown under the association's name
const associationModules: NavModule[] = [
  {
    title: "Buildings & Units",
    url: "/app/units",
    icon: DoorOpen,
    materialIcon: "door_front",
    activePrefix: "/app/units",
    roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"],
    children: [
      { title: "People", url: "/app/persons", icon: Contact, materialIcon: "contacts", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"] },
    ],
  },
  {
    title: "Finance",
    url: "/app/financial/foundation",
    icon: CircleDollarSign,
    materialIcon: "payments",
    activePrefix: "/app/financial",
    roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"],
    children: [
      { title: "Billing", url: "/app/financial/billing", icon: CircleDollarSign, materialIcon: "receipt_long", activePrefix: "/app/financial/billing", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"] },
      { title: "Assessment Rules", url: "/app/financial/rules", icon: CircleDollarSign, materialIcon: "rule", activePrefix: "/app/financial/rules", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"] },
      { title: "Payments", url: "/app/financial/payments", icon: CircleDollarSign, materialIcon: "credit_card", activePrefix: "/app/financial/payments", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"] },
      { title: "Expenses", url: "/app/financial/expenses", icon: CircleDollarSign, materialIcon: "account_balance", activePrefix: "/app/financial/expenses", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"] },
      { title: "Reports", url: "/app/financial/reports", icon: CircleDollarSign, materialIcon: "summarize", activePrefix: "/app/financial/reports", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"] },
    ],
  },
  {
    title: "Board",
    url: "/app/board",
    icon: UserCheck,
    materialIcon: "groups",
    roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"],
    children: [
      { title: "Governance", url: "/app/governance", icon: ClipboardCheck, materialIcon: "gavel", activePrefix: "/app/governance", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"] },
      { title: "Communications", url: "/app/communications", icon: MessageSquare, materialIcon: "forum", activePrefix: "/app/communications", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"] },
      // 4.1 Wave 4 — central inbox. `activePrefix` is the full
      // `/app/communications/inbox` path (not a prefix of the parent
      // Communications hub) so the sidebar highlights Inbox without
      // double-highlighting the Communications entry.
      { title: "Inbox", url: "/app/communications/inbox", icon: MessageSquare, materialIcon: "inbox", activePrefix: "/app/communications/inbox", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"] },
      { title: "Announcements", url: "/app/announcements", icon: Megaphone, materialIcon: "campaign", activePrefix: "/app/announcements", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"] },
    ],
  },
  {
    title: "Documents",
    url: "/app/documents",
    icon: FileText,
    materialIcon: "description",
    activePrefix: "/app/documents",
    roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"],
  },
  {
    title: "Insurance",
    url: "/app/insurance",
    icon: ShieldCheck,
    materialIcon: "verified_user",
    activePrefix: "/app/insurance",
    roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"],
  },
  {
    // [0.1 AC 7] Sidebar label reads "Operations Overview" (matching the page
    // title and breadcrumb) — the word "Dashboard" is intentionally absent.
    // [1.2 Q7 exception] "Overview" suffix on nav labels is forbidden; the
    // Operations Overview dashboard is the single allowed exception, locked
    // by 0.1 AC 7. See docs/projects/platform-overhaul/implementation-
    // artifacts/1.2-hub-contract.md §4.
    // eslint-disable-next-line no-restricted-syntax
    title: "Operations Overview",
    url: "/app/operations/dashboard",
    icon: ClipboardList,
    materialIcon: "engineering",
    activePrefix: "/app/operations",
    roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"],
    children: [
      { title: "Work Orders", url: "/app/work-orders", icon: ClipboardList, materialIcon: "build", activePrefix: "/app/work-orders", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"] },
      { title: "Maintenance", url: "/app/maintenance-schedules", icon: Wrench, materialIcon: "handyman", activePrefix: "/app/maintenance-schedules", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"] },
      { title: "Inspections", url: "/app/inspections", icon: SearchCheck, materialIcon: "fact_check", activePrefix: "/app/inspections", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"] },
      { title: "Vendors", url: "/app/vendors", icon: BriefcaseBusiness, materialIcon: "storefront", activePrefix: "/app/vendors", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"] },
      { title: "Feedback", url: "/app/resident-feedback", icon: MessageCircle, materialIcon: "rate_review", activePrefix: "/app/resident-feedback", roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"] },
    ],
  },
  {
    title: "Amenity Booking",
    url: "/app/amenities",
    icon: CalendarCheck,
    materialIcon: "event_available",
    activePrefix: "/app/amenities",
    roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"],
  },
  {
    // TODO(1.2 Phase 11): 1.2 Q7 forbids "Hub" as a nav-label suffix. Rename
    // candidate flagged in docs/projects/platform-overhaul/implementation-
    // artifacts/1.2-hub-contract.md §7.1 — Phase 11 / 3.1 sidebar redesign
    // resolves this (either rename to "Community" under /app/communications
    // or fold into the Communications hub). Temporary suppression.
    // eslint-disable-next-line no-restricted-syntax
    title: "Community Hub",
    url: "/app/community-hub",
    icon: Globe,
    materialIcon: "language",
    activePrefix: "/app/community-hub",
    roles: ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"],
  },
];

// Platform-admin-only controls
const platformModules: NavModule[] = [
  {
    title: "Platform Controls",
    url: "/app/platform/controls",
    icon: SlidersHorizontal,
    materialIcon: "tune",
    activePrefix: "/app/platform",
    roles: ["platform-admin"],
    children: [
      { title: "Owner Portal", url: "/portal", icon: Contact, materialIcon: "person", roles: ["platform-admin"] },
      { title: "Admin Roadmap", url: "/app/admin/roadmap", icon: ListChecks, materialIcon: "checklist", activePrefix: "/app/admin/roadmap", roles: ["platform-admin"] },
      { title: "AI Ingestion", url: "/app/ai/ingestion", icon: Bot, materialIcon: "smart_toy", activePrefix: "/app/ai", roles: ["platform-admin"] },
    ],
  },
];

// User-level entries shown at bottom of sidebar
const userModules: NavModule[] = [
  {
    title: "Settings",
    url: "/app/settings",
    icon: Settings,
    materialIcon: "settings",
    activePrefix: "/app/settings",
  },
];


function isLinkActive(location: string, item: NavLink): boolean {
  const activeBase = item.activePrefix ?? item.url;
  return item.url === "/app" ? location === "/app" : location.startsWith(activeBase);
}

function canAccess(item: NavLink, role?: AdminRole | null) {
  if (!item.roles || item.roles.length === 0) return true;
  if (!role) return true;
  return item.roles.includes(role);
}

function isSingleAssociationBoardExperience(adminRole: AdminRole | null | undefined, associationCount: number) {
  return (adminRole === "board-officer" || adminRole === "assisted-board") && associationCount <= 1;
}

function filterModules(modules: NavModule[], adminRole?: AdminRole | null): NavModule[] {
  return modules
    .filter((m) => canAccess(m, adminRole) && canAccessWipRoute(m.url, adminRole))
    .map((m) => ({
      ...m,
      children: m.children?.filter((c) => canAccess(c, adminRole) && canAccessWipRoute(c.url, adminRole)),
    }));
}

export function AppSidebar({ adminRole }: { adminRole?: AdminRole | null }) {
  const [location] = useLocation();
  const { associations, activeAssociation, activeAssociationId, activeAssociationName } = useActiveAssociation();
  const singleAssociationBoardExperience = isSingleAssociationBoardExperience(adminRole, associations.length);
  // [0.1 AC 6 + AC 8] For single-association board users, hide both the
  // "Associations" peer entry and the "Portfolio Health" child of Home — these
  // users are redirected from /app/portfolio to /app (see App.tsx), so the link
  // shouldn't appear. The Home parent itself remains visible.
  const overviewSource = singleAssociationBoardExperience
    ? overviewModules
        .filter((module) => module.url !== "/app/associations")
        .map((module) => ({
          ...module,
          children: module.children?.filter((child) => child.url !== "/app/portfolio"),
        }))
    : overviewModules;
  const visibleOverview = filterModules(overviewSource, adminRole);
  // 4.2 Q3 addendum (3a): hide the Amenity Booking entry when the active
  // association has disabled amenities. When `amenitiesEnabled` is missing
  // (e.g. no active association yet, or the column has not been hydrated),
  // default to showing the entry — the server still enforces the gate.
  const amenitiesDisabled = activeAssociation?.amenitiesEnabled === 0;
  const associationSource = amenitiesDisabled
    ? associationModules.filter((m) => m.url !== "/app/amenities")
    : associationModules;
  const visibleAssociation = filterModules(associationSource, adminRole);
  const visiblePlatform = filterModules(platformModules, adminRole);

  return (
    <Sidebar collapsible="icon" className="border-r border-slate-200/50 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-950">
      <SidebarHeader className="border-b border-slate-200/50 dark:border-slate-800/50">
        <Link href="/" className="px-4 pt-4 pb-3 flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm flex-shrink-0">
            <span className="material-symbols-outlined text-[18px]">apartment</span>
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <h2 className="font-headline italic font-semibold text-lg tracking-tight text-slate-900 dark:text-slate-100" data-testid="text-app-title">
              Your Condo Manager
            </h2>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-tight font-label">Property Operations</p>
          </div>
        </Link>
        <div className="px-3 pb-3 group-data-[collapsible=icon]:hidden">
          {activeAssociationId ? (
            singleAssociationBoardExperience ? (
              <div
                className="flex items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/30 px-3 py-2 text-sm"
                data-testid="text-selected-association-overview"
              >
                <span className="material-symbols-outlined text-[16px] text-muted-foreground flex-shrink-0">domain</span>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none mb-0.5 font-label">Association</div>
                  <div className="text-xs font-semibold truncate font-body">{activeAssociationName}</div>
                </div>
              </div>
            ) : (
              <Link
                href="/app/association-context"
                className="flex items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/30 px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent/60"
                data-testid="link-selected-association-overview"
              >
                <span className="material-symbols-outlined text-[16px] text-muted-foreground flex-shrink-0">domain</span>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none mb-0.5 font-label">Association</div>
                  <div className="text-xs font-semibold truncate font-body">{activeAssociationName}</div>
                </div>
              </Link>
            )
          ) : (
            <Link
              href="/app/association-context"
              className="flex items-center gap-2 rounded-lg border border-dashed border-sidebar-border px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent/30"
            >
              <span className="material-symbols-outlined text-[16px] text-muted-foreground flex-shrink-0">domain_add</span>
              <span className="text-xs text-muted-foreground font-body">Select association</span>
            </Link>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {/* Overview: Home (+ Portfolio Health as subordinate), Associations
            [0.1 AC 6] Portfolio Health renders as a persistent indented child of
            Home so its subordination is visible even when Home is not the active
            route — the nav hierarchy is conveyed structurally rather than being
            gated on active-state reveal. */}
        <SidebarGroup>
          <SidebarGroupLabel className="label-caps text-muted-foreground/70">Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleOverview.map((module) => {
                const active = isLinkActive(location, module);
                return (
                  <SidebarMenuItem key={module.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={module.title}
                      className={`transition-all duration-150 ${
                        active
                          ? "bg-white dark:bg-slate-800 shadow-sm text-blue-700 dark:text-blue-400 font-bold rounded-lg"
                          : "hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:translate-x-1"
                      }`}
                    >
                      <Link href={module.url} data-testid={`link-nav-${module.title.toLowerCase().replace(/\s+/g, "-")}`}>
                        <span className="material-symbols-outlined text-[20px]">{module.materialIcon}</span>
                        <span className="font-body text-sm tracking-tight">{module.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {module.children?.length ? (
                      <SidebarMenuSub>
                        {module.children.map((child) => (
                          <SidebarMenuSubItem key={child.title}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={isLinkActive(location, child)}
                            >
                              <Link href={child.url} data-testid={`link-nav-${child.title.toLowerCase().replace(/\s+/g, "-")}`}>
                                <span className="material-symbols-outlined text-[16px]">{child.materialIcon}</span>
                                <span className="font-body text-sm tracking-tight">{child.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Association workspace — scoped to selected association */}
        {visibleAssociation.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="truncate label-caps text-muted-foreground/70">
              {activeAssociationName || "Association"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleAssociation.map((module) => {
                  const childActive = module.children?.some((child) => isLinkActive(location, child)) ?? false;
                  const moduleActive = isLinkActive(location, module) || childActive;
                  return (
                    <SidebarMenuItem key={module.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={moduleActive}
                        tooltip={module.title}
                        className={`transition-all duration-150 ${
                          moduleActive
                            ? "bg-white dark:bg-slate-800 shadow-sm text-blue-700 dark:text-blue-400 font-bold rounded-lg"
                            : "hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:translate-x-1"
                        }`}
                      >
                        <Link href={module.url} data-testid={`link-nav-${module.title.toLowerCase().replace(/\s+/g, "-")}`}>
                          <span className="material-symbols-outlined text-[20px]">{module.materialIcon}</span>
                          <span className="font-body text-sm tracking-tight">{module.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      {moduleActive && module.children?.length ? (
                        <SidebarMenuSub>
                          {module.children.map((child) => (
                            <SidebarMenuSubItem key={child.title}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={isLinkActive(location, child)}
                              >
                                <Link href={child.url} data-testid={`link-nav-${child.title.toLowerCase().replace(/\s+/g, "-")}`}>
                                  <span className="material-symbols-outlined text-[16px]">{child.materialIcon}</span>
                                  <span className="font-body text-sm tracking-tight">{child.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Platform controls — platform-admin only */}
        {visiblePlatform.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="label-caps text-muted-foreground/70">Platform</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visiblePlatform.map((module) => {
                  const childActive = module.children?.some((child) => isLinkActive(location, child)) ?? false;
                  const moduleActive = isLinkActive(location, module) || childActive;
                  return (
                    <SidebarMenuItem key={module.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={moduleActive}
                        tooltip={module.title}
                        className={`transition-all duration-150 ${
                          moduleActive
                            ? "bg-white dark:bg-slate-800 shadow-sm text-blue-700 dark:text-blue-400 font-bold rounded-lg"
                            : "hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:translate-x-1"
                        }`}
                      >
                        <Link href={module.url} data-testid={`link-nav-${module.title.toLowerCase().replace(/\s+/g, "-")}`}>
                          <span className="material-symbols-outlined text-[20px]">{module.materialIcon}</span>
                          <span className="font-body text-sm tracking-tight">{module.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      {moduleActive && module.children?.length ? (
                        <SidebarMenuSub>
                          {module.children.map((child) => (
                            <SidebarMenuSubItem key={child.title}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={isLinkActive(location, child)}
                              >
                                <Link href={child.url} data-testid={`link-nav-${child.title.toLowerCase().replace(/\s+/g, "-")}`}>
                                  <span className="material-symbols-outlined text-[16px]">{child.materialIcon}</span>
                                  <span className="font-body text-sm tracking-tight">{child.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-slate-200/50 dark:border-slate-800/50 group-data-[collapsible=icon]:hidden">
        <div className="px-3 py-3 space-y-2">
          {adminRole === "platform-admin" && (
            <Link href="/app/new-association">
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-bold font-body hover:bg-primary/90 active:scale-95 transition-all shadow-sm">
                <span className="material-symbols-outlined text-[18px]">add</span>
                New Association
              </button>
            </Link>
          )}
          <div className="flex items-center gap-4 px-1 pt-1">
            <Link href="/app/settings">
              <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-on-surface transition-colors font-body">
                <span className="material-symbols-outlined text-[16px]">settings</span>
                Settings
              </button>
            </Link>
            <Link href="/app/help-center">
              <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-on-surface transition-colors font-body">
                <span className="material-symbols-outlined text-[16px]">help</span>
                Help Center
              </button>
            </Link>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
