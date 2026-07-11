// founder-os#9487 — Board mode sidebar (volunteer-friendly nav).
//
// Rendered in place of the full <AppSidebar> whenever the user is on the Board
// surface (Board mode + advanced view off). It shows only the handful of
// sections a volunteer board actually uses, in plain English, plus a prominent
// Quick Actions block linking the five guided wizards. No Manager-only surfaces
// (multi-portfolio, platform controls, GL / accounting) are present in the DOM.
//
// The advanced-view toggle flips `advancedView` on — which swaps this sidebar
// out for the full technical <AppSidebar> and restores technical labels —
// without leaving Board mode. A "Switch to Manager view" control changes mode
// for dual-role users.

import { useLocation, Link } from "wouter";
import {
  Home,
  DollarSign,
  Users,
  CalendarDays,
  Wrench,
  FileText,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
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
} from "@/components/ui/sidebar";
import { BrandMark } from "@/components/brand-mark";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { setAdvancedView, setMode } from "@/context/view-mode";
import { BOARD_ACTIONS } from "./board-actions";

type BoardNavItem = { label: string; href: string; icon: LucideIcon; activePrefix?: string };

// Curated volunteer-facing sections. Each points at an existing surface; the
// labels are plain English (no "AR aging" / "governance" / "ledger").
const BOARD_NAV: BoardNavItem[] = [
  { label: "My board", href: "/app/board-home", icon: Home },
  { label: "Money owed", href: "/app/financial/billing", icon: DollarSign, activePrefix: "/app/financial" },
  { label: "Owners & homes", href: "/app/persons", icon: Users, activePrefix: "/app/persons" },
  { label: "Meetings", href: "/app/governance", icon: CalendarDays, activePrefix: "/app/governance" },
  { label: "Repairs", href: "/app/work-orders", icon: Wrench, activePrefix: "/app/work-orders" },
  { label: "Documents", href: "/app/documents", icon: FileText, activePrefix: "/app/documents" },
];

function isActive(location: string, item: BoardNavItem): boolean {
  const base = item.activePrefix ?? item.href;
  if (item.href === "/app/board-home") return location === "/app/board-home" || location === "/app";
  return location === item.href || location.startsWith(base);
}

export function BoardSidebar() {
  const [location] = useLocation();
  const { activeAssociationName } = useActiveAssociation();

  return (
    <Sidebar collapsible="icon" className="border-r border-slate-200/50 bg-slate-50" data-testid="board-sidebar">
      <SidebarHeader className="border-b border-slate-200/50">
        <Link href="/app/board-home" className="flex items-center gap-2.5 px-4 pb-3 pt-4 hover:opacity-80">
          <BrandMark forceTheme="dark" className="h-9 w-9 flex-shrink-0" />
          <div className="group-data-[collapsible=icon]:hidden">
            <h2 className="font-headline text-lg font-semibold italic tracking-tight text-sidebar-foreground" data-testid="text-app-title">
              Your Condo Manager
            </h2>
            <p className="font-label text-[10px] uppercase tracking-widest leading-tight text-muted-foreground">
              Board view
            </p>
          </div>
        </Link>
        {activeAssociationName ? (
          <div className="px-3 pb-3 group-data-[collapsible=icon]:hidden">
            <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/30 px-3 py-2">
              <div className="font-label text-[10px] uppercase tracking-wide leading-none text-muted-foreground">Community</div>
              <div className="truncate font-body text-xs font-semibold" data-testid="board-active-association">{activeAssociationName}</div>
            </div>
          </div>
        ) : null}
      </SidebarHeader>

      <SidebarContent role="navigation" aria-label="Board navigation">
        {/* Quick actions — the five guided wizards, front and center. */}
        <SidebarGroup>
          <SidebarGroupLabel className="label-caps text-muted-foreground/70">Quick actions</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {BOARD_ACTIONS.map((action) => {
                const ActionIcon = action.icon;
                const active = location === action.href;
                return (
                  <SidebarMenuItem key={action.id}>
                    <SidebarMenuButton asChild isActive={active} tooltip={action.label}>
                      <Link href={action.href} data-testid={`board-quick-${action.id}`}>
                        <ActionIcon className="h-4 w-4" aria-hidden="true" />
                        <span className="font-body text-sm tracking-tight">{action.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Everyday surfaces, plain-English labels. */}
        <SidebarGroup>
          <SidebarGroupLabel className="label-caps text-muted-foreground/70">Your community</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {BOARD_NAV.map((item) => {
                const ItemIcon = item.icon;
                const active = isActive(location, item);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link href={item.href} data-testid={`board-nav-${item.href.replace(/\//g, "-")}`}>
                        <ItemIcon className="h-4 w-4" aria-hidden="true" />
                        <span className="font-body text-sm tracking-tight">{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-slate-200/50 group-data-[collapsible=icon]:hidden">
        <div className="space-y-2 px-3 py-3">
          <button
            onClick={() => setAdvancedView(true)}
            className="flex w-full items-center gap-2 rounded-lg border border-sidebar-border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent/40 hover:text-foreground"
            data-testid="board-advanced-toggle"
          >
            <SlidersHorizontal className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span>Show advanced view</span>
          </button>
          <button
            onClick={() => setMode("manager")}
            className="w-full px-1 text-left text-[11px] text-muted-foreground/70 hover:text-foreground hover:underline"
            data-testid="board-switch-manager"
          >
            Switch to Manager view
          </button>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
