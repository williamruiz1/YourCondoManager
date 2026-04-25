// zone: Home
// persona: Owner
//
// 3.5 Q3 — PortalShell mirrors /app's WorkspaceShell: centralizes the
// session gate (Q4 shell-owned), the four-zone sidebar nav (1.1 Q5 zone
// vocabulary), the breadcrumb host (1.3), and the document-title
// scaffolding (1.4 Q7). All /portal/* routes inherit the gate via the
// shell; no per-route gate declarations.
//
// Spec anchors:
//  - docs/projects/platform-overhaul/decisions/3.5-owner-portal-restructure.md
//  - docs/projects/platform-overhaul/decisions/1.1-zone-taxonomy-corrections.md#q5
//  - docs/projects/platform-overhaul/decisions/2.2-owner-portal-access-boundaries.md
//  - docs/projects/platform-overhaul/decisions/4.2-owner-portal-gaps.md

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { PortalAccess } from "@shared/schema";
import { OwnerPortalLoginContainer } from "@/components/owner-portal-login-container";

// Session shape returned by /api/portal/me, post Phase 8a role collapse
// (portalAccess.role is now "owner" | "board-member" per 2.2 / Phase 8a).
export type PortalSession = PortalAccess & {
  hasBoardAccess: boolean;
  effectiveRole: string;
  boardRoleId: string | null;
  unitNumber: string | null;
  building: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  mailingAddress: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  contactPreference: string | null;
  smsOptIn: number | null;
};

export type PortalAssociationChoice = {
  associationId: string;
  associationName: string;
};

export type PortalContextValue = {
  portalAccessId: string;
  session: PortalSession;
  portalFetch: (url: string, init?: RequestInit) => Promise<Response>;
  handleLogout: () => void;
  portalHasBoardAccess: boolean;
  associationName: string | null;
  associationId: string | null;
  myAssociations: PortalAssociationChoice[];
};

const PortalContext = createContext<PortalContextValue | null>(null);

export function usePortalContext(): PortalContextValue {
  const ctx = useContext(PortalContext);
  if (!ctx) {
    throw new Error("usePortalContext must be used within a PortalShell");
  }
  return ctx;
}

/**
 * Phase 8b pattern — treat user as an owner at the UI level; board-member
 * privileges surface via this boolean. Each zone file consumes the flag
 * when it needs to unlock board-only controls (e.g., the board dashboard
 * card on the Home zone).
 */
export function usePortalHasBoardAccess(): boolean {
  return usePortalContext().portalHasBoardAccess;
}

type PortalNavItem = {
  to: string;
  label: string;
  icon: string;
  matches: (pathname: string) => boolean;
  badge?: number;
};

/**
 * 1.1 Q5 — four first-person zones. `/portal/amenities`, `/portal/documents`,
 * and `/portal/notices` are sub-routes under the shell but not top-level
 * sidebar entries (they surface via links from Home / My Community / etc.).
 */
function buildNav(pathname: string, openRequests: number, unreadNotices: number): PortalNavItem[] {
  return [
    {
      to: "/portal",
      label: "Home",
      icon: "home",
      matches: (p) => p === "/portal",
    },
    {
      to: "/portal/finances",
      label: "My Finances",
      icon: "payments",
      matches: (p) => p === "/portal/finances" || p.startsWith("/portal/finances/"),
    },
    {
      to: "/portal/requests",
      label: "My Requests",
      icon: "build",
      matches: (p) => p === "/portal/requests" || p.startsWith("/portal/requests/"),
      badge: openRequests > 0 ? openRequests : undefined,
    },
    {
      to: "/portal/community",
      label: "My Community",
      icon: "apartment",
      matches: (p) =>
        p === "/portal/community" ||
        p.startsWith("/portal/community/") ||
        p === "/portal/amenities" ||
        p === "/portal/notices" ||
        p === "/portal/documents",
      badge: unreadNotices > 0 ? unreadNotices : undefined,
    },
  ];
}

