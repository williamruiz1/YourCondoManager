// zone: shared
//
// 5.1 — Shared EmptyState component.
//
// Spec: docs/projects/platform-overhaul/decisions/5.1-empty-states.md
//
// Props:
//   - icon: LucideIcon reference (rendered at 40px, muted color).
//   - title: short, sentence-case headline.
//   - description: one or two sentences; wraps at `max-w-md`.
//   - cta (optional): `{ label, onClick }` or `{ label, href }`.
//     - onClick wins if both are provided.
//
// Call sites should prefer this over ad-hoc inline empty states so copy
// and layout stay consistent across the workspace + portal surfaces.
// Exceptions (per spec): HubAlertWidget "all clear", Home alerts panel,
// and central inbox per-filter states are spec-locked and NOT wrapped.

import type { LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type EmptyStateCta =
  | { label: string; onClick: () => void; href?: never }
  | { label: string; href: string; onClick?: never };

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  cta?: EmptyStateCta;
  /**
   * Override the default `data-testid="empty-state"` when a single page
   * renders multiple empty states and needs disambiguation in tests.
   */
  testId?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
  testId = "empty-state",
}: EmptyStateProps) {
  return (
    <Card data-testid={testId} role="status">
      <CardContent className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <Icon
          className="h-10 w-10 text-muted-foreground"
          aria-hidden="true"
          data-testid={`${testId}-icon`}
        />
        <p
          className="mt-4 text-lg font-medium"
          data-testid={`${testId}-title`}
        >
          {title}
        </p>
        {description ? (
          <p
            className="mt-2 max-w-md text-sm text-muted-foreground"
            data-testid={`${testId}-description`}
          >
            {description}
          </p>
        ) : null}
        {cta ? (
          <div className="mt-6">
            {cta.onClick ? (
              <Button
                onClick={cta.onClick}
                data-testid={`${testId}-cta`}
              >
                {cta.label}
              </Button>
            ) : (
              <Button asChild data-testid={`${testId}-cta`}>
                <Link href={cta.href as string}>{cta.label}</Link>
              </Button>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default EmptyState;
