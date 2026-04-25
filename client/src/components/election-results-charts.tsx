// zone: Governance
// persona: Manager, Board Officer, Assisted Board, PM Assistant
//
// 5.4-F6 (Wave 16b) — recharts is dynamically imported on first render of
// the chart-bearing election-results panel. The static recharts import
// previously lived inside `election-detail.tsx` itself, which forced the
// `vendor-recharts` chunk (~108 KB gzip) onto the critical path for
// anyone navigating to the election detail page even when the underlying
// election was a secret ballot (no chart rendered).
//
// This wrapper is loaded via `React.lazy` from the page; the recharts
// import here is evaluated only when the page actually mounts the wrapper
// (i.e. `tally && !isSecretBallot && optionTallies.length > 0`).

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";

const DEFAULT_CHART_COLORS = ["#3b82f6", "#22c55e", "#f97316", "#a855f7", "#ec4899", "#0ea5e9"];

export interface OptionTallyDatum {
  label: string;
  votes: number;
  percent: number;
}

export function OptionTallyBarChart({
  data,
  colors = DEFAULT_CHART_COLORS,
}: {
  data: OptionTallyDatum[];
  colors?: readonly string[];
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 50)}>
      <BarChart
        data={data.map((opt) => ({ name: opt.label, votes: opt.votes, percent: opt.percent }))}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <XAxis type="number" />
        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value, _name, props) => {
            const percent =
              (props as { payload?: { percent?: number } } | undefined)?.payload?.percent ?? 0;
            return [`${value} votes (${percent}%)`, "Votes"];
          }}
        />
        <Bar dataKey="votes" radius={[0, 4, 4, 0]}>
          {data.map((_opt, idx) => (
            <Cell key={idx} fill={colors[idx % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ParticipationDonutChart({
  castCount,
  eligibleCount,
}: {
  castCount: number;
  eligibleCount: number;
}) {
  const remaining = Math.max(0, eligibleCount - castCount);
  return (
    <ResponsiveContainer width={160} height={160}>
      <PieChart>
        <Pie
          data={[
            { name: "Cast", value: castCount },
            { name: "Remaining", value: remaining },
          ]}
          cx="50%"
          cy="50%"
          innerRadius={45}
          outerRadius={65}
          paddingAngle={2}
          dataKey="value"
        >
          <Cell fill="#22c55e" />
          <Cell fill="#e5e7eb" />
        </Pie>
        <Tooltip formatter={(value: number) => [value, ""]} />
      </PieChart>
    </ResponsiveContainer>
  );
}
