// zone: Financials
// persona: Manager, Board Officer, Assisted Board, PM Assistant
//
// Connecticut CGS §47-261e budget ratification (owner-veto / "negative option").
// Lets an admin bind a budget version's effectiveness to the statutory owner-veto
// vote: distribute the summary (incl. reserve statement), open the 10–60 day vote
// window, and close it (tally rejects vs ALL owners → ratify or auto-revert).
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BudgetRatification, BudgetRatificationVote } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type RatificationWithVotes = BudgetRatification & { votes?: BudgetRatificationVote[] };

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ratified") return "default";
  if (status === "rejected") return "destructive";
  if (status === "vote-open") return "secondary";
  return "outline";
}

function isoInDays(days: number): string {
  const d = new Date(Date.now() + days * 86400000);
  return d.toISOString().slice(0, 10);
}

export function BudgetRatificationPanel({
  associationId,
  budgetVersionId,
}: {
  associationId: string;
  budgetVersionId: string;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [reserveStatement, setReserveStatement] = useState("");
  const [voteCloseAt, setVoteCloseAt] = useState(isoInDays(30));

  const listQuery = useQuery<BudgetRatification[]>({
    queryKey: ["/api/financial/budget-ratifications", associationId],
    enabled: Boolean(associationId),
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/financial/budget-ratifications?associationId=${associationId}`);
      return res.json();
    },
  });

  const existing = useMemo(
    () => (listQuery.data ?? []).find((r) => r.budgetVersionId === budgetVersionId),
    [listQuery.data, budgetVersionId],
  );

  const detailQuery = useQuery<RatificationWithVotes>({
    queryKey: ["/api/financial/budget-ratifications", existing?.id],
    enabled: Boolean(existing?.id),
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/financial/budget-ratifications/${existing!.id}`);
      return res.json();
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/financial/budget-ratifications", associationId] });
    if (existing?.id) qc.invalidateQueries({ queryKey: ["/api/financial/budget-ratifications", existing.id] });
    qc.invalidateQueries({ queryKey: ["/api/financial/budgets", budgetVersionId, "versions"] });
  };

  const initiate = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/financial/budget-ratifications", {
        associationId,
        budgetVersionId,
        kind: "annual-budget",
        reserveStatement,
        boardAdoptedAt: new Date().toISOString(),
        voteCloseAt: new Date(voteCloseAt).toISOString(),
      });
      return res.json();
    },
    onSuccess: (data: { noticeCount?: number }) => {
      toast({ title: "§47-261e ratification opened", description: `Budget summary distributed to ${data?.noticeCount ?? 0} owners.` });
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const closeVote = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/financial/budget-ratifications/${existing!.id}/close`, {});
      return res.json();
    },
    onSuccess: (data: BudgetRatification) => {
      toast({
        title: data.status === "ratified" ? "Budget ratified" : "Budget rejected — reverted to last approved budget",
        description: `§47-261e outcome recorded.`,
      });
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const votes = detailQuery.data?.votes ?? [];
  const rejectCount = votes.filter((v) => v.voteChoice === "no").reduce((s, v) => s + (v.voteWeight ?? 1), 0);

  return (
    <Card className="border-amber-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Statutory Ratification — Connecticut CGS §47-261e</CardTitle>
          {existing && <Badge variant={statusVariant(existing.status)}>{existing.status}</Badge>}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Owner-veto / negative option: the budget takes effect unless a majority of all owners votes to reject it.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!existing && (
          <div className="space-y-2">
            <label className="text-xs font-medium">Statement of Reserves (§47-261e(a) — required)</label>
            <Input
              data-testid="input-reserve-statement"
              placeholder="e.g. Reserve fund balance is $42,000; recommended funding $50,000."
              value={reserveStatement}
              onChange={(e) => setReserveStatement(e.target.value)}
            />
            <label className="text-xs font-medium">Vote closes (10–60 days from distribution)</label>
            <Input type="date" value={voteCloseAt} onChange={(e) => setVoteCloseAt(e.target.value)} />
            <Button
              size="sm"
              data-testid="button-initiate-ratification"
              disabled={!reserveStatement.trim() || initiate.isPending}
              onClick={() => initiate.mutate()}
            >
              Distribute summary & open owner vote
            </Button>
          </div>
        )}

        {existing && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Reserve statement</span><span className="text-right max-w-[60%]">{existing.reserveStatement}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Owners of record (denominator)</span><span>{existing.totalOwnersAtInitiation}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Reject votes so far</span><span>{rejectCount} (needs &gt; {existing.totalOwnersAtInitiation / 2} to defeat)</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Vote closes</span><span>{existing.voteCloseAt ? new Date(existing.voteCloseAt).toDateString() : "n/a"}</span></div>
            {existing.status === "vote-open" && (
              <Button
                size="sm"
                variant="secondary"
                data-testid="button-close-ratification"
                disabled={closeVote.isPending}
                onClick={() => closeVote.mutate()}
              >
                Close window & determine outcome
              </Button>
            )}
            {existing.status === "rejected" && (
              <p className="text-xs text-destructive">Rejected by a majority of all owners — reverted to the last approved budget (§47-261e).</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
