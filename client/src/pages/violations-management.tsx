// zone: Operations
// persona: Manager, Board Officer, Assisted Board, PM Assistant, Viewer (read)
//
// Violations MANAGEMENT page (founder-os#10569, YCM Redesign M8).
//
// The missing management surface over the pre-existing `violations` table +
// board-mode "Log a violation" wizard — list · filter · detail drawer ·
// status timeline · notice history, per the signed-off wireframe:
//   artifacts/ycm-redesign-m8-violations/ycm-redesign-m8-violations-wireframe.html
//
// Built on @ycm/design-system (Card/Stat/DataTable/Pill/Button/Field — F1,
// founder-os#10187 / PR #434) rather than the legacy shadcn table components,
// since this page has no pre-redesign predecessor to restyle — it goes
// straight to the new primitives.
//
// Feature-gated: this whole page renders nothing (redirects to Work Orders)
// unless VIOLATIONS_MANAGEMENT_ENABLED is on (default OFF). The nav entry is
// separately hidden via app-sidebar-zones.ts, and every API call this page
// makes is independently 404'd server-side when the flag is off — this
// client-side redirect is defense-in-depth for a direct URL visit.
//
// Money-safety: display + status-transition ONLY. Fine posting stays on the
// existing LogViolationWizard -> owner-ledger flow; this page never creates
// or edits a ledger entry.
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Violation } from "@shared/schema";
import { getFeatureFlag } from "@shared/feature-flags";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  PageHead,
  Cols2,
  Card,
  Stat,
  StatRow,
  DataTable,
  Pill,
  Button,
  type PillTone,
  type Column,
} from "@/components/redesign";

type ManagementViolation = Violation & {
  unitNumber: string | null;
  unitBuilding: string | null;
  ownerName: string | null;
  noticeCount: number;
};

type ManagementStats = {
  open: number;
  openOver30Days: number;
  noticeSent: number;
  escalated: number;
  curedLast30Days: number;
};

type TimelineEvent = {
  id: string;
  kind: "opened" | "notice" | "status";
  label: string;
  detail: string | null;
  actor: string | null;
  at: string;
};

type ViolationDetail = {
  violation: Violation;
  unitNumber: string | null;
  unitBuilding: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  timeline: TimelineEvent[];
};

const STATUS_TONE: Record<string, PillTone> = {
  open: "bad",
  "notice-sent": "warn",
  escalated: "bad",
  cured: "ok",
  closed: "muted",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  "notice-sent": "Notice sent",
  escalated: "Escalated",
  cured: "Cured",
  closed: "Closed",
};

function formatDate(value: string | Date): string {
  const d = new Date(value);
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}

