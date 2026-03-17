import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Building2, CalendarDays, CircleDollarSign, Contact, DoorOpen, FileText, FolderOpen, LayoutDashboard, MessageSquare, Search, Users, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useAssociationContext } from "@/context/association-context";
import { canAccessWipRoute } from "@/lib/wip-features";

type AdminRole = "platform-admin" | "board-admin" | "manager" | "viewer";

type CommandLink = {
  label: string;
  href: string;
  keywords: string;
  icon: typeof LayoutDashboard;
  roles?: AdminRole[];
};

const RECENT_ROUTE_STORAGE_KEY = "workspaceRecentRoutes";

const navigationLinks: CommandLink[] = [
  { label: "Dashboard", href: "/app", keywords: "overview home portfolio", icon: LayoutDashboard },
  { label: "Association Context", href: "/app/association-context", keywords: "context association scope workspace", icon: Building2 },
  { label: "Buildings & Units", href: "/app/units", keywords: "buildings units residences doors apartments", icon: DoorOpen },
  { label: "People", href: "/app/persons", keywords: "people residents contacts roster owners tenants", icon: Contact },
  { label: "Residential Coverage", href: "/app/association-context", keywords: "occupancy tenants residents unit coverage", icon: Building2 },
  { label: "Documents", href: "/app/documents", keywords: "files repository document metadata", icon: FileText },
  { label: "Owner Ledger", href: "/app/financial/ledger", keywords: "finance balances ledger charges payments", icon: CircleDollarSign },
  { label: "Board", href: "/app/board", keywords: "board members governance", icon: Users },
  { label: "Meetings", href: "/app/governance/meetings", keywords: "governance meetings calendar", icon: CalendarDays },
  { label: "Associations", href: "/app/associations", keywords: "association directory buildings", icon: FolderOpen },
  { label: "Communications", href: "/app/communications", keywords: "communications notices templates email outreach", icon: MessageSquare },
];

const createLinks: CommandLink[] = [
  { label: "Upload Document", href: "/app/documents", keywords: "create upload document", icon: FileText },
  { label: "Post Ledger Entry", href: "/app/financial/ledger", keywords: "create ledger entry charge payment", icon: CircleDollarSign },
  { label: "Create Notice Template", href: "/app/communications", keywords: "create communications template notice", icon: MessageSquare },
  { label: "Add Board Member", href: "/app/board", keywords: "create board role member", icon: Users },
];

function canAccess(item: CommandLink, role?: AdminRole | null) {
  if (!canAccessWipRoute(item.href, role)) return false;
  if (!item.roles?.length) return true;
  if (!role) return true;
  return item.roles.includes(role);
}

type SearchResult = { type: string; id: string; label: string; href: string };

const SEARCH_ICON: Record<string, typeof Search> = {
  person: Contact,
  unit: DoorOpen,
  vendor: Users,
  "work-order": Wrench,
  document: FileText,
};

export function GlobalCommandPalette({ adminRole }: { adminRole?: AdminRole | null }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [location, navigate] = useLocation();
  const { associations, activeAssociationId, setActiveAssociationId } = useAssociationContext();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!location.startsWith("/app")) return;
    const raw = window.localStorage.getItem(RECENT_ROUTE_STORAGE_KEY);
    const current = raw ? (JSON.parse(raw) as string[]) : [];
    const next = [location, ...current.filter((entry) => entry !== location)].slice(0, 6);
    window.localStorage.setItem(RECENT_ROUTE_STORAGE_KEY, JSON.stringify(next));
  }, [location]);

  useEffect(() => {
    if (!open) { setQuery(""); setSearchResults([]); return; }
  }, [open]);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (query.length < 2) { setSearchResults([]); return; }
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await apiRequest("GET", `/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json() as { results: SearchResult[] };
        setSearchResults(data.results ?? []);
      } catch {
        setSearchResults([]);
      }
    }, 250);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [query]);

  const recentLinks = useMemo(() => {
    const raw = window.localStorage.getItem(RECENT_ROUTE_STORAGE_KEY);
    const current = raw ? (JSON.parse(raw) as string[]) : [];
    return current
      .map((href) => navigationLinks.find((item) => item.href === href))
      .filter((item): item is CommandLink => Boolean(item))
      .filter((item) => canAccess(item, adminRole));
  }, [adminRole, open]);

  const filteredNavigation = navigationLinks.filter((item) => canAccess(item, adminRole));
  const filteredCreate = createLinks.filter((item) => canAccess(item, adminRole));

  function openRoute(href: string) {
    setOpen(false);
    navigate(href);
  }

  return (
    <>
      <Button variant="outline" size="sm" className="hidden md:flex min-w-[220px] justify-between" onClick={() => setOpen(true)}>
        <span className="inline-flex items-center gap-2 text-muted-foreground">
          <Search className="h-4 w-4" />
          Search, jump, or create
        </span>
        <span className="text-xs text-muted-foreground">Ctrl K</span>
      </Button>
      <Button variant="outline" size="icon" className="md:hidden" onClick={() => setOpen(true)}>
        <Search className="h-4 w-4" />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search records, pages, and associations…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>{query.length >= 2 ? "No results found." : "Type to search records or navigate."}</CommandEmpty>

          {searchResults.length > 0 && (
            <CommandGroup heading="Records">
              {searchResults.map((result) => {
                const Icon = SEARCH_ICON[result.type] ?? Search;
                return (
                  <CommandItem key={`${result.type}-${result.id}`} onSelect={() => openRoute(result.href)} value={result.label}>
                    <Icon />
                    <span className="truncate">{result.label}</span>
                    <CommandShortcut className="capitalize">{result.type.replace("-", " ")}</CommandShortcut>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
          {searchResults.length > 0 && <CommandSeparator />}

          {recentLinks.length ? (
            <CommandGroup heading="Recent">
              {recentLinks.map((item) => (
                <CommandItem key={`recent-${item.href}`} onSelect={() => openRoute(item.href)} value={`${item.label} ${item.keywords}`}>
                  <item.icon />
                  <span>{item.label}</span>
                  <CommandShortcut>Recent</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          <CommandGroup heading="Navigate">
            {filteredNavigation.map((item) => (
              <CommandItem key={item.href} onSelect={() => openRoute(item.href)} value={`${item.label} ${item.keywords}`}>
                <item.icon />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Create">
            {filteredCreate.map((item) => (
              <CommandItem key={`create-${item.href}`} onSelect={() => openRoute(item.href)} value={`${item.label} ${item.keywords}`}>
                <item.icon />
                <span>{item.label}</span>
                <CommandShortcut>Action</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Association Scope">
            {associations.map((association) => (
              <CommandItem
                key={association.id}
                onSelect={() => {
                  setActiveAssociationId(association.id);
                  setOpen(false);
                }}
                value={`${association.name} association scope ${association.city || ""} ${association.state || ""}`}
              >
                <Building2 />
                <span>{association.name}</span>
                <CommandShortcut>{association.id === activeAssociationId ? "Active" : "Switch"}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
