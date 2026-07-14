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
import { BrandMark } from "@/components/brand-mark";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { PortalAccess } from "@shared/schema";
import { OwnerPortalLoginContainer } from "@/components/owner-portal-login-container";
import { AiChatWidget } from "@/components/ai-chat/AiChatWidget";
// P0 (2026-07-14) — portal shell restyle onto @ycm/design-system (F1, PR #434).
// Pulls in the --ds-* brand tokens (teal #014d4a / teal-700 #0a6a63 / accent
// #15a39c / Inter Tight) and the .ds-sidebar/.ds-navitem primitives so the
// shell chrome matches the Manager app. Only chrome (header/sidebar/mobile
// nav/breadcrumb) is restyled here — individual /portal/* page CONTENTS are
// untouched and stay on the prior look until their own future restyle slice
// (P1–P5 per wiki/plans/ycm-redesign-buildout-plan-2026-07-09.md).
import "@/styles/redesign-kit.css";

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
      className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-white/85 px-4 py-3 backdrop-blur md:px-8"
      style={{ borderColor: "var(--ds-gray)", fontFamily: "var(--ds-font)" }}
      data-testid="portal-header"
    >
      <h1
        className="truncate text-lg font-semibold md:text-xl"
        style={{ color: "var(--ds-teal)" }}
        data-testid="portal-header-title"
      >
        {title}
      </h1>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="truncate text-xs font-semibold" style={{ color: "var(--ds-ink)" }} data-testid="portal-header-user">
            {displayName}
          </p>
          {session.hasBoardAccess ? (
            <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "var(--ds-accent)" }}>Board access</p>
          ) : (
            <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--ds-sub)" }}>Owner</p>
          )}
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--ds-off)] hover:text-[var(--ds-teal)]"
          style={{ borderColor: "var(--ds-gray)", color: "var(--ds-sub)" }}
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
      className="ds-sidebar hidden flex-col md:flex"
      style={{ fontFamily: "var(--ds-font)" }}
      data-testid="portal-sidebar"
    >
      <div className="ds-brand">
        {/* real BrandMark, no placeholder — the light-mark variant is the
            same choice the Manager-app Sidebar primitive makes for this
            same deep-teal background (client/src/components/redesign). */}
        <BrandMark forceTheme="light" className="ds-mk" decorative />
        <div>
          <div className="ds-tt">Owner Portal</div>
          <div className="ds-st">YCM</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1" aria-label="Portal navigation">
        {items.map((item) => {
          const active = item.matches(pathname);
          return (
            <Link
              key={item.to}
              href={item.to}
              className={active ? "ds-navitem ds-active" : "ds-navitem"}
              data-testid={`portal-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <span className="material-symbols-outlined text-base ds-nav-ic">{item.icon}</span>
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge ? <span className="ds-count">{item.badge}</span> : null}
            </Link>
          );
        })}
        {associationId ? (
          <a
            href={`/community/${associationId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ds-navitem mt-4"
            data-testid="portal-nav-public-community"
          >
            <span className="material-symbols-outlined text-base ds-nav-ic">public</span>
            <span className="flex-1 truncate">Public community hub</span>
            {/* Wave 25 — the icon is decorative beside the visible link
                label, so it's aria-hidden (no double-announce for screen
                readers); full opacity kept for WCAG AA contrast. */}
            <span aria-hidden="true" className="material-symbols-outlined text-xs">open_in_new</span>
          </a>
        ) : null}
      </nav>
    </aside>
  );
}

type ShellMobileNavProps = {
  items: PortalNavItem[];
  pathname: string;
};

/**
 * #285 — Mobile bottom tab bar. Below the `md` breakpoint the desktop
 * sidebar is `hidden`, leaving phone owners with no way to move between
 * zones. A fixed bottom tab bar is the canonical phone pattern for a
 * payments / finance surface: the four primary zones sit within thumb
 * reach and a single tap switches zones.
 *
 * Visible only below `md` (`md:hidden`); the desktop sidebar (`md:flex`)
 * is the >=md nav and is unchanged. Renders the SAME nav items the
 * sidebar consumes (same routes / icons / active-match / badges) so the
 * two surfaces can never drift apart. Each tab is a full-height target
 * (h-16 = 64px, well over the 44px minimum) with the label always shown.
 */
function ShellMobileNav({ items, pathname }: ShellMobileNavProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      style={{ borderColor: "var(--ds-gray)", fontFamily: "var(--ds-font)" }}
      aria-label="Portal navigation"
      data-testid="portal-mobile-nav"
    >
      {items.map((item) => {
        const active = item.matches(pathname);
        return (
          <Link
            key={item.to}
            href={item.to}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className="relative flex h-16 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors"
            style={{ color: active ? "var(--ds-teal)" : "var(--ds-sub)" }}
            data-testid={`portal-mobile-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <span className="relative">
              <span aria-hidden="true" className="material-symbols-outlined text-xl">
                {item.icon}
              </span>
              {item.badge ? (
                <span
                  className="absolute -right-2 -top-1 min-w-4 rounded-full px-1 text-[9px] font-bold leading-4 text-white"
                  style={{ backgroundColor: "var(--ds-accent)" }}
                  data-testid={`portal-mobile-nav-badge-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {item.badge}
                </span>
              ) : null}
            </span>
            <span className="truncate px-0.5">{item.label}</span>
          </Link>
        );
      })}
    </nav>
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
      className="border-b px-4 py-2 md:px-8"
      style={{ borderColor: "var(--ds-gray)", backgroundColor: "var(--ds-off)", fontFamily: "var(--ds-font)" }}
      data-testid="portal-breadcrumb"
    >
      <ol className="flex flex-wrap items-center gap-1 text-xs" style={{ color: "var(--ds-sub)" }}>
        {trail.map((segment, idx) => {
          const isLast = idx === trail.length - 1;
          return (
            <li key={`${segment.label}-${idx}`} className="flex items-center gap-1">
              {idx > 0 ? <span style={{ color: "var(--ds-sub)", opacity: 0.5 }}>/</span> : null}
              {segment.href && !isLast ? (
                <Link href={segment.href} className="transition-colors hover:text-[var(--ds-accent)]">
                  {segment.label}
                </Link>
              ) : (
                <span
                  className={isLast ? "font-semibold" : undefined}
                  style={isLast ? { color: "var(--ds-teal)" } : undefined}
                  aria-current={isLast ? "page" : undefined}
                >
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
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--ds-off)", fontFamily: "var(--ds-font)" }}
        data-testid="portal-session-error"
      >
        <div className="text-center max-w-md p-8">
          <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--ds-teal)" }}>Unable to load portal</h2>
          <p className="text-sm mb-4" style={{ color: "var(--ds-sub)" }}>
            {(sessionError as Error | undefined)?.message || "An unexpected error occurred. Please try again."}
          </p>
          <div className="flex gap-2 justify-center">
            <button
              type="button"
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: "var(--ds-teal)" }}
              onClick={() => refetchSession()}
            >
              Retry
            </button>
            <button
              type="button"
              className="px-4 py-2 border rounded-lg text-sm font-medium"
              style={{ borderColor: "var(--ds-gray)", color: "var(--ds-sub)" }}
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
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--ds-off)", fontFamily: "var(--ds-font)" }}
        data-testid="portal-session-loading"
      >
        <div className="text-sm" style={{ color: "var(--ds-sub)" }}>Loading your portal…</div>
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
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--ds-teal)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
        data-testid="skip-to-content-portal"
      >
        Skip to content
      </a>
      {/* 2026-05-25 (live session) — Scroll-trap fix. Previous structure
          used `flex min-h-screen` on both outer + inner column. While
          `min-h-screen` permits document growth in theory, the AI chat
          widget (fixed bottom-right) was hiding the lower content on
          /portal/finances making it feel "unscrollable below the fold."
          Added `pb-24` to <main> so the last card never sits behind the
          FAB, and removed the redundant `min-h-screen` from the column
          (the outer container already enforces it). */}
      <div className="flex min-h-screen" style={{ backgroundColor: "var(--ds-off)" }} data-testid="portal-shell">
        <ShellSidebar items={navItems} pathname={location} associationId={associationId} />
        <div className="flex w-full min-w-0 flex-1 flex-col">
          <ShellHeader session={session} associationName={associationName} onLogout={handleLogout} />
          <ShellBreadcrumb trail={breadcrumbTrail} />
          <main
            id="portal-main-content"
            className="flex-1 px-4 pt-6 pb-24 md:px-8 md:pb-28"
            tabIndex={-1}
            data-testid="portal-main"
          >
            {children}
          </main>
        </div>
        {/* Resident-chat widget — renders nothing unless AI_ASSISTANT_ENABLED
            is ON for this community (founder-os#1318, Phase 0). */}
        <AiChatWidget associationId={associationId} />
        {/* #285 — Mobile bottom tab bar. Visible only below `md`; the
            desktop sidebar is the >=md nav (unchanged). */}
        <ShellMobileNav items={navItems} pathname={location} />
      </div>
    </PortalContext.Provider>
  );
}