function formatDateTime(value: string | Date): string {
  const d = new Date(value);
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" }) + " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function unitDisplay(row: Pick<ManagementViolation, "unitNumber" | "unitBuilding">): string {
  if (!row.unitNumber) return "Unlinked";
  return row.unitBuilding ? `${row.unitBuilding} · ${row.unitNumber}` : row.unitNumber;
}

export default function ViolationsManagementPage() {
  const enabled = getFeatureFlag("VIOLATIONS_MANAGEMENT_ENABLED");
  const [, navigate] = useLocation();

  if (!enabled) {
    // Defense-in-depth redirect — see file header. The nav entry is already
    // hidden and the API is already 404'd; this just keeps a direct URL
    // visit from landing on an empty/broken page.
    if (typeof window !== "undefined") {
      queueMicrotask(() => navigate("/app/work-orders"));
    }
    return null;
  }

  return <ViolationsManagementContent />;
}

function ViolationsManagementContent() {
  useDocumentTitle("Violations");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string[]>(["open", "notice-sent"]);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const listQuery = useQuery<{ violations: ManagementViolation[]; stats: ManagementStats }>({
    queryKey: ["/api/violations/management"],
  });

  const rows = listQuery.data?.violations ?? [];
  const stats = listQuery.data?.stats;

  const types = useMemo(() => Array.from(new Set(rows.map((r) => r.violationType))).sort(), [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter.length > 0 && !statusFilter.includes(r.status)) return false;
      if (typeFilter !== "all" && r.violationType !== typeFilter) return false;
      return true;
    });
  }, [rows, statusFilter, typeFilter]);

  const activeId = selectedId ?? filteredRows[0]?.id ?? null;

  const detailQuery = useQuery<ViolationDetail>({
    queryKey: ["/api/violations/management", activeId ?? ""],
    enabled: Boolean(activeId),
  });

  const sendNotice = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/violations/management/${id}/notices`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/violations/management"] });
      toast({ title: "Notice sent" });
    },
    onError: (err: Error) => toast({ title: "Couldn't send the notice", description: err.message, variant: "destructive" }),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("POST", `/api/violations/management/${id}/status`, { status, note: noteDraft.trim() || undefined });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/violations/management"] });
      setNoteDraft("");
      toast({ title: "Status updated" });
    },
    onError: (err: Error) => toast({ title: "Couldn't update status", description: err.message, variant: "destructive" }),
  });

  const columns: Column<ManagementViolation>[] = [
    {
      key: "unit",
      header: "Unit / Owner",
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: "var(--ds-teal)" }}>{unitDisplay(row)}</div>
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>{row.ownerName || "No owner linked"}</div>
        </div>
      ),
    },
    { key: "violationType", header: "Type" },
    { key: "observedAt", header: "Observed", render: (row) => <span style={{ color: "var(--ds-muted)" }}>{formatDate(row.observedAt)}</span> },
    {
      key: "status",
      header: "Status",
      render: (row) => <Pill tone={STATUS_TONE[row.status] ?? "muted"}>{STATUS_LABEL[row.status] ?? row.status}</Pill>,
    },
    {
      key: "fineAmount",
      header: "Fine",
      align: "right",
      render: (row) => (row.fineAmount ? <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>${row.fineAmount.toFixed(2)}</span> : <span style={{ color: "var(--ds-muted)" }}>—</span>),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <button
          type="button"
          onClick={() => setSelectedId(row.id)}
          style={{ background: "none", border: 0, color: "var(--ds-accent)", fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}
          data-testid={`button-view-violation-${row.id}`}
        >
          View
        </button>
      ),
    },
  ];

  const detail = detailQuery.data;

  return (
    <div style={{ padding: 24, maxWidth: 1180 }}>
      <PageHead
        eyebrow="Compliance"
        title="Violations"
        lede="Track CC&R violations by unit — from first observation through notice, cure, or escalation."
        actions={
          <Button variant="primary" href="/app/board/log-violation">
            + Log violation
          </Button>
        }
      />

      <StatRow>
        <Stat label="Open" value={stats?.open ?? "—"} delta={stats ? `${stats.openOver30Days} over 30 days` : undefined} deltaTone="bad" />
        <Stat label="Notice sent" value={stats?.noticeSent ?? "—"} delta="awaiting cure" />
        <Stat label="Escalated" value={stats?.escalated ?? "—"} delta={stats?.escalated ? "to counsel / fine" : undefined} deltaTone="bad" />
        <Stat label="Cured (30d)" value={stats?.curedLast30Days ?? "—"} delta={stats ? "resolved" : undefined} deltaTone="good" />
      </StatRow>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "14px 0", alignItems: "center" }}>
        {(["open", "notice-sent", "escalated", "cured", "closed"] as const).map((s) => {
          const on = statusFilter.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() =>
                setStatusFilter((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
              }
              data-testid={`filter-status-${s}`}
              style={{
                background: on ? "var(--ds-light)" : "#fff",
                border: `1px solid ${on ? "#a6d8d2" : "var(--ds-gray)"}`,
                color: on ? "var(--ds-teal)" : "var(--ds-sub)",
                fontWeight: on ? 600 : 400,
                borderRadius: 999,
                padding: "7px 13px",
                fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              {STATUS_LABEL[s]}
            </button>
          );
        })}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          data-testid="filter-type"
          style={{ border: "1px solid var(--ds-gray)", borderRadius: 999, padding: "7px 13px", fontSize: 12.5, color: "var(--ds-sub)", background: "#fff" }}
        >
          <option value="all">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <span style={{ marginLeft: "auto", color: "var(--ds-muted)", fontSize: 12.5 }}>
          {listQuery.isLoading ? "Loading…" : `${filteredRows.length} shown`}
        </span>
      </div>

      <Cols2>
        <Card title="All violations" more={<span>· {filteredRows.length} active</span>}>
          <DataTable
            columns={columns}
            rows={filteredRows}
            rowKey={(row) => row.id}
          />
          {!listQuery.isLoading && filteredRows.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: "var(--ds-muted)", fontSize: 13 }}>
              No violations match the current filters.
            </div>
          )}
        </Card>

        <Card title={detail ? `${unitDisplay(detail)} · ${detail.violation.violationType}` : "Select a violation"}>
          {!activeId && <div style={{ color: "var(--ds-muted)", fontSize: 13 }}>Click "View" on a row to see its detail + notice history.</div>}
          {activeId && detailQuery.isLoading && <div style={{ color: "var(--ds-muted)", fontSize: 13 }}>Loading…</div>}
          {detail && (
            <div data-testid={`drawer-violation-${detail.violation.id}`}>
              <div style={{ color: "var(--ds-muted)", fontSize: 12.5, marginBottom: 10 }}>
                {detail.ownerName || "No owner linked"} · observed {formatDate(detail.violation.observedAt)}
              </div>
              <div style={{ marginBottom: 10 }}>
                <Pill tone={STATUS_TONE[detail.violation.status] ?? "muted"}>{STATUS_LABEL[detail.violation.status] ?? detail.violation.status}</Pill>
              </div>

              <KeyValue label="Type" value={detail.violation.violationType} />
              <KeyValue label="Fine posted" value={detail.violation.fineAmount ? `$${detail.violation.fineAmount.toFixed(2)}` : "—"} />
              <KeyValue label="Logged by" value={detail.violation.loggedByEmail ?? "—"} />
              <KeyValue label="Notices sent" value={String(detail.timeline.filter((e) => e.kind === "notice").length)} />

              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--ds-muted)", fontWeight: 700, margin: "16px 0 8px" }}>
                Description
              </div>
              <div style={{ color: "var(--ds-muted)", fontSize: 12.5 }}>{detail.violation.description}</div>

              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--ds-muted)", fontWeight: 700, margin: "16px 0 8px" }}>
                Status &amp; notice history
              </div>
              <div style={{ position: "relative", paddingLeft: 18 }}>
                {detail.timeline.map((ev) => (
                  <div key={ev.id} style={{ paddingBottom: 14, fontSize: 12.5 }} data-testid={`timeline-event-${ev.id}`}>
                    <b>{ev.label}</b>
                    {ev.detail ? <span> — {ev.detail}</span> : null}
                    <div style={{ color: "var(--ds-muted)", fontSize: 11, marginTop: 1 }}>{formatDateTime(ev.at)}{ev.actor ? ` · ${ev.actor}` : ""}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: "var(--ds-warnsoft)", border: "1px solid #eadfb0", color: "#6b5600", borderRadius: 8, padding: "11px 13px", fontSize: 12.5, marginTop: 8 }}>
                Notices reuse the existing Communications / notice-send pipeline — no separate notice engine.
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <Button
                  variant="accent"
                  className="flex-1"
                  disabled={sendNotice.isPending}
                  onClick={() => sendNotice.mutate(detail.violation.id)}
                >
                  Send notice
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1"
                  disabled={setStatus.isPending || detail.violation.status === "cured"}
                  onClick={() => setStatus.mutate({ id: detail.violation.id, status: "cured" })}
                >
                  Mark cured
                </Button>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <Button
                  variant="ghost"
                  className="flex-1"
                  disabled={setStatus.isPending || detail.violation.status === "escalated"}
                  onClick={() => setStatus.mutate({ id: detail.violation.id, status: "escalated" })}
                >
                  Escalate
                </Button>
              </div>
            </div>
          )}
        </Card>
      </Cols2>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", fontSize: 13, borderBottom: "1px dashed var(--ds-hairline)" }}>
      <span style={{ color: "var(--ds-muted)" }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
