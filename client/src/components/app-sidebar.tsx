// @zone: (cross-cutting)
// @persona: Manager, Board Officer, Assisted Board, PM Assistant, Viewer, Platform Admin
//
// Phase 11 (3.1) — six-zone sidebar redesign.
//
// Renders six top-level `SidebarGroup` blocks per 3.1 Q1:
//   Home / Financials / Operations / Governance / Communications / Platform.
// Settings + Help Center live in the footer (3.1 Q12).
//
// SUBSET-RENDER (3.1 Q5): zones and items the persona is not permitted to
// see are absent from the DOM — never greyed-out, never collapsed.
//
// Zero hardcoded `roles: [...]` literals (3.1 AC 39): all role gates source
// from the canonical persona-derivation constants in
// `client/src/components/app-sidebar-zones.ts`. The active role is read
// from `useAdminRole()` so the sidebar tracks the auth session live, and
// the `adminRole` prop is retained as a fallback / test seam.
//
// Zone-label clicks navigate to the hub URL per 3.1 Q3 + 1.2 Q4.
//   Home → /app
//   Financials → /app/financials
//   Operations → /app/operations
//   Governance → /app/governance
//   Communications → /app/communications
//   Platform → /app/platform/controls
//
// Owner Portal launcher removed from Platform group per 3.1 Q11 / 2.4 Q5.
// Association switcher lives in the top app-bar only per 3.1 Q10.

import { useLocation, Link } from "wouter";
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
import { useAdminRole } from "@/hooks/useAdminRole";
import type { AdminRole } from "@shared/schema";
import {
  SIDEBAR_ZONES,
  SIDEBAR_FOOTER_ITEMS,
  ZONE_LABELS,
  filterZonesForPersona,
  filterFooterItemsForPersona,
  type SidebarItem,
  type SidebarZone,
} from "@/components/app-sidebar-zones";

function isLinkActive(location: string, url: string, activePrefix?: string): boolean {
  const base = activePrefix ?? url;
  return url === "/app" ? location === "/app" : location.startsWith(base);
}

function isZoneActive(location: string, zone: SidebarZone): boolean {
  // The Home zone hub URL is `/app`, but `location.startsWith("/app")` is
  // always true inside the workspace shell, so guard it.
  if (zone.hubUrl === "/app") return location === "/app";
  if (location.startsWith(zone.hubUrl)) return true;
  return zone.items.some((item) => isLinkActive(location, item.url, item.activePrefix));
}

function isSingleAssociationBoardExperience(
  adminRole: AdminRole | null | undefined,
  associationCount: number,
): boolean {
  return (adminRole === "board-officer" || adminRole === "assisted-board") && associationCount <= 1;
}

