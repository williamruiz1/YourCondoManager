// @zone: (cross-cutting)
//
// 1.3 Shared breadcrumb component.
//
// This is the single source of truth for breadcrumb rendering across
// all 37 audited pages. Per 1.3 Q5, no page may hardcode its own
// breadcrumb markup; per 1.3 Q6, no persona-conditional logic lives
// here. Per 1.3 Q7, the component collapses below 768px to a single
// back-navigation affordance.
//
// Intentionally persona-invariant: no `adminRole` / `persona` imports,
// no role-conditional branches. Role gating is enforced upstream by
// `<RouteGuard>` (Phase 0b) before this component ever renders.
//
// Spec anchors:
//  - decisions/1.3-breadcrumb-label-audit.md Q1–Q7
//  - decisions/3.4-breadcrumb-implementation.md (downstream consumer)
//  - plan: /home/runner/.claude/plans/floofy-hopping-dusk.md Phase 6

import { ChevronLeft } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  MAX_BREADCRUMB_DEPTH,
  getBreadcrumbTrail,
  type BreadcrumbContext,
  type BreadcrumbItem,
  type BreadcrumbTrail,
} from "@/lib/breadcrumb-paths";

/**
 * Props for {@link BreadcrumbNav}.
 *
 * The component accepts either a resolved `trail` or a `route` + optional
 * `context`, in which case it resolves the trail from the central
 * `breadcrumb-paths.ts` table. The route-driven form is the preferred
 * call pattern per 1.3 Q5 "route metadata drives breadcrumb content."
 * The `trail` form is kept for tests and for the migration window while
 * zone PRs move call sites over.
 *
 * Legacy `items` prop is accepted as an alias of `trail` so the existing
 * (pre-Phase 6) callers keep compiling during migration. New call sites
 * should use `route` or `trail`.
 */
export type BreadcrumbNavProps =
  | {
      route: string;
      context?: BreadcrumbContext;
      trail?: never;
      items?: never;
      className?: string;
    }
  | {
      trail: BreadcrumbTrail;
      route?: never;
      context?: never;
      items?: never;
      className?: string;
    }
  | {
      items: BreadcrumbItem[];
      route?: never;
      context?: never;
      trail?: never;
      className?: string;
    };

function resolveTrail(props: BreadcrumbNavProps): BreadcrumbTrail {
  if ("route" in props && props.route) {
    return getBreadcrumbTrail(props.route, props.context);
  }
  if ("trail" in props && props.trail) {
    return props.trail;
  }
  if ("items" in props && props.items) {
    return props.items;
  }
  return [];
}

/**
 * Mobile collapse per 1.3 Q7: show only the immediate parent as a
 * back-navigation affordance `< Parent`. Parent = second-to-last
 * segment (the nearest ancestor with an href). If no parent exists
 * (i.e., trail is a single-segment hub), render nothing — the page's
 * own `<h1>` carries the identity.
 */
function MobileBreadcrumb({
  trail,
  className,
}: {
  trail: BreadcrumbTrail;
  className?: string;
}) {
  if (trail.length < 2) {
    return null;
  }
  const parent = trail[trail.length - 2];
  if (!parent.href) {
    return null;
  }
  return (
    <nav
      className={cn("flex items-center gap-1", className)}
      aria-label="Breadcrumb"
    >
      <Link href={parent.href}>
        <span className="label-caps text-on-surface-variant hover:text-primary transition-colors cursor-pointer inline-flex items-center gap-1">
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {parent.label}
        </span>
      </Link>
    </nav>
  );
}

/**
 * Desktop trail per 1.3 Q2 / Q3 / Q4: renders up to three segments.
 * The leaf segment is always the current-page indicator and is
 * non-linked regardless of whether the table supplied an `href`.
 */
function DesktopBreadcrumb({
  trail,
  className,
}: {
  trail: BreadcrumbTrail;
  className?: string;
}) {
  return (
    <nav
      className={cn("flex items-center gap-2", className)}
      aria-label="Breadcrumb"
    >
      {trail.map((item, idx) => {
        const isLeaf = idx === trail.length - 1;
        return (
          <span key={`${idx}-${item.label}`} className="flex items-center gap-2">
            {idx > 0 && (
              <span className="label-caps text-on-surface-variant/40" aria-hidden="true">
                /
              </span>
            )}
            {!isLeaf && item.href ? (
              <Link href={item.href}>
                <span className="label-caps text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
                  {item.label}
                </span>
              </Link>
            ) : (
              <span
                aria-current={isLeaf ? "page" : undefined}
                className={cn(
                  "label-caps",
                  isLeaf ? "text-primary font-bold" : "text-on-surface-variant",
                )}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

/**
 * Shared breadcrumb component per 1.3.
 *
 * - Persona-invariant (Q6): identical render for every role.
 * - ≤ 3 segments (Q4): enforced upstream by {@link getBreadcrumbTrail};
 *   the component also defensively slices.
 * - Two-pattern chain (Q2): association-scoped or portfolio-scoped;
 *   the trail table supplies the correct shape.
 * - Hub pages (Q3): two-level trail with leaf non-linked.
 * - Mobile collapse < 768px (Q7): single-level back affordance.
 */
export function BreadcrumbNav(props: BreadcrumbNavProps) {
  const isMobile = useIsMobile();
  const resolved = resolveTrail(props);
  if (resolved.length === 0) {
    return null;
  }
  const trail =
    resolved.length > MAX_BREADCRUMB_DEPTH
      ? resolved.slice(resolved.length - MAX_BREADCRUMB_DEPTH)
      : resolved;

  if (isMobile) {
    return <MobileBreadcrumb trail={trail} className={props.className} />;
  }
  return <DesktopBreadcrumb trail={trail} className={props.className} />;
}
