/**
 * /redesign-kit — internal design-system gallery (F1, founder-os#10187).
 *
 * Renders EVERY shared redesign primitive so the design system can be verified
 * pixel-for-pixel against the signed-off brand.css. Internal/noindex; not linked
 * from any user-facing nav.
 */
import { useState } from "react";
import {
  AppShell,
  Sidebar,
  TopBar,
  PageHead,
  Card,
  Stat,
  StatRow,
  DataTable,
  Pill,
  Button,
  Field,
  Input,
  Bar,
  BarChart,
  Donut,
  Sparkline,
  Cols2,
  Tiles,
  Tile,
  type Column,
} from "@/components/redesign";

type LedgerRow = { unit: string; owner: string; balance: string; status: "ok" | "warn" | "bad" };
const LEDGER: LedgerRow[] = [
  { unit: "12A", owner: "Alvarez, M.", balance: "$0.00", status: "ok" },
  { unit: "3B", owner: "Chen, L.", balance: "$420.00", status: "warn" },
  { unit: "7C", owner: "Okonkwo, D.", balance: "$1,180.00", status: "bad" },
  { unit: "5D", owner: "Silva, R.", balance: "$0.00", status: "ok" },
];
const COLUMNS: Column<LedgerRow>[] = [
  { key: "unit", header: "Unit" },
  { key: "owner", header: "Owner" },
  { key: "balance", header: "Balance", align: "right" },
  {
    key: "status",
    header: "Status",
    render: (r) => (
      <Pill tone={r.status === "ok" ? "ok" : r.status === "warn" ? "warn" : "bad"}>
        {r.status === "ok" ? "Current" : r.status === "warn" ? "Past due" : "Delinquent"}
      </Pill>
    ),
  },
];

function KitBlock({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <Card title={heading}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-start" }}>{children}</div>
    </Card>
  );
}

