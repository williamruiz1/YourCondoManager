// zone: Financials
// persona: Manager, Board Officer, Assisted Board, PM Assistant, Treasurer
//
// Admin / treasurer owner account-statement generator (readiness P0-3 / #206).
// Pick an owner (+ optional unit) and a period; render a printable statement
// (opening balance → activity → closing balance) backed by
// GET /api/financial/owner-ledger/statement.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Person, Unit } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { financeSubPages } from "@/lib/sub-page-nav";
import {
  AccountStatementView,
  type AccountStatementResponse,
} from "@/components/account-statement-view";

const ALL_UNITS = "__all__";

// Default period: last full calendar month.
function defaultPeriod(): { from: string; to: string } {
  const now = new Date();
  const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const lastMonthEnd = new Date(firstOfThisMonth.getTime() - 24 * 60 * 60 * 1000);
  const lastMonthStart = new Date(
    Date.UTC(lastMonthEnd.getUTCFullYear(), lastMonthEnd.getUTCMonth(), 1),
  );
  return {
    from: lastMonthStart.toISOString().slice(0, 10),
    to: lastMonthEnd.toISOString().slice(0, 10),
  };
}

export default function FinancialStatementPage() {
  useDocumentTitle("Owner Account Statement");
  const { activeAssociationId } = useActiveAssociation();
  const initial = useMemo(() => defaultPeriod(), []);

  const [personId, setPersonId] = useState<string>("");
  const [unitId, setUnitId] = useState<string>(ALL_UNITS);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [applied, setApplied] = useState<{
    personId: string;
    unitId: string;
    from: string;
    to: string;
  } | null>(null);

  // Scope persons + units to the active association SERVER-side via the
  // associationId query param. The server's getPersons() admits a person who
  // owns a unit / has occupancy / sits on the board / has ledger entries in
  // the association — NOT only persons whose persons.association_id matches.
  // That column is nullable and is NULL for CHC owners, so the old approach of
  // fetching unscoped and re-filtering client-side on
  // `p.associationId === activeAssociationId` discarded every CHC owner and
  // left the owner dropdown (and therefore the statement) empty. This mirrors
  // the #307 owner-statement fence fix and the admin-payments-record pattern.
  const { data: persons = [] } = useQuery<Person[]>({
    queryKey: ["/api/persons", activeAssociationId],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/persons?associationId=${activeAssociationId}`,
      );
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });
  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: ["/api/units", activeAssociationId],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/units?associationId=${activeAssociationId}`,
      );
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  // Server already scoped both to the active association; render directly.
  // units.associationId IS non-null, so keep a defensive same-association
  // filter purely as a belt-and-suspenders guard for any unscoped fallback.
  const assocUnits = useMemo(
    () => units.filter((u) => !activeAssociationId || u.associationId === activeAssociationId),
    [units, activeAssociationId],
  );
  const assocPersons = persons;

  const { data: statement, isLoading, isError } = useQuery<AccountStatementResponse>({
    queryKey: [
      "/api/financial/owner-ledger/statement",
      applied?.personId,
      applied?.unitId,
      applied?.from,
      applied?.to,
      activeAssociationId,
    ],
    queryFn: async () => {
      if (!applied) throw new Error("No statement requested");
      const params = new URLSearchParams({
        associationId: activeAssociationId,
        personId: applied.personId,
        from: applied.from,
        to: applied.to,
      });
      if (applied.unitId !== ALL_UNITS) params.set("unitId", applied.unitId);
      const res = await apiRequest(
        "GET",
        `/api/financial/owner-ledger/statement?${params.toString()}`,
      );
      return res.json();
    },
    enabled: Boolean(applied && activeAssociationId),
  });

  const canGenerate = Boolean(personId && from && to && from <= to && activeAssociationId);

  return (
    <div className="flex flex-col min-h-0">
      <div className="p-6 space-y-6">
        <WorkspacePageHeader
          title="Owner Account Statement"
          eyebrow="Finance"
          summary="Generate a printable account statement for any owner — opening balance, period activity, and closing balance."
          breadcrumbs={[{ label: "Financials", href: "/app/financials" }, { label: "Statement" }]}
          subPages={financeSubPages}
        />

        <Card className="no-print">
          <CardContent className="grid grid-cols-1 gap-4 py-5 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
            <div className="flex flex-col gap-1 lg:col-span-2">
              <Label htmlFor="statement-owner">Owner</Label>
              <Select value={personId} onValueChange={setPersonId}>
                <SelectTrigger id="statement-owner" data-testid="statement-owner-select">
                  <SelectValue placeholder="Select an owner" />
                </SelectTrigger>
                <SelectContent>
                  {assocPersons.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.firstName} {p.lastName}
                      {p.email ? ` · ${p.email}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="statement-unit">Unit</Label>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger id="statement-unit" data-testid="statement-unit-select">
                  <SelectValue placeholder="All units" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_UNITS}>All units</SelectItem>
                  {assocUnits.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.building ? `${u.building} · ` : ""}Unit {u.unitNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="statement-from">From</Label>
              <Input
                id="statement-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                data-testid="statement-from"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="statement-to">To</Label>
              <Input
                id="statement-to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                data-testid="statement-to"
              />
            </div>
            <div className="lg:col-span-5">
              <Button
                onClick={() => setApplied({ personId, unitId, from, to })}
                disabled={!canGenerate}
                data-testid="statement-generate"
              >
                Generate statement
              </Button>
            </div>
          </CardContent>
        </Card>

        {!activeAssociationId ? (
          <Card>
            <CardContent className="py-6 text-sm text-on-surface-variant" role="status">
              Select an association context to generate a statement.
            </CardContent>
          </Card>
        ) : !applied ? (
          <Card>
            <CardContent className="py-6 text-sm text-on-surface-variant" role="status">
              Pick an owner and period, then click Generate.
            </CardContent>
          </Card>
        ) : isLoading ? (
          <Card>
            <CardContent className="py-6 text-sm text-on-surface-variant" role="status">
              Generating statement…
            </CardContent>
          </Card>
        ) : isError ? (
          <Card>
            <CardContent className="py-6 text-sm text-destructive" role="alert">
              Could not generate the statement. Confirm the owner belongs to this
              association and the dates are valid.
            </CardContent>
          </Card>
        ) : statement ? (
          <AccountStatementView statement={statement} />
        ) : null}
      </div>
    </div>
  );
}
