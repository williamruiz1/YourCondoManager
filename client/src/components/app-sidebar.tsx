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
  Flag,
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
  SidebarRail,
} from "@/components/ui/sidebar";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { canAccessWipRoute } from "@/lib/wip-features";

type AdminRole = "platform-admin" | "board-admin" | "manager" | "viewer";

type NavLink = {
  title: string;
  url: string;
  icon: LucideIcon;
  activePrefix?: string;
  roles?: AdminRole[];
};

type NavModule = NavLink & {
  children?: NavLink[];
};


// Top-level platform overview — always visible
const overviewModules: NavModule[] = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard },
  {
    title: "Portfolio",
    url: "/app/portfolio",
    icon: Layers,
    activePrefix: "/app/portfolio",
    roles: ["platform-admin", "board-admin", "manager", "viewer"],
  },
  {
    title: "Associations",
    url: "/app/associations",
    icon: Building2,
    activePrefix: "/app/associations",
  },
];

// Scoped to the selected association — shown under the association's name
const associationModules: NavModule[] = [
  {
    title: "Buildings & Units",
    url: "/app/units",
    icon: DoorOpen,
    activePrefix: "/app/units",
    roles: ["platform-admin", "board-admin", "manager"],
    children: [
      { title: "People", url: "/app/persons", icon: Contact, roles: ["platform-admin", "board-admin", "manager"] },
    ],
  },
  {
    title: "Finance",
    url: "/app/financial/foundation",
    icon: CircleDollarSign,
    activePrefix: "/app/financial",
    roles: ["platform-admin", "board-admin", "manager", "viewer"],
  },
  {
    title: "Board",
    url: "/app/board",
    icon: UserCheck,
    roles: ["platform-admin", "board-admin", "manager", "viewer"],
    children: [
      { title: "Board Packages", url: "/app/governance/board-packages", icon: PackageOpen, roles: ["platform-admin", "board-admin", "manager", "viewer"] },
      { title: "Meetings", url: "/app/governance/meetings", icon: CalendarDays, roles: ["platform-admin", "board-admin", "manager", "viewer"] },
      { title: "Compliance", url: "/app/governance/compliance", icon: ClipboardCheck, roles: ["platform-admin", "board-admin", "manager", "viewer"] },
      { title: "Communications", url: "/app/communications", icon: MessageSquare, activePrefix: "/app/communications", roles: ["platform-admin", "board-admin", "manager", "viewer"] },
    ],
  },
  {
    title: "Documents",
    url: "/app/documents",
    icon: FileText,
    activePrefix: "/app/documents",
    roles: ["platform-admin", "board-admin", "manager", "viewer"],
  },
  {
    title: "Operations",
    url: "/app/operations/dashboard",
    icon: ClipboardList,
    activePrefix: "/app/operations",
    roles: ["platform-admin", "board-admin", "manager", "viewer"],
    children: [
      { title: "Work Orders", url: "/app/work-orders", icon: ClipboardList, activePrefix: "/app/work-orders", roles: ["platform-admin", "board-admin", "manager", "viewer"] },
      { title: "Vendors", url: "/app/vendors", icon: BriefcaseBusiness, activePrefix: "/app/vendors", roles: ["platform-admin", "board-admin", "manager", "viewer"] },
    ],
  },
];

// Platform-admin-only controls
const platformModules: NavModule[] = [
  {
    title: "Platform Controls",
    url: "/app/platform/controls",
    icon: SlidersHorizontal,
    activePrefix: "/app/platform",
    roles: ["platform-admin"],
    children: [
      { title: "Owner Portal", url: "/portal", icon: Contact, roles: ["platform-admin"] },
      { title: "Admin Roadmap", url: "/app/admin/roadmap", icon: ListChecks, activePrefix: "/app/admin", roles: ["platform-admin"] },
      { title: "Feature Flags", url: "/app/admin/feature-flags", icon: Flag, roles: ["platform-admin"] },
    ],
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
  return adminRole === "board-admin" && associationCount <= 1;
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
  const { associations, activeAssociationId, activeAssociationName } = useActiveAssociation();
  const singleAssociationBoardExperience = isSingleAssociationBoardExperience(adminRole, associations.length);
  const visibleOverview = filterModules(
    singleAssociationBoardExperience
      ? overviewModules.filter((module) => module.url !== "/app/portfolio" && module.url !== "/app/associations")
      : overviewModules,
    adminRole,
  );
  const visibleAssociation = filterModules(associationModules, adminRole);
  const visiblePlatform = filterModules(platformModules, adminRole);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link href="/" className="p-4 flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm flex-shrink-0">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <h2 className="text-sm font-semibold tracking-[-0.01em]" data-testid="text-app-title">
              CondoManager
            </h2>
            <p className="text-[11px] text-muted-foreground leading-tight">Property Platform</p>
          </div>
        </Link>
        <div className="px-3 pb-3 group-data-[collapsible=icon]:hidden">
          {activeAssociationId ? (
            singleAssociationBoardExperience ? (
              <div
                className="flex items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/30 px-3 py-2 text-sm"
                data-testid="text-selected-association-overview"
              >
                <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none mb-0.5">Association</div>
                  <div className="text-xs font-semibold truncate">{activeAssociationName}</div>
                </div>
              </div>
            ) : (
              <Link
                href="/app/association-context"
                className="flex items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/30 px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent/60"
                data-testid="link-selected-association-overview"
              >
                <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none mb-0.5">Association</div>
                  <div className="text-xs font-semibold truncate">{activeAssociationName}</div>
                </div>
              </Link>
            )
          ) : (
            <Link
              href="/app/association-context"
              className="flex items-center gap-2 rounded-lg border border-dashed border-sidebar-border px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent/30"
            >
              <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground">Select association</span>
            </Link>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {/* Overview: Dashboard, Portfolio, Associations */}
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleOverview.map((module) => (
                <SidebarMenuItem key={module.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isLinkActive(location, module)}
                    tooltip={module.title}
                    className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                  >
                    <Link href={module.url} data-testid={`link-nav-${module.title.toLowerCase().replace(/\s+/g, "-")}`}>
                      <module.icon className="h-4 w-4" />
                      <span>{module.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Association workspace — scoped to selected association */}
        {visibleAssociation.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="truncate">
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
                        className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                      >
                        <Link href={module.url} data-testid={`link-nav-${module.title.toLowerCase().replace(/\s+/g, "-")}`}>
                          <module.icon className="h-4 w-4" />
                          <span>{module.title}</span>
                        </Link>
                      </SidebarMenuButton>
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
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
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
                        className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                      >
                        <Link href={module.url} data-testid={`link-nav-${module.title.toLowerCase().replace(/\s+/g, "-")}`}>
                          <module.icon className="h-4 w-4" />
                          <span>{module.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