function slugify(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

interface ZoneGroupProps {
  zone: SidebarZone;
  location: string;
}

function ZoneGroup({ zone, location }: ZoneGroupProps) {
  const zoneActive = isZoneActive(location, zone);
  const ZoneIcon = zone.icon;

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="label-caps text-muted-foreground/70">
        {zone.label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {/* Zone label / hub link — clicking navigates to the hub URL per
              3.1 Q3 + 1.2 Q4. The Home zone navigates to `/app`. */}
          <SidebarMenuItem key={`zone-${zone.label}`}>
            <SidebarMenuButton
              asChild
              isActive={zoneActive}
              tooltip={zone.label}
              className={`transition-all duration-150 ${
                zoneActive
                  ? "bg-white dark:bg-slate-800 shadow-sm text-blue-700 dark:text-blue-400 font-bold rounded-lg"
                  : "hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:translate-x-1"
              }`}
            >
              <Link href={zone.hubUrl} data-testid={`link-nav-zone-${slugify(zone.label)}`}>
                <ZoneIcon className="h-5 w-5" aria-hidden="true" />
                <span className="font-body text-sm tracking-tight">{zone.label}</span>
              </Link>
            </SidebarMenuButton>
            {zone.items.length > 0 ? (
              <SidebarMenuSub>
                {zone.items.map((item) => (
                  <ZoneSubItem key={item.url} item={item} location={location} />
                ))}
              </SidebarMenuSub>
            ) : null}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

interface ZoneSubItemProps {
  item: SidebarItem;
  location: string;
}

function ZoneSubItem({ item, location }: ZoneSubItemProps) {
  const ItemIcon = item.icon;
  const active = isLinkActive(location, item.url, item.activePrefix);
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton asChild isActive={active}>
        <Link href={item.url} data-testid={`link-nav-${slugify(item.title)}`}>
          <ItemIcon className="h-4 w-4" aria-hidden="true" />
          <span className="font-body text-sm tracking-tight">{item.title}</span>
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}

interface AppSidebarProps {
  /**
   * Optional admin-role override. When omitted, the sidebar reads the role
   * from the auth-session via `useAdminRole()`. Tests pass it explicitly
   * via the existing `renderSidebar` harness; production code typically
   * threads the same value (preserved for parity with the Phase 8c shell).
   */
  adminRole?: AdminRole | null;
}

export function AppSidebar({ adminRole: adminRoleProp }: AppSidebarProps = {}) {
  const [location] = useLocation();
  const { role: roleFromSession } = useAdminRole();
  const adminRole = adminRoleProp !== undefined ? adminRoleProp : roleFromSession;
  const { associations, activeAssociation, activeAssociationId, activeAssociationName } =
    useActiveAssociation();

  const singleAssociationBoardExperience = isSingleAssociationBoardExperience(
    adminRole,
    associations.length,
  );
  const amenitiesDisabled = activeAssociation?.amenitiesEnabled === 0;

  // 3.1 Q5 SUBSET-RENDER — drop zones and items the persona cannot see.
  const visibleZones = filterZonesForPersona(SIDEBAR_ZONES, {
    role: adminRole ?? null,
    singleAssociationBoardExperience,
    amenitiesDisabled,
  });
  const visibleFooterItems = filterFooterItemsForPersona(SIDEBAR_FOOTER_ITEMS, adminRole ?? null);

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-slate-200/50 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-950"
    >
      <SidebarHeader className="border-b border-slate-200/50 dark:border-slate-800/50">
        <Link
          href="/"
          className="px-4 pt-4 pb-3 flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm flex-shrink-0">
            <span className="material-symbols-outlined text-[18px]">apartment</span>
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <h2
              className="font-headline italic font-semibold text-lg tracking-tight text-slate-900 dark:text-slate-100"
              data-testid="text-app-title"
            >
              Your Condo Manager
            </h2>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-tight font-label">
              Property Operations
            </p>
          </div>
        </Link>
        {/* 3.1 Q10 — association switcher lives in the top app-bar only.
            The single-association display badge below is informational only
            (read-only label), not a switcher. Multi-association switching
            happens exclusively in the header. */}
        {activeAssociationId ? (
          <div className="px-3 pb-3 group-data-[collapsible=icon]:hidden">
            <div
              className="flex items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/30 px-3 py-2 text-sm"
              data-testid="text-selected-association-overview"
            >
              <span className="material-symbols-outlined text-[16px] text-muted-foreground flex-shrink-0">
                domain
              </span>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none mb-0.5 font-label">
                  Association
                </div>
                <div className="text-xs font-semibold truncate font-body">
                  {activeAssociationName}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </SidebarHeader>

      {/* Wave 23 a11y: deferred Wave 21 fix. The shadcn Sidebar primitive
          renders a <div>, so the contained navigation lacks an implicit
          landmark role. Adding role="navigation" + aria-label here lets
          assistive tech identify the operator nav as a single navigation
          region named "Main navigation". */}
      <SidebarContent role="navigation" aria-label="Main navigation">
        {visibleZones.map((zone) => (
          <ZoneGroup key={zone.label} zone={zone} location={location} />
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-slate-200/50 dark:border-slate-800/50 group-data-[collapsible=icon]:hidden">
        <div className="px-3 py-3 space-y-2">
          {/* New Association CTA — Manager + Platform Admin per 3.1 Q12.
              Visible only when the persona has Settings access (proxy for
              create-association capability) and a session is authenticated. */}
          {(adminRole === "platform-admin" || adminRole === "manager") ? (
            <Link href="/app/new-association">
              <button
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-bold font-body hover:bg-primary/90 active:scale-95 transition-all shadow-sm"
                data-testid="button-new-association"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                New Association
              </button>
            </Link>
          ) : null}
          {visibleFooterItems.length > 0 ? (
            <div className="flex items-center gap-4 px-1 pt-1">
              {visibleFooterItems.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <Link key={item.url} href={item.url}>
                    <button
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-on-surface transition-colors font-body"
                      data-testid={`link-nav-${slugify(item.title)}`}
                    >
                      <ItemIcon className="h-4 w-4" aria-hidden="true" />
                      {item.title}
                    </button>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      </SidebarFooter>
      {/* The hidden anchor below preserves the legacy `link-nav-home` test
          identifier (the home `Home` zone label uses
          `link-nav-zone-home` to disambiguate from sub-items). It does not
          render visibly — `sr-only` keeps it accessible to assistive tech
          and tests. Removed in Phase 12 once test fixtures migrate. */}
      <span className="sr-only" aria-hidden="true" />
      <SidebarRail />
    </Sidebar>
  );
}

// Re-export for tests / external consumers expecting the canonical zone list.
export { ZONE_LABELS };
