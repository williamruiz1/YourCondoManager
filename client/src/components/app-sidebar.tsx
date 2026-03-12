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
} from "@/components/ui/sidebar";
import type { Document } from "@shared/schema";
import { useActiveAssociation } from "@/hooks/use-active-association";

type NavLink = {
  title: string;
  url: string;
  icon: LucideIcon;
  activePrefix?: string;
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
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      {
        title: "Associations",
        url: "/associations",
        icon: Building2,
        activePrefix: "/associations",
      },
    ],
  },
  {
    label: "Residential",
    modules: [
      {
        title: "Units",
        url: "/units",
        icon: DoorOpen,
        activePrefix: "/units",
        children: [
          { title: "People", url: "/persons", icon: Contact },
          { title: "Owners", url: "/owners", icon: Users },
          { title: "Occupancy", url: "/occupancy", icon: Home },
        ],
      },
    ],
  },
  {
    label: "Governance",
    modules: [
      {
        title: "Board Members",
        url: "/board",
        icon: UserCheck,
        children: [
          { title: "Meetings", url: "/governance/meetings", icon: CalendarDays },
          { title: "Compliance", url: "/governance/compliance", icon: ClipboardCheck },
        ],
      },
    ],
  },
  {
    label: "Finance",
    modules: [
      {
        title: "Finance Setup",
        url: "/financial/foundation",
        icon: FolderCog,
        activePrefix: "/financial",
        children: [
          { title: "Fee Schedules", url: "/financial/fees", icon: CircleDollarSign },
          { title: "Assessments", url: "/financial/assessments", icon: Landmark },
          { title: "Late Fees", url: "/financial/late-fees", icon: Percent },
          { title: "Invoices", url: "/financial/invoices", icon: ReceiptText },
          { title: "Utilities", url: "/financial/utilities", icon: Lightbulb },
          { title: "Owner Ledger", url: "/financial/ledger", icon: BookOpenCheck },
          { title: "Payments", url: "/financial/payments", icon: CircleDollarSign },
          { title: "Budgets", url: "/financial/budgets", icon: Calculator },
        ],
      },
    ],
  },
  {
    label: "Operations",
    modules: [
      {
        title: "Communications",
        url: "/communications",
        icon: MessageSquare,
        children: [
          { title: "AI Ingestion", url: "/ai/ingestion", icon: Bot },
        ],
      },
    ],
  },
  {
    label: "Platform",
    modules: [
      {
        title: "Platform Controls",
        url: "/platform/controls",
        icon: SlidersHorizontal,
        activePrefix: "/platform",
        children: [
          { title: "Owner Portal", url: "/portal", icon: Contact },
          { title: "Admin Roadmap", url: "/admin/roadmap", icon: ListChecks, activePrefix: "/admin" },
        ],
      },
    ],
  },
];

function isLinkActive(location: string, item: NavLink): boolean {
  const activeBase = item.activePrefix ?? item.url;
  return item.url === "/" ? location === "/" : location.startsWith(activeBase);
}

export function AppSidebar() {
  const [location] = useLocation();
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
    enabled: Boolean(activeAssociationId),
  });
  const overviewSection = navSections.find((section) => section.label === "Overview");
  const remainingSections = navSections.filter((section) => section.label !== "Overview");

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
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
            <div className="mx-2 mb-3 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3">
              {activeAssociationId ? (
                <Link
                  href="/association-context"
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
                    <SidebarMenuButton asChild isActive={location.startsWith("/documents")}>
                      <Link href="/documents">
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
    </Sidebar>
  );
}
