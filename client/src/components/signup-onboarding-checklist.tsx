/**
 * Signup Onboarding Checklist — Home banner (4.4 Q2 AC 1-5).
 *
 * Four locked items per 4.4 Q2 P2:
 *   1. Set association details (replace post-signup "TBD" stub)
 *   2. Invite at least one Board Officer
 *   3. Import/manually add units
 *   4. Upload first governing document
 *
 * Data source: GET /api/onboarding/signup-checklist
 * Dismiss: POST /api/onboarding/dismiss
 *
 * Hide conditions:
 *   - banner is dismissed (admin_users.onboarding_dismissed_at NOT NULL), OR
 *   - all four items are complete.
 *
 * No new route is added (AC 3). Each item links to an existing /app surface.
 */

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Building2,
  UserPlus,
  Home as HomeIcon,
  FileText,
  CheckCircle2,
  Circle,
  ChevronRight,
  X,
  ClipboardList,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

type SignupChecklist = {
  associationDetailsComplete: boolean;
  boardOfficerInvited: boolean;
  unitsAdded: boolean;
  firstDocumentUploaded: boolean;
  dismissed: boolean;
  dismissedAt: string | null;
};

type ChecklistItem = {
  key: keyof Pick<
    SignupChecklist,
    "associationDetailsComplete" | "boardOfficerInvited" | "unitsAdded" | "firstDocumentUploaded"
  >;
  label: string;
  summary: string;
  href: string;
  icon: typeof Building2;
};

// Order follows 4.4 Q2 P2.
const ITEMS: readonly ChecklistItem[] = [
  {
    key: "associationDetailsComplete",
    label: "Set association details",
    summary: "Replace the TBD placeholders with your address, city, and state.",
    href: "/app/association-context",
    icon: Building2,
  },
  {
    key: "boardOfficerInvited",
    label: "Invite a Board Officer",
    summary: "Add at least one board member so governance surfaces are usable.",
    href: "/app/board",
    icon: UserPlus,
  },
  {
    key: "unitsAdded",
    label: "Add units",
    summary: "Import from CSV or add units manually to enable owner and billing workflows.",
    href: "/app/units",
    icon: HomeIcon,
  },
  {
    key: "firstDocumentUploaded",
    label: "Upload a governing document",
    summary: "Bylaws, CC&Rs, or another founding document — stored in Documents.",
    href: "/app/documents",
    icon: FileText,
  },
] as const;

export function SignupOnboardingChecklist() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<SignupChecklist>({
    queryKey: ["/api/onboarding/signup-checklist"],
  });

  const dismissMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/onboarding/dismiss");
    },
    onSuccess: () => {
      queryClient.setQueryData<SignupChecklist | undefined>(
        ["/api/onboarding/signup-checklist"],
        (prev) => (prev ? { ...prev, dismissed: true } : prev),
      );
    },
  });

  const completedCount = useMemo(() => {
    if (!data) return 0;
    return ITEMS.filter((item) => data[item.key]).length;
  }, [data]);

  if (isLoading || !data) return null;
  if (data.dismissed) return null;
  if (completedCount === ITEMS.length) return null;

  const percent = Math.round((completedCount / ITEMS.length) * 100);

  return (
    <Card data-testid="signup-onboarding-checklist" className="border-primary/30 bg-primary/[0.03]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              Finish setting up your workspace
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Four quick steps to get your first association ready. Each step links to the
              section where you can finish it.
            </p>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium tabular-nums">
                {completedCount}/{ITEMS.length}
              </div>
              <Progress value={percent} className="h-2 w-24" />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => dismissMutation.mutate()}
              disabled={dismissMutation.isPending}
              aria-label="Dismiss onboarding checklist"
              data-testid="button-dismiss-onboarding-checklist"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="space-y-1">
          {ITEMS.map((item) => {
            const done = data[item.key];
            const Icon = item.icon;
            const row = (
              <div
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  done ? "text-muted-foreground" : "hover:bg-muted/50"
                }`}
                data-testid={`onboarding-item-${item.key}`}
              >
                {done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500 dark:text-green-400" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <Icon className={`h-4 w-4 shrink-0 ${done ? "text-muted-foreground" : "text-primary"}`} />
                <div className="min-w-0 flex-1">
                  <div className={done ? "line-through" : "font-medium"}>{item.label}</div>
                  {!done && (
                    <div className="text-xs text-muted-foreground">{item.summary}</div>
                  )}
                </div>
                {!done && <ChevronRight className="ml-auto h-3 w-3 text-muted-foreground" />}
              </div>
            );
            return (
              <li key={item.key}>
                {done ? row : <Link href={item.href}>{row}</Link>}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
