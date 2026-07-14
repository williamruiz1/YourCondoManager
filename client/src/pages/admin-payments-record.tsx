// zone: Financials / Platform
// persona: Platform Admin, Board Officer
//
// /app/admin/payments/record — Manual payment recording surface
// (founder-os#2479).
//
// What this page does, plain-English (per OP #19):
//   The board or platform admin lands here whenever a payment arrives outside
//   the YCM portal — cash dropped off at a board meeting, a check in the mail,
//   a Zelle from an owner's bank, an external ACH that shows up in the bank
//   account. They pick the owner + unit + method, enter the amount + the
//   day it was received, and submit. The page records the payment to the
//   owner ledger AND immediately sweeps the reconciliation auto-matcher so
//   if a bank deposit for the same amount already arrived, the two get
//   stitched together in one step.
//
// Server endpoints consumed:
//   POST /api/admin/payments/record         — single-row write + auto-match sweep
//   POST /api/admin/payments/record-bulk    — N-row write + one auto-match sweep
//   GET  /api/admin/payments/recent         — last 20 recorded payments
//   GET  /api/persons                       — owner autocomplete
//   GET  /api/units                         — unit dropdown
//
// Cross-link: server/routes/admin-payments.ts.

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, AlertTriangle, Building2, ClipboardPaste, Send } from "lucide-react";
import type { Person, Unit } from "@shared/schema";

// ── Wire shape ───────────────────────────────────────────────────────────────

type PaymentMethod = "cash" | "check" | "zelle" | "external-ach" | "venmo" | "other";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "zelle", label: "Zelle" },
  { value: "external-ach", label: "External ACH (outside portal)" },
  { value: "venmo", label: "Venmo" },
  { value: "other", label: "Other (use notes)" },
];

interface RecordedRow {
  id: string;
  associationId: string;
  unitId: string;
  personId: string;
  amount: number;
  postedAt: string;
  description: string | null;
  method: string;
  settledAt: string | null;
  bankTransactionId: string | null;
  actorEmail: string | null;
  createdAt: string;
}

interface AutoMatchSummary {
  matched: Array<{ bankTransactionId: string; ledgerEntryId: string; confidence: number }>;
  needsManualReview: Array<{ bankTransactionId: string }>;
}

interface RecordResponse {
  payment: {
    ledgerEntryId: string;
    amount: number;
    method: string;
    description: string;
    /** CT fee structure — cash/check manual-processing fee (William, voice,
     *  2026-07-14). Set only when this association has the fee flag on AND
     *  the method is cash/check. Owed to the PLATFORM, never the
     *  association — collected with the owner's next payment or directly
     *  (see /api/admin/platform-fees/:id/collect). */
    manualProcessingFee: { feeId: string; amountCents: number; status: "owed" } | null;
  };
  autoMatch: AutoMatchSummary | null;
}

interface BulkResponse {
  recorded: RecordResponse["payment"][];
  failures: Array<{ index: number; error: string }>;
  autoMatch: AutoMatchSummary | null;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPaymentsRecordPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const [tab, setTab] = useState("single");

