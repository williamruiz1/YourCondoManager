import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Building2,
  DoorOpen,
  Users,
  Home,
  UserCheck,
  FileText,
  Contact,
  CircleDollarSign,
  Landmark,
  Percent,
  FolderCog,
  ReceiptText,
  Lightbulb,
  BookOpenCheck,
  Calculator,
  ClipboardCheck,
  CalendarDays,
  Bot,
  MessageSquare,
  SlidersHorizontal,
  ListChecks,
  BriefcaseBusiness,
  ClipboardList,
  PackageOpen,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import type { Document } from "@shared/schema";
import { useActiveAssociation } from "@/hooks/use-active-association";

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

type NavSection = {
  label: string;
  modules: NavModule[];
};

const navSections: NavSection[] = [
  {
    label: "Overview",
    modules: [
      { title: "Dashboard", url: "/app", icon: LayoutDashboard },
      {
        title: "Associations",
        url: "/app/associations",
        icon: Building2,
        activePrefix: "/app/associations",
      },
    ],
  },
  {
    label: "Residential",
    modules: [
      {
        title: "Units",
        url: "/app/units",
        icon: DoorOpen,
        activePrefix: "/app/units",
        roles: ["platform-admin", "board-admin", "manager"],
        children: [
          { title: "People", url: "/app/persons", icon: Contact, roles: ["platform-admin", "board-admin", "manager"] },
          { title: "Owners", url: "/app/owners", icon: Users, roles: ["platform-admin", "board-admin", "manager"] },
          { title: "Occupancy", url: "/app/occupancy", icon: Home, roles: ["platform-admin", "board-admin", "manager"] },
        ],
      },
    ],
  },
  {
    label: "Governance",
    modules: [
      {
        title: "Board Members",
        url: "/app/board",
        icon: UserCheck,
        roles: ["platform-admin", "board-admin", "manager", "viewer"],
        children: [
          { title: "Board Packages", url: "/app/governance/board-packages", icon: PackageOpen, roles: ["platform-admin", "board-admin", "manager", "viewer"] },
          { title: "Meetings", url: "/app/governance/meetings", icon: CalendarDays, roles: ["platform-admin", "board-admin", "manager", "viewer"] },
          { title: "Compliance", url: "/app/governance/compliance", icon: ClipboardCheck, roles: ["platform-admin", "board-admin", "manager", "viewer"] },
        ],
      },
    ],
  },
  {
    label: "Finance",
    modules: [
      {
        title: "Finance Setup",
        url: "/app/financial/foundation",
        icon: FolderCog,
        activePrefix: "/app/financial",
        roles: ["platform-admin", "board-admin", "manager"],
        children: [
          { title: "Fee Schedules", url: "/app/financial/fees", icon: CircleDollarSign, roles: ["platform-admin", "board-admin", "manager"] },
          { title: "Assessments", url: "/app/financial/assessments", icon: Landmark, roles: ["platform-admin", "board-admin", "manager"] },
          { title: "Late Fees", url: "/app/financial/late-fees", icon: Percent, roles: ["platform-admin", "board-admin", "manager"] },
          { title: "Invoices", url: "/app/financial/invoices", icon: ReceiptText, roles: ["platform-admin", "board-admin", "manager"] },
          { title: "Utilities", url: "/app/financial/utilities", icon: Lightbulb, roles: ["platform-admin", "board-admin", "manager"] },
          { title: "Owner Ledger", url: "/app/financial/ledger", icon: BookOpenCheck, roles: ["platform-admin", "board-admin", "manager", "viewer"] },
          { title: "Payments", url: "/app/financial/payments", icon: CircleDollarSign, roles: ["platform-admin", "board-admin", "manager"] },
          { title: "Budgets", url: "/app/financial/budgets", icon: Calculator, roles: ["platform-admin", "board-admin", "manager", "viewer"] },
        ],
      },
    ],
  },
  {
    label: "Operations",
    modules: [
      {
        title: "Operations Dashboard",
        url: "/app/operations/dashboard",
        icon: LayoutDashboard,
        roles: ["platform-admin", "board-admin", "manager", "viewer"],
      },
      {
        title: "Vendors",
        url: "/app/vendors",
        icon: BriefcaseBusiness,
        roles: ["platform-admin", "board-admin", "manager", "viewer"],
      },
      {
        title: "Work Orders",
        url: "/app/work-orders",
        icon: ClipboardList,
        roles: ["platform-admin", "board-admin", "manager", "viewer"],
      },
      {
        title: "Maintenance Schedules",
        url: "/app/maintenance-schedules",
        icon: CalendarDays,
        roles: ["platform-admin", "board-admin", "manager", "viewer"],
      },
      {
        title: "Inspections",
        url: "/app/inspections",
        icon: ClipboardCheck,
        roles: ["platform-admin", "board-admin", "manager", "viewer"],
      },
      {
        title: "Communications",
        url: "/app/communications",
        icon: MessageSquare,
        roles: ["platform-admin", "board-admin", "manager", "viewer"],
        children: [
          { title: "AI Ingestion", url: "/app/ai/ingestion", icon: Bot, roles: ["platform-admin", "board-admin", "manager"] },
        ],
      },
    ],
  },
  {
    label: "Platform",
    modules: [
      {
        title: "Platform Controls",
        url: "/app/platform/controls",
        icon: SlidersHorizontal,
        activePrefix: "/app/platform",
        roles: ["platform-admin"],
        children: [
          { title: "Owner Portal", url: "/portal", icon: Contact, roles: ["platform-admin"] },
          { title: "Admin Roadmap", url: "/app/admin/roadmap", icon: ListChecks, activePrefix: "/app/admin", roles: ["platform-admin", "board-admin"] },
        ],
      },
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

export function AppSidebar({ adminRole }: { adminRole?: AdminRole | null }) {
  const [location] = useLocation();
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
    enabled: Boolean(activeAssociationId),
  });
  const visibleSections = navSections
    .map((section) => ({
      ...section,
      modules: section.modules
        .filter((module) => canAccess(module, adminRole))
        .map((module) => ({
          ...module,
          children: module.children?.filter((child) => canAccess(child, adminRole)),
        })),
    }))
    .filter((section) => section.modules.length > 0);
  const overviewSection = visibleSections.find((section) => section.label === "Overview");
  const remainingSections = visibleSections.filter((section) => section.label !== "Overview");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <h2 className="text-sm font-semibold tracking-tight" data-testid="text-app-title">
              CondoManager
            </h2>
            <p className="text-xs text-muted-foreground">Property Platform</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {overviewSection ? (
          <SidebarGroup key={overviewSection.label}>
            <SidebarGroupLabel>{overviewSection.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {overviewSection.modules.map((module) => {
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
        ) : null}

        <SidebarGroup>
          <SidebarGroupLabel>In Context</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="mx-2 mb-3 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3 group-data-[collapsible=icon]:hidden">
              {activeAssociationId ? (
                <Link
                  href="/app/association-context"
                  className="block rounded-md transition-colors hover:bg-sidebar-accent/60 focus:outline-none focus:ring-2 focus:ring-sidebar-ring"
                  data-testid="link-selected-association-overview"
                >
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Selected Association</div>
                  <div className="mt-1 text-sm font-semibold">{activeAssociationName || "No association selected"}</div>
                </Link>
              ) : (
                <div className="rounded-md">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Selected Association</div>
                  <div className="mt-1 text-sm font-semibold">{activeAssociationName || "No association selected"}</div>
                </div>
              )}
              <div className="mt-3 space-y-1">
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location.startsWith("/app/documents")} tooltip="Documents">
                      <Link href="/app/documents">
                        <FileText className="h-4 w-4" />
                        <span>Documents</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                {activeAssociationId ? `${documents.length} documents in this association` : "Set context from the header selector"}
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
        {remainingSections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.modules.map((module) => {
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
                      {module.children?.length ? (
                        <SidebarMenuSub>
                          {module.children.map((child) => (
                            <SidebarMenuSubItem key={child.title}>
                              <SidebarMenuSubButton asChild isActive={isLinkActive(location, child)}>
                                <Link href={child.url} data-testid={`link-nav-${child.title.toLowerCase().replace(/\s+/g, "-")}`}>
                                  <child.icon className="h-3.5 w-3.5" />
                                  <span>{child.title}</span>
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
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
