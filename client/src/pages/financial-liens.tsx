// zone: Financials
// persona: Manager, Board Officer, Assisted Board, PM Assistant
//
// Statutory assessment-lien lifecycle surface — CT CGS §47-258 / DE §81-316
// (BUILD #8014). Reuses the delinquency/collections admin UI primitives.
// Read + create + super-priority + record-payment + pre-foreclosure gate.
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AssessmentLien, Person, Unit } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ShieldAlert, Gavel } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { useActiveAssociation } from "@/hooks/use-active-association";

function formatCurrency(amount: number): string {
  return `$${Math.abs(amount).toFixed(2)}`;
}

function lienStatusVariant(status: string) {
  if (status === "active") return "destructive" as const;
  if (status === "released") return "default" as const;
  return "secondary" as const;
}

const lienStatusLabels: Record<string, string> = {
  active: "Active lien",
  released: "Released",
  expired: "Expired (past §47-258(e) 3-yr SOL)",
};

type LienRow = AssessmentLien & { unitNumber?: string; personName?: string };

export function FinancialLiensContent() {
  const { toast } = useToast();
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();

  const [createOpen, setCreateOpen] = useState(false);
  const [preForeclosureLien, setPreForeclosureLien] = useState<LienRow | null>(null);

  const {
    data: liens = [],
    isLoading,
    refetch,
  } = useQuery<AssessmentLien[]>({
    queryKey: ["/api/financial/assessment-liens", activeAssociationId],
    queryFn: async () => {
      if (!activeAssociationId) return [];
      const res = await apiRequest(
        "GET",
        `/api/financial/assessment-liens?associationId=${activeAssociationId}`,
      );
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  const { data: units = [] } = useQuery<Unit[]>({ queryKey: ["/api/units"] });
  const { data: persons = [] } = useQuery<Person[]>({ queryKey: ["/api/persons"] });

  const unitMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of units) m.set(u.id, u.unitNumber ?? u.id.slice(0, 8));
    return m;
  }, [units]);

  const personMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of persons)
      m.set(p.id, [p.firstName, p.lastName].filter(Boolean).join(" ") || p.id.slice(0, 8));
    return m;
  }, [persons]);

  const rows: LienRow[] = useMemo(
    () =>
      liens.map((l) => ({
        ...l,
        unitNumber: unitMap.get(l.unitId) ?? l.unitId.slice(0, 8),
        personName: l.personId ? personMap.get(l.personId) ?? l.personId.slice(0, 8) : "—",
      })),
    [liens, unitMap, personMap],
  );

  // --- Create-lien form (§47-258(a)) ---
  const [form, setForm] = useState({
    unitId: "",
    aroseDate: new Date().toISOString().slice(0, 10),
    principalAmount: "",
    monthlyCommonExpense: "",
  });

  const createLien = useMutation({
    mutationFn: async () => {
      if (!activeAssociationId) throw new Error("No association selected");
      const res = await apiRequest("POST", "/api/financial/assessment-liens", {
        associationId: activeAssociationId,
        unitId: form.unitId,
        aroseDate: form.aroseDate,
        principalAmount: parseFloat(form.principalAmount || "0"),
        monthlyCommonExpense: parseFloat(form.monthlyCommonExpense || "0"),
        statuteSection: "47-258",
      });
      return res.json();
    },
    onSuccess: () => {
      void refetch();
      setCreateOpen(false);
      setForm({ unitId: "", aroseDate: new Date().toISOString().slice(0, 10), principalAmount: "", monthlyCommonExpense: "" });
      toast({ title: "Lien recorded (§47-258(a))" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const recordPayment = useMutation({
    mutationFn: async (lien: LienRow) => {
      const res = await apiRequest(
        "POST",
        `/api/financial/assessment-liens/${lien.id}/apply-payment`,
        { amountPaid: lien.principalAmount },
      );
      return res.json();
    },
    onSuccess: () => {
      void refetch();
      toast({ title: "Payment applied — lien released" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Gavel className="h-5 w-5" /> Statutory assessment liens
          </h2>
          <p className="text-sm text-muted-foreground">
            CT CGS §47-258 — automatic lien on unpaid assessments, 9-month super-priority over a
            first mortgage, 3-year statute of limitations. {activeAssociationName}
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> Record lien
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record assessment lien (§47-258(a))</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <label className="block text-sm">
                Unit
                <select
                  className="mt-1 w-full border rounded px-2 py-1 text-sm"
                  value={form.unitId}
                  onChange={(e) => setForm((f) => ({ ...f, unitId: e.target.value }))}
                >
                  <option value="">Select unit…</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.unitNumber ?? u.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Arose date (assessment due date)
                <Input
                  type="date"
                  value={form.aroseDate}
                  onChange={(e) => setForm((f) => ({ ...f, aroseDate: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                Principal unpaid amount
                <Input
                  type="number"
                  value={form.principalAmount}
                  onChange={(e) => setForm((f) => ({ ...f, principalAmount: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                Monthly common expense (drives §47-258(b) super-priority)
                <Input
                  type="number"
                  value={form.monthlyCommonExpense}
                  onChange={(e) => setForm((f) => ({ ...f, monthlyCommonExpense: e.target.value }))}
                />
              </label>
              <Button
                onClick={() => createLien.mutate()}
                disabled={!form.unitId || !form.principalAmount || createLien.isPending}
              >
                Record lien
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={ShieldAlert}
              title="No assessment liens"
              description="Statutory liens arise automatically on unpaid assessments under CGS §47-258(a)."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Arose</TableHead>
                  <TableHead>Principal</TableHead>
                  <TableHead>SOL expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.unitNumber}</TableCell>
                    <TableCell>{l.personName}</TableCell>
                    <TableCell>{new Date(l.aroseDate).toISOString().slice(0, 10)}</TableCell>
                    <TableCell>{formatCurrency(l.principalAmount)}</TableCell>
                    <TableCell>{new Date(l.expiresAt).toISOString().slice(0, 10)}</TableCell>
                    <TableCell>
                      <Badge variant={lienStatusVariant(l.status)}>
                        {lienStatusLabels[l.status] ?? l.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {l.status === "active" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => recordPayment.mutate(l)}
                            disabled={recordPayment.isPending}
                          >
                            Mark paid
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setPreForeclosureLien(l)}
                          >
                            Pre-foreclosure
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {preForeclosureLien && (
        <PreForeclosureDialog
          lien={preForeclosureLien}
          unitNumber={preForeclosureLien.unitNumber ?? ""}
          ownerName={preForeclosureLien.personName ?? "Owner"}
          associationName={activeAssociationName ?? "Association"}
          onClose={() => setPreForeclosureLien(null)}
          onIssued={() => {
            setPreForeclosureLien(null);
            void refetch();
          }}
        />
      )}
    </div>
  );
}

// §47-258(m): the pre-foreclosure gate + 60-day notice dialog.
function PreForeclosureDialog(props: {
  lien: AssessmentLien;
  unitNumber: string;
  ownerName: string;
  associationName: string;
  onClose: () => void;
  onIssued: () => void;
}) {
  const { toast } = useToast();
  const [gate, setGate] = useState({
    monthsOwed: 2,
    boardVoteOrPolicyAttested: false,
    writtenDemandSent: false,
    mortgageeCopySent: false,
  });
  const [fees, setFees] = useState("0");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [mortgageeEmail, setMortgageeEmail] = useState("");
  const [blockReasons, setBlockReasons] = useState<string[]>([]);

  const issue = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/financial/assessment-liens/${props.lien.id}/pre-foreclosure`,
        {
          recipientEmail,
          mortgageeEmail: mortgageeEmail || null,
          monthsOwed: gate.monthsOwed,
          boardVoteOrPolicyAttested: gate.boardVoteOrPolicyAttested,
          writtenDemandSent: gate.writtenDemandSent,
          mortgageeCopySent: gate.mortgageeCopySent,
          ownerName: props.ownerName,
          unitNumber: props.unitNumber,
          associationName: props.associationName,
          principalDebt: props.lien.principalAmount,
          fees: parseFloat(fees || "0"),
          mortgageeName: mortgageeEmail ? "First mortgagee" : null,
          mortgageeContact: mortgageeEmail || null,
        },
      );
      const body = await res.json();
      if (!res.ok) {
        // Gate blocked → 422 with block reasons.
        setBlockReasons(body?.gate?.blockReasons ?? []);
        throw new Error("Pre-foreclosure gate blocked");
      }
      return body;
    },
    onSuccess: () => {
      toast({ title: "60-day pre-foreclosure notice issued (§47-258(m)(2))" });
      props.onIssued();
    },
    onError: (e: Error) => toast({ title: "Gate blocked", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pre-foreclosure gate — §47-258(m)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            §47-258(m)(1) requires ≥2 months owed, a board vote / standard collection policy, and a
            written demand sent <strong>with a simultaneous copy to the mortgagee</strong> before the
            foreclosure path may open. Then a §47-258(m)(2) 60-day notice is issued.
          </p>
          <label className="block">
            Months owed
            <Input
              type="number"
              value={gate.monthsOwed}
              onChange={(e) => setGate((g) => ({ ...g, monthsOwed: Number(e.target.value) }))}
            />
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={gate.boardVoteOrPolicyAttested}
              onCheckedChange={(c) => setGate((g) => ({ ...g, boardVoteOrPolicyAttested: Boolean(c) }))}
            />
            Board vote / standard collection policy attested
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={gate.writtenDemandSent}
              onCheckedChange={(c) => setGate((g) => ({ ...g, writtenDemandSent: Boolean(c) }))}
            />
            Written demand sent to owner
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={gate.mortgageeCopySent}
              onCheckedChange={(c) => setGate((g) => ({ ...g, mortgageeCopySent: Boolean(c) }))}
            />
            Copy of demand sent to mortgagee (simultaneous)
          </label>
          <label className="block">
            Late fees / interest
            <Input type="number" value={fees} onChange={(e) => setFees(e.target.value)} />
          </label>
          <label className="block">
            Owner email
            <Input value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} />
          </label>
          <label className="block">
            Mortgagee email (for the required copy)
            <Input value={mortgageeEmail} onChange={(e) => setMortgageeEmail(e.target.value)} />
          </label>
          {blockReasons.length > 0 && (
            <div className="rounded border border-destructive/50 bg-destructive/10 p-2 text-destructive">
              Gate blocked: {blockReasons.join(", ")}
            </div>
          )}
          <Button
            onClick={() => issue.mutate()}
            disabled={!recipientEmail || issue.isPending}
            className="w-full"
          >
            Evaluate gate &amp; issue 60-day notice
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