  // ── Persons + Units for selectors ──────────────────────────────────────────
  const personsQuery = useQuery<Person[]>({
    queryKey: ["/api/persons", activeAssociationId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/persons?associationId=${activeAssociationId}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });
  const unitsQuery = useQuery<Unit[]>({
    queryKey: ["/api/units", activeAssociationId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/units?associationId=${activeAssociationId}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });
  const recentQuery = useQuery<{ entries: RecordedRow[] }>({
    queryKey: ["/api/admin/payments/recent", activeAssociationId],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/admin/payments/recent?associationId=${activeAssociationId}&limit=20`,
      );
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  // ── Form state (single-row) ────────────────────────────────────────────────
  const [personId, setPersonId] = useState<string>("");
  const [unitId, setUnitId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<PaymentMethod>("check");
  const [checkNumber, setCheckNumber] = useState<string>("");
  const [zelleSender, setZelleSender] = useState<string>("");
  const [receivedAt, setReceivedAt] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState<string>("");
  const [attemptBankMatch, setAttemptBankMatch] = useState<boolean>(true);
  const [lastResult, setLastResult] = useState<RecordResponse | null>(null);

  // ── Bulk state ─────────────────────────────────────────────────────────────
  const [bulkBlob, setBulkBlob] = useState<string>("");
  const [bulkResult, setBulkResult] = useState<BulkResponse | null>(null);

  // ── People lookup (for display) ────────────────────────────────────────────
  const personById = useMemo(() => {
    const m = new Map<string, Person>();
    for (const p of personsQuery.data ?? []) m.set(p.id, p);
    return m;
  }, [personsQuery.data]);
  const unitById = useMemo(() => {
    const m = new Map<string, Unit>();
    for (const u of unitsQuery.data ?? []) m.set(u.id, u);
    return m;
  }, [unitsQuery.data]);

  // When a person is selected, auto-suggest the unit (first ownership match).
  // Owner → unit linkage in this codebase is via `ownerships` table, but the
  // /api/units payload includes the per-unit owner relationships; the simplest
  // wire for the form is to surface every unit and let the operator pick.
  // The endpoint requires unitId, so we surface it as a separate dropdown.

  // ── Submit single ──────────────────────────────────────────────────────────
  const recordMutation = useMutation({
    mutationFn: async (): Promise<RecordResponse> => {
      const res = await apiRequest("POST", "/api/admin/payments/record", {
        associationId: activeAssociationId,
        personId,
        unitId,
        amount: Number(amount),
        method,
        checkNumber: method === "check" ? checkNumber || undefined : undefined,
        zelleSender:
          method === "zelle" || method === "venmo" ? zelleSender || undefined : undefined,
        receivedAt: new Date(receivedAt).toISOString(),
        notes: notes || undefined,
        attemptBankMatch,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setLastResult(data);
      const matchedCount = data.autoMatch?.matched.length ?? 0;
      const fee = data.payment.manualProcessingFee;
      const feeNote = fee
        ? ` A $${(fee.amountCents / 100).toFixed(2)} platform processing fee was added — owed to YCM, not this association.`
        : "";
      toast({
        title: "Payment recorded",
        description:
          (matchedCount > 0
            ? `${data.payment.description} — auto-matched to a bank deposit.`
            : data.autoMatch
              ? `${data.payment.description} — recorded; no bank match yet.`
              : `${data.payment.description} — recorded.`) + feeNote,
      });
      qc.invalidateQueries({ queryKey: ["/api/admin/payments/recent"] });
      // Clear method-specific fields but keep person + unit for rapid re-entry.
      setAmount("");
      setCheckNumber("");
      setZelleSender("");
      setNotes("");
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't record payment",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    },
  });

  // ── Submit bulk ────────────────────────────────────────────────────────────
  const bulkMutation = useMutation({
    mutationFn: async (): Promise<BulkResponse> => {
      // Parse client-side to give a fast preview; the server re-validates.
      const { rows, errors } = parseBulkPasteClient(bulkBlob, String(activeAssociationId));
      if (errors.length > 0) {
        throw new Error(
          `Couldn't parse ${errors.length} row${errors.length === 1 ? "" : "s"}: ${errors[0].message}`,
        );
      }
      const res = await apiRequest("POST", "/api/admin/payments/record-bulk", {
        associationId: activeAssociationId,
        rows,
        attemptBankMatch: true,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setBulkResult(data);
      toast({
        title: "Bulk record complete",
        description: `${data.recorded.length} recorded · ${data.failures.length} failed`,
      });
      qc.invalidateQueries({ queryKey: ["/api/admin/payments/recent"] });
      if (data.failures.length === 0) setBulkBlob("");
    },
    onError: (err: any) => {
      toast({
        title: "Bulk record failed",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    },
  });

  if (!activeAssociationId) {
    return (
      <div className="space-y-6 p-6">
        <WorkspacePageHeader
          title="Record incoming payment"
          summary="The manual path for payments that arrive outside the YCM portal — cash, check, Zelle, external ACH, Venmo. Pick the owner, the method, the amount, and we'll auto-match it against any bank deposit that already arrived."
        />
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Select an association first.
          </CardContent>
        </Card>
      </div>
    );
  }

  const formValid =
    Boolean(personId) &&
    Boolean(unitId) &&
    Number(amount) > 0 &&
    Boolean(receivedAt);

  return (
    <div className="space-y-6 p-6">
      <WorkspacePageHeader
        title="Record incoming payment"
        summary="The manual path for payments that arrive outside the YCM portal — cash, check, Zelle, external ACH, Venmo. Pick the owner, the method, the amount, and we'll auto-match it against any bank deposit that already arrived."
      />
      <div className="text-sm text-muted-foreground flex items-center gap-2">
        <Building2 className="h-4 w-4" />
        {activeAssociationName ?? "Active association"}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="single" data-testid="tab-single">
            Single payment
          </TabsTrigger>
          <TabsTrigger value="bulk" data-testid="tab-bulk">
            Bulk paste
          </TabsTrigger>
        </TabsList>

        {/* ── Single payment ─────────────────────────────────────────────── */}
        <TabsContent value="single" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Record one payment</CardTitle>
              <CardDescription>
                Fill the owner, the method, and the amount. The system auto-matches
                against existing bank deposits when you submit.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="personId">Owner</Label>
                <Select value={personId} onValueChange={setPersonId}>
                  <SelectTrigger id="personId" data-testid="select-person">
                    <SelectValue placeholder="Select an owner…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(personsQuery.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.firstName} {p.lastName} {p.email ? `· ${p.email}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="unitId">Unit</Label>
                <Select value={unitId} onValueChange={setUnitId}>
                  <SelectTrigger id="unitId" data-testid="select-unit">
                    <SelectValue placeholder="Select a unit…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(unitsQuery.data ?? []).map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.unitNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="amount">Amount (USD)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="250.00"
                  data-testid="input-amount"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="method">Method</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                  <SelectTrigger id="method" data-testid="select-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Method-specific fields */}
              {method === "check" && (
                <div className="space-y-1.5">
                  <Label htmlFor="checkNumber">Check #</Label>
                  <Input
                    id="checkNumber"
                    value={checkNumber}
                    onChange={(e) => setCheckNumber(e.target.value)}
                    placeholder="1042"
                    data-testid="input-check-number"
                  />
                </div>
              )}
              {(method === "zelle" || method === "venmo") && (
                <div className="space-y-1.5">
                  <Label htmlFor="zelleSender">
                    {method === "zelle" ? "Zelle sender" : "Venmo handle"}
                  </Label>
                  <Input
                    id="zelleSender"
                    value={zelleSender}
                    onChange={(e) => setZelleSender(e.target.value)}
                    placeholder={method === "zelle" ? "WILLIAM RUIZ" : "@williamruiz"}
                    data-testid="input-sender"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="receivedAt">Received on</Label>
                <Input
                  id="receivedAt"
                  type="date"
                  value={receivedAt}
                  onChange={(e) => setReceivedAt(e.target.value)}
                  data-testid="input-received-at"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything else — e.g. 'left in mail slot 5/22', 'partial payment toward May'."
                  rows={2}
                  data-testid="input-notes"
                />
              </div>

              <div className="md:col-span-2 flex items-center gap-2">
                <input
                  id="attemptBankMatch"
                  type="checkbox"
                  checked={attemptBankMatch}
                  onChange={(e) => setAttemptBankMatch(e.target.checked)}
                  data-testid="checkbox-attempt-bank-match"
                />
                <Label htmlFor="attemptBankMatch" className="text-sm text-muted-foreground">
                  Run reconciliation auto-match after recording (recommended)
                </Label>
              </div>

              <div className="md:col-span-2">
                <Button
                  onClick={() => recordMutation.mutate()}
                  disabled={!formValid || recordMutation.isPending}
                  data-testid="button-submit"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {recordMutation.isPending ? "Recording…" : "Record payment"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {lastResult && (
            <Card className="border-green-300 bg-green-50/40">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Last record
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <div>
                  <strong>{lastResult.payment.description}</strong> · $
                  {Math.abs(lastResult.payment.amount).toFixed(2)}
                </div>
                {lastResult.autoMatch && (
                  <div className="text-muted-foreground">
                    Auto-match: {lastResult.autoMatch.matched.length} matched ·{" "}
                    {lastResult.autoMatch.needsManualReview.length} need review
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Bulk paste ─────────────────────────────────────────────────── */}
        <TabsContent value="bulk" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardPaste className="h-4 w-4" />
                Bulk paste
              </CardTitle>
              <CardDescription>
                Paste a CSV or TSV with a header row. Required columns:{" "}
                <code className="text-xs bg-muted px-1">personId</code>,{" "}
                <code className="text-xs bg-muted px-1">amount</code>,{" "}
                <code className="text-xs bg-muted px-1">method</code>,{" "}
                <code className="text-xs bg-muted px-1">receivedAt</code>. Optional:{" "}
                <code className="text-xs bg-muted px-1">unitId</code>,{" "}
                <code className="text-xs bg-muted px-1">checkNumber</code>,{" "}
                <code className="text-xs bg-muted px-1">zelleSender</code>,{" "}
                <code className="text-xs bg-muted px-1">notes</code>. Tab-separated is
                most reliable (Excel / Google Sheets default).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={bulkBlob}
                onChange={(e) => setBulkBlob(e.target.value)}
                rows={8}
                placeholder={`personId\tamount\tmethod\treceivedAt\tcheckNumber\nperson-1\t250.00\tcheck\t2026-05-20\t1042\nperson-2\t300.00\tzelle\t2026-05-21\n…`}
                className="font-mono text-xs"
                data-testid="textarea-bulk"
              />
              <Button
                onClick={() => bulkMutation.mutate()}
                disabled={!bulkBlob.trim() || bulkMutation.isPending}
                data-testid="button-submit-bulk"
              >
                <Send className="mr-2 h-4 w-4" />
                {bulkMutation.isPending ? "Recording…" : "Record all"}
              </Button>
            </CardContent>
          </Card>

          {bulkResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bulk result</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm">
                  <Badge variant="default" className="mr-2">
                    {bulkResult.recorded.length} recorded
                  </Badge>
                  {bulkResult.failures.length > 0 && (
                    <Badge variant="destructive">
                      {bulkResult.failures.length} failed
                    </Badge>
                  )}
                </div>
                {bulkResult.failures.length > 0 && (
                  <div className="space-y-1 text-xs">
                    <div className="font-medium text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Failures
                    </div>
                    {bulkResult.failures.map((f) => (
                      <div key={f.index} className="font-mono">
                        Row {f.index + 1}: {f.error}
                      </div>
                    ))}
                  </div>
                )}
                {bulkResult.autoMatch && (
                  <div className="text-sm text-muted-foreground">
                    Auto-match: {bulkResult.autoMatch.matched.length} matched ·{" "}
                    {bulkResult.autoMatch.needsManualReview.length} need review
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Recent records (always visible) ────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent recorded payments</CardTitle>
          <CardDescription>The last 20 manually-recorded payments for this association.</CardDescription>
        </CardHeader>
        <CardContent>
          {recentQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (recentQuery.data?.entries ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No manual payments recorded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Received</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead>Recorded by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(recentQuery.data?.entries ?? []).map((r) => {
                  const person = personById.get(r.personId);
                  const unit = unitById.get(r.unitId);
                  return (
                    <TableRow key={r.id} data-testid={`row-recent-${r.id}`}>
                      <TableCell className="text-xs">
                        {new Date(r.postedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {person ? `${person.firstName} ${person.lastName}` : r.personId.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-sm">{unit?.unitNumber ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {r.method}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${Math.abs(r.amount).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-xs max-w-xs truncate" title={r.description ?? ""}>
                        {r.description ?? "—"}
                      </TableCell>
                      <TableCell>
                        {r.settledAt ? (
                          <Badge variant="default" className="bg-green-600">
                            Matched
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.actorEmail ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Client-side parser (mirror of server's parseBulkPaste — duplicated here ──
//    so the page doesn't need to import the server module). The shape MUST
//    stay in sync with `server/routes/admin-payments.ts::parseBulkPaste`.

function parseBulkPasteClient(
  blob: string,
  associationId: string,
): {
  rows: Array<{
    associationId: string;
    personId: string;
    unitId?: string;
    amount: number;
    method: PaymentMethod;
    checkNumber?: string;
    zelleSender?: string;
    receivedAt: string;
    notes?: string;
  }>;
  errors: Array<{ line: number; message: string }>;
} {
  const errors: Array<{ line: number; message: string }> = [];
  const rows: ReturnType<typeof parseBulkPasteClient>["rows"] = [];

  const trimmed = blob.replace(/\r\n/g, "\n").trim();
  if (!trimmed) return { rows, errors: [{ line: 0, message: "Empty input" }] };
  const lines = trimmed.split("\n");
  if (lines.length < 2) {
    return { rows, errors: [{ line: 0, message: "Need a header row + at least one data row" }] };
  }

  const headerLine = lines[0];
  const delim = headerLine.includes("\t") ? "\t" : ",";
  const headers = headerLine.split(delim).map((h) => h.trim().toLowerCase());

  const required = ["personid", "amount", "method", "receivedat"];
  for (const h of required) {
    if (!headers.includes(h)) errors.push({ line: 1, message: `Missing required column: ${h}` });
  }
  if (errors.length > 0) return { rows, errors };

  const idx = (n: string) => headers.indexOf(n);
  const VALID_METHODS: PaymentMethod[] = ["cash", "check", "zelle", "external-ach", "venmo", "other"];

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const cols = raw.split(delim).map((c) => c.trim());
    const m = cols[idx("method")]?.toLowerCase();
    const amt = Number((cols[idx("amount")] ?? "").replace(/[$,]/g, ""));
    if (!cols[idx("personid")]) {
      errors.push({ line: i + 1, message: "personId required" });
      continue;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      errors.push({ line: i + 1, message: "amount must be positive" });
      continue;
    }
    if (!VALID_METHODS.includes(m as PaymentMethod)) {
      errors.push({ line: i + 1, message: `unknown method: ${m}` });
      continue;
    }
    rows.push({
      associationId,
      personId: cols[idx("personid")],
      unitId: idx("unitid") >= 0 ? cols[idx("unitid")] || undefined : undefined,
      amount: amt,
      method: m as PaymentMethod,
      checkNumber: idx("checknumber") >= 0 ? cols[idx("checknumber")] || undefined : undefined,
      zelleSender: idx("zellesender") >= 0 ? cols[idx("zellesender")] || undefined : undefined,
      receivedAt: cols[idx("receivedat")],
      notes: idx("notes") >= 0 ? cols[idx("notes")] || undefined : undefined,
    });
  }
  return { rows, errors };
}