/**
 * 1.3 — breadcrumb trail helper.
 *
 * The portal keeps a local breadcrumb resolution separate from the /app
 * BREADCRUMB_PATHS table per persona-scope: /app's table is the operator-side
 * source of truth, and the portal's first-person zone vocabulary lives alongside
 * the zone files that own it. Trails are ≤3 segments per 1.3 Q4.
 */
export function resolvePortalBreadcrumb(pathname: string): Array<{ label: string; href?: string }> {
  if (pathname === "/portal") return [{ label: "Home" }];
  if (pathname === "/portal/finances") return [{ label: "My Finances" }];
  if (pathname === "/portal/finances/payment-methods")
    return [{ label: "My Finances", href: "/portal/finances" }, { label: "Payment methods" }];
  if (pathname === "/portal/finances/ledger")
    return [{ label: "My Finances", href: "/portal/finances" }, { label: "Ledger" }];
  if (pathname.startsWith("/portal/finances/assessments/"))
    return [{ label: "My Finances", href: "/portal/finances" }, { label: "Assessment detail" }];
  if (pathname === "/portal/requests") return [{ label: "My Requests" }];
  if (pathname.startsWith("/portal/requests/"))
    return [{ label: "My Requests", href: "/portal/requests" }, { label: "Request detail" }];
  if (pathname === "/portal/community") return [{ label: "My Community" }];
  if (pathname === "/portal/amenities")
    return [{ label: "My Community", href: "/portal/community" }, { label: "Amenities" }];
  if (pathname === "/portal/notices")
    return [{ label: "My Community", href: "/portal/community" }, { label: "Notices" }];
  if (pathname === "/portal/documents")
    return [{ label: "My Community", href: "/portal/community" }, { label: "Documents" }];
  return [];
}

type ShellHeaderProps = {
  session: PortalSession;
  associationName: string | null;
  onLogout: () => void;
};