export default function RedesignKitPage() {
  const [q, setQ] = useState("");
  return (
    <AppShell
      sidebar={
        <Sidebar
          brandTitle="Your Condo Manager"
          brandSubtitle="Design System"
          groups={[
            {
              label: "Kit",
              items: [
                { label: "Foundations", active: true },
                { label: "Primitives" },
                { label: "Data", count: 4 },
                { label: "Charts" },
              ],
            },
            {
              label: "Surfaces",
              items: [{ label: "Manager app" }, { label: "Owner portal" }, { label: "Owner app" }],
            },
          ]}
          footer={<span style={{ fontSize: 10.5, color: "#6db3ac" }}>F1 · @ycm/design-system</span>}
        />
      }
    >
      <TopBar
        title="Redesign Kit"
        onSearch={setQ}
        searchPlaceholder="Search primitives…"
        actions={<Button variant="ghost">Docs</Button>}
        who={{ name: "William", role: "Owner", initials: "WR" }}
      />

      <PageHead
        eyebrow="Design System · F1"
        title="Shared primitives"
        lede={`Every primitive renders on the deep-teal brand and is consumed identically by the Manager app, Owner portal, and Owner app. Filter: ${q || "—"}`}
        actions={<Button>Primary action</Button>}
      />

      {/* Foundations — color + type */}
      <KitBlock heading="Brand palette">
        {[
          ["teal", "#014D4A"],
          ["teal-700", "#0A6A63"],
          ["accent", "#15A39C"],
          ["light", "#BFE8E4"],
          ["ink", "#0F2E2C"],
          ["muted", "#5B7572"],
        ].map(([name, hex]) => (
          <div key={name} style={{ width: 96 }}>
            <div style={{ height: 48, borderRadius: 10, background: hex, border: "1px solid var(--ds-gray)" }} />
            <div style={{ fontSize: 11, fontWeight: 700, marginTop: 6, color: "var(--ds-teal)" }}>{name}</div>
            <div style={{ fontSize: 10.5, color: "var(--ds-sub)" }}>{hex}</div>
          </div>
        ))}
      </KitBlock>

      {/* Buttons */}
      <KitBlock heading="Buttons">
        <Button variant="primary">Primary</Button>
        <Button variant="accent">Accent</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="primary" disabled>
          Disabled
        </Button>
      </KitBlock>

      {/* Pills */}
      <KitBlock heading="Pills">
        <Pill tone="ok">Current</Pill>
        <Pill tone="warn">Past due</Pill>
        <Pill tone="bad">Delinquent</Pill>
        <Pill tone="info">Info</Pill>
        <Pill tone="muted">Archived</Pill>
      </KitBlock>

      {/* KPI tiles */}
      <StatRow>
        <Stat label="Collected MTD" value="$48,210" delta="▲ 6.2% vs last mo" deltaTone="good" />
        <Stat label="Delinquency" value="4.1%" delta="▼ 0.8%" deltaTone="good" />
        <Stat label="Open work orders" value="12" delta="3 overdue" deltaTone="warn" />
        <Stat label="Reserve funded" value="82%" delta="target 85%" deltaTone="bad" />
      </StatRow>

      {/* Table + fields */}
      <Cols2>
        <Card title="Owner ledger" more="View all">
          <DataTable columns={COLUMNS} rows={LEDGER} rowKey={(r) => r.unit} />
        </Card>
        <Card title="New charge">
          <Field label="Unit" hint="Select the unit to charge.">
            <Input placeholder="e.g. 12A" />
          </Field>
          <Field label="Amount">
            <Input placeholder="$0.00" inputMode="decimal" />
          </Field>
          <Button variant="accent">Post charge</Button>
        </Card>
      </Cols2>

      {/* Bars */}
      <KitBlock heading="Progress bars">
        <div style={{ width: 160 }}>
          <div style={{ fontSize: 11, marginBottom: 5, color: "var(--ds-sub)" }}>Accent 64%</div>
          <Bar value={64} />
        </div>
        <div style={{ width: 160 }}>
          <div style={{ fontSize: 11, marginBottom: 5, color: "var(--ds-sub)" }}>Reserve 82%</div>
          <Bar value={82} tone="teal" />
        </div>
        <div style={{ width: 160 }}>
          <div style={{ fontSize: 11, marginBottom: 5, color: "var(--ds-sub)" }}>Collected 95%</div>
          <Bar value={95} tone="good" />
        </div>
        <div style={{ width: 160 }}>
          <div style={{ fontSize: 11, marginBottom: 5, color: "var(--ds-sub)" }}>Overdue 30%</div>
          <Bar value={30} tone="bad" />
        </div>
      </KitBlock>

      {/* Charts */}
      <Cols2>
        <Card title="Collections (6 mo)">
          <BarChart
            data={[
              { label: "Feb", value: 38 },
              { label: "Mar", value: 42 },
              { label: "Apr", value: 40 },
              { label: "May", value: 47 },
              { label: "Jun", value: 45 },
              { label: "Jul", value: 48 },
            ]}
          />
        </Card>
        <Card title="Reserve funding">
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <Donut percent={82} />
            <div>
              <Sparkline values={[3, 5, 4, 6, 5, 8, 7, 9]} peakIndex={7} />
              <div style={{ fontSize: 11, color: "var(--ds-sub)", marginTop: 6 }}>8-week trend</div>
            </div>
          </div>
        </Card>
      </Cols2>

      {/* Tiles */}
      <Card title="Quick actions">
        <Tiles>
          <Tile icon="🧾" title="Record payment" subtitle="Log a check or cash" />
          <Tile icon="🛠️" title="New work order" subtitle="Dispatch a vendor" />
          <Tile icon="📄" title="Post document" subtitle="Share with owners" />
          <Tile icon="📣" title="Send notice" subtitle="Blast the community" />
        </Tiles>
      </Card>
    </AppShell>
  );
}