function ShellHeader({ session, associationName, onLogout }: ShellHeaderProps) {
  const displayName = [session.firstName, session.lastName].filter(Boolean).join(" ") || session.email || "Owner";
  const title = associationName ? `${associationName} — Owner Portal` : "Owner Portal";
  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-outline-variant/10 bg-surface-bright/80 px-4 py-3 backdrop-blur md:px-8"
      data-testid="portal-header"
    >
      <h1 className="truncate text-lg font-semibold text-on-surface md:text-xl" data-testid="portal-header-title">
        {title}
      </h1>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="truncate text-xs font-semibold text-on-surface" data-testid="portal-header-user">
            {displayName}
          </p>
          {session.hasBoardAccess ? (
            <p className="text-[10px] uppercase tracking-widest text-primary">Board access</p>
          ) : (
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Owner</p>
          )}
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-md border border-outline-variant/30 px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
          data-testid="portal-header-logout"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

type ShellSidebarProps = {
  items: PortalNavItem[];
  pathname: string;
  associationId: string | null;
};

function ShellSidebar({ items, pathname, associationId }: ShellSidebarProps) {
  return (
    <aside
      className="hidden w-60 shrink-0 flex-col border-r border-outline-variant/15 bg-surface px-4 py-8 md:flex"
      data-testid="portal-sidebar"
    >
      <div className="mb-10 px-2">
        <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/60">YCM</p>
        <p className="mt-1 font-serif text-lg italic text-primary">Owner Portal</p>
      </div>
      <nav className="flex-1 space-y-1" aria-label="Portal navigation">
        {items.map((item) => {
          const active = item.matches(pathname);
          return (
            <Link
              key={item.to}
              href={item.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                active
                  ? "bg-surface-container-highest text-primary"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-primary"
              }`}
              data-testid={`portal-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <span className="material-symbols-outlined text-base">{item.icon}</span>
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
        {associationId ? (
          <a
            href={`/community/${associationId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-on-surface-variant hover:bg-surface-container hover:text-primary"
            data-testid="portal-nav-public-community"
          >
            <span className="material-symbols-outlined text-base">public</span>
            <span className="flex-1 truncate">Public community hub</span>
            <span className="material-symbols-outlined text-xs opacity-60">open_in_new</span>
          </a>
        ) : null}
      </nav>
    </aside>
  );
}

type ShellBreadcrumbProps = {
  trail: Array<{ label: string; href?: string }>;
};

function ShellBreadcrumb({ trail }: ShellBreadcrumbProps) {
  if (trail.length === 0) return null;
  return (
    <nav
      aria-label="Breadcrumb"
      className="border-b border-outline-variant/10 bg-surface-container-lowest px-4 py-2 md:px-8"
      data-testid="portal-breadcrumb"
    >
      <ol className="flex flex-wrap items-center gap-1 text-xs text-on-surface-variant">
        {trail.map((segment, idx) => {
          const isLast = idx === trail.length - 1;
          return (
            <li key={`${segment.label}-${idx}`} className="flex items-center gap-1">
              {idx > 0 ? <span className="text-on-surface-variant/50">/</span> : null}
              {segment.href && !isLast ? (
                <Link href={segment.href} className="hover:text-primary">
                  {segment.label}
                </Link>
              ) : (
                <span className={isLast ? "font-semibold text-on-surface" : undefined} aria-current={isLast ? "page" : undefined}>
                  {segment.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

type PortalShellProps = {
  children: ReactNode;
};

/**
 * PortalShell — single shell owning:
 *  - session gate (Q4)
 *  - four-zone sidebar nav (1.1 Q5)
 *  - breadcrumb host (1.3)
 *  - header + logout
 *
 * Every /portal/* route wraps itself with <PortalShell>. No route declares
 * its own session-redirect logic.
 */
export function PortalShell({ children }: PortalShellProps) {
  const [location] = useLocation();
  const [portalAccessId, setPortalAccessId] = useState<string | null>(() =>
    typeof window !== "undefined" ? window.localStorage.getItem("portalAccessId") : null,
  );

  const portalFetch = useCallback(
    (url: string, init: RequestInit = {}) =>
      fetch(url, {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          "x-portal-access-id": portalAccessId ?? "",
        },
      }),
    [portalAccessId],
  );

  const {
    data: session,
    error: sessionError,
    isError: sessionIsError,
    refetch: refetchSession,
  } = useQuery<PortalSession>({
    queryKey: ["portal/me", portalAccessId],
    enabled: !!portalAccessId,
    retry: 2,
    queryFn: async () => {
      if (!portalAccessId) throw new Error("missing portal access id");
      const res = await portalFetch("/api/portal/me");
      if (!res.ok) throw new Error(`Portal session failed (${res.status})`);
      return (await res.json()) as PortalSession;
    },
  });

  const { data: myAssociations } = useQuery<PortalAssociationChoice[]>({
    queryKey: ["portal/my-associations", portalAccessId],
    enabled: !!portalAccessId && !!session,
    queryFn: async () => {
      const res = await portalFetch("/api/portal/my-associations");
      if (!res.ok) return [];
      return (await res.json()) as PortalAssociationChoice[];
    },
  });

  const { data: openRequestsCount = 0 } = useQuery<number>({
    queryKey: ["portal/requests/open-count", portalAccessId],
    enabled: !!portalAccessId && !!session,
    queryFn: async () => {
      const res = await portalFetch("/api/portal/maintenance-requests");
      if (!res.ok) return 0;
      const list = (await res.json()) as Array<{ status: string }>;
      return list.filter((r) => !["resolved", "closed", "rejected"].includes(r.status)).length;
    },
  });

  const { data: unreadNoticesCount = 0 } = useQuery<number>({
    queryKey: ["portal/notices/unread-count", portalAccessId],
    enabled: !!portalAccessId && !!session,
    queryFn: async () => {
      const res = await portalFetch("/api/portal/notices");
      if (!res.ok) return 0;
      const list = (await res.json()) as Array<{ id: string }>;
      const readKey = `portal-read-notices-${portalAccessId}`;
      let readIds: string[] = [];
      try {
        const raw = window.localStorage.getItem(readKey);
        readIds = raw ? (JSON.parse(raw) as string[]) : [];
      } catch {
        readIds = [];
      }
      return list.filter((n) => !readIds.includes(n.id)).length;
    },
  });

  const handleLogout = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("portalAccessId");
    }
    setPortalAccessId(null);
  }, []);

  const associationName = myAssociations?.[0]?.associationName ?? null;
  const associationId = session?.associationId ?? null;

  const navItems = useMemo(
    () => buildNav(location, openRequestsCount, unreadNoticesCount),
    [location, openRequestsCount, unreadNoticesCount],
  );

  const breadcrumbTrail = useMemo(() => resolvePortalBreadcrumb(location), [location]);

  // Legacy-URL compat layer (Q8). /portal?tab=<legacy> is redirected once
  // on first render to the new hub URL. This is a thin client-side
  // router-level redirect; the compat layer retires in 5.1 per the spec.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (location !== "/portal") return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (!tab) return;
    const map: Record<string, string> = {
      overview: "/portal",
      financials: "/portal/finances",
      requests: "/portal/requests",
      maintenance: "/portal/requests",
      community: "/portal/community",
      amenities: "/portal/amenities",
      documents: "/portal/documents",
      notices: "/portal/notices",
      communications: "/portal/notices",
      voting: "/portal/notices",
      elections: "/portal/notices",
    };
    const dest = map[tab];
    if (!dest) return;
    window.history.replaceState({}, "", dest);
    window.location.assign(dest);
  }, [location]);

  if (!portalAccessId) {
    return (
      <OwnerPortalLoginContainer
        onLoginSuccess={(id) => {
          if (typeof window !== "undefined") {
            window.localStorage.setItem("portalAccessId", id);
          }
          setPortalAccessId(id);
        }}
      />
    );
  }

  if (sessionIsError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-low" data-testid="portal-session-error">
        <div className="text-center max-w-md p-8">
          <h2 className="text-xl font-semibold text-on-surface mb-2">Unable to load portal</h2>
          <p className="text-sm text-on-surface-variant mb-4">
            {(sessionError as Error | undefined)?.message || "An unexpected error occurred. Please try again."}
          </p>
          <div className="flex gap-2 justify-center">
            <button
              type="button"
              className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold"
              onClick={() => refetchSession()}
            >
              Retry
            </button>
            <button
              type="button"
              className="px-4 py-2 border border-outline-variant rounded-lg text-sm font-medium text-on-surface-variant"
              onClick={handleLogout}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-low" data-testid="portal-session-loading">
        <div className="text-sm text-on-surface-variant">Loading your portal…</div>
      </div>
    );
  }

  const contextValue: PortalContextValue = {
    portalAccessId,
    session,
    portalFetch,
    handleLogout,
    portalHasBoardAccess: Boolean(session.hasBoardAccess),
    associationName,
    associationId,
    myAssociations: myAssociations ?? [],
  };

  return (
    <PortalContext.Provider value={contextValue}>
      {/* 5.5 (Wave 21) — Skip-link for keyboard users. Visible on focus
          only; jumps past the sidebar + header straight to the main
          content. Target id `portal-main-content` is set on the <main>
          element below. */}
      <a
        href="#portal-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-primary focus:shadow-lg"
        data-testid="skip-to-content-portal"
      >
        Skip to content
      </a>
      <div className="flex min-h-screen bg-surface-container-low" data-testid="portal-shell">
        <ShellSidebar items={navItems} pathname={location} associationId={associationId} />
        <div className="flex min-h-screen flex-1 flex-col">
          <ShellHeader session={session} associationName={associationName} onLogout={handleLogout} />
          <ShellBreadcrumb trail={breadcrumbTrail} />
          <main
            id="portal-main-content"
            className="flex-1 px-4 py-6 md:px-8"
            tabIndex={-1}
            data-testid="portal-main"
          >
            {children}
          </main>
        </div>
      </div>
    </PortalContext.Provider>
  );
}
