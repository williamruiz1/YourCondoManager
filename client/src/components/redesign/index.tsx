/**
 * @ycm/design-system — shared redesign primitives (F1, founder-os#10187)
 *
 * ONE React component set consumed by all three surfaces (Manager app, Owner
 * portal, Owner app). Styles live in client/src/styles/redesign-kit.css, lifted
 * pixel-for-pixel from the signed-off redesign prototype so every surface
 * renders identically on the deep-teal brand.
 *
 * LIGHT-FIRST: no dark-mode variants. Dark mode stays SHELVED.
 *
 * The real YCM ascending-buildings brand mark is rendered via <BrandMark> — no
 * placeholder gradient square.
 */
import type { CSSProperties, ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import "@/styles/redesign-kit.css";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ── AppShell ─────────────────────────────────────────────────────────────── */
export function AppShell({
  sidebar,
  children,
  className,
}: {
  sidebar?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("ds-scope ds-shell", className)}>
      {sidebar}
      <main className="ds-main">{children}</main>
    </div>
  );
}

/* ── Sidebar ──────────────────────────────────────────────────────────────── */
export type SidebarItem = {
  label: string;
  href?: string;
  active?: boolean;
  count?: number | string;
  onClick?: () => void;
  icon?: ReactNode;
};
export type SidebarGroup = { label?: string; items: SidebarItem[] };

export function Sidebar({
  brandTitle = "Your Condo Manager",
  brandSubtitle,
  groups,
  footer,
}: {
  brandTitle?: string;
  brandSubtitle?: string;
  groups: SidebarGroup[];
  footer?: ReactNode;
}) {
  return (
    <nav className="ds-sidebar" aria-label="Primary">
      <div className="ds-brand">
        <BrandMark forceTheme="light" className="ds-mk" decorative />
        <div>
          <div className="ds-tt">{brandTitle}</div>
          {brandSubtitle ? <div className="ds-st">{brandSubtitle}</div> : null}
        </div>
      </div>
      {groups.map((group, gi) => (
        <div key={gi}>
          {group.label ? <div className="ds-grouplabel">{group.label}</div> : null}
          {group.items.map((item, ii) => {
            const cls = cx("ds-navitem", item.active && "ds-active");
            const inner = (
              <>
                {item.icon ? <span className="ds-nav-ic">{item.icon}</span> : null}
                <span>{item.label}</span>
                {item.count != null ? <span className="ds-count">{item.count}</span> : null}
              </>
            );
            return item.href ? (
              <a key={ii} href={item.href} className={cls}>
                {inner}
              </a>
            ) : (
              <button key={ii} type="button" className={cls} onClick={item.onClick} style={{ width: "100%", textAlign: "left", background: "none", border: 0, cursor: "pointer" }}>
                {inner}
              </button>
            );
          })}
        </div>
      ))}
      {footer ? <div className="ds-sidebar-foot">{footer}</div> : null}
    </nav>
  );
}

/* ── TopBar ───────────────────────────────────────────────────────────────── */
export function TopBar({
  title,
  onSearch,
  searchPlaceholder = "Search…",
  actions,
  who,
}: {
  title?: ReactNode;
  onSearch?: (v: string) => void;
  searchPlaceholder?: string;
  actions?: ReactNode;
  who?: { name: string; initials?: string; role?: string };
}) {
  return (
    <div className="ds-topbar">
      {title ? <div className="ds-title">{title}</div> : null}
      {onSearch !== undefined ? (
        <input
          className="ds-search"
          placeholder={searchPlaceholder}
          onChange={(e) => onSearch?.(e.target.value)}
          aria-label="Search"
        />
      ) : null}
      <div className="ds-actions">
        {actions}
        {who ? (
          <span className="ds-who">
            <span className="ds-avatar">{who.initials ?? who.name.slice(0, 2).toUpperCase()}</span>
            <span>{who.name}{who.role ? ` · ${who.role}` : ""}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* ── PageHead ─────────────────────────────────────────────────────────────── */
export function PageHead({
  eyebrow,
  title,
  lede,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="ds-pagehead">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          {eyebrow ? <div className="ds-eyebrow">{eyebrow}</div> : null}
          <h1>{title}</h1>
          {lede ? <div className="ds-lede">{lede}</div> : null}
        </div>
        {actions ? <div className="ds-actions">{actions}</div> : null}
      </div>
    </div>
  );
}

/* ── Card ─────────────────────────────────────────────────────────────────── */
export function Card({
  title,
  more,
  children,
  className,
}: {
  title?: ReactNode;
  more?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("ds-card", className)}>
      {title != null || more != null ? (
        <div className="ds-card-head">
          <span>{title}</span>
          {more != null ? <span className="ds-more">{more}</span> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/* ── Stat (KPI tile) ──────────────────────────────────────────────────────── */
export type StatDeltaTone = "good" | "bad" | "warn";
export function Stat({
  label,
  value,
  delta,
  deltaTone,
}: {
  label: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
  deltaTone?: StatDeltaTone;
}) {
  return (
    <div className="ds-stat">
      <div className="ds-l">{label}</div>
      <div className="ds-v">{value}</div>
      {delta != null ? <div className={cx("ds-d", deltaTone && `ds-${deltaTone}`)}>{delta}</div> : null}
    </div>
  );
}
export function StatRow({ children }: { children: ReactNode }) {
  return <div className="ds-statrow">{children}</div>;
}

/* ── DataTable (.tbl) ─────────────────────────────────────────────────────── */
export type Column<Row> = {
  key: string;
  header: ReactNode;
  render?: (row: Row) => ReactNode;
  align?: "left" | "right" | "center";
};
export function DataTable<Row extends Record<string, unknown>>({
  columns,
  rows,
  rowKey,
}: {
  columns: Column<Row>[];
  rows: Row[];
  rowKey?: (row: Row, i: number) => string;
}) {
  return (
    <table className="ds-tbl">
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} style={c.align ? { textAlign: c.align } : undefined}>
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={rowKey ? rowKey(row, i) : i}>
            {columns.map((c) => (
              <td key={c.key} style={c.align ? { textAlign: c.align } : undefined}>
                {c.render ? c.render(row) : (row[c.key] as ReactNode)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ── Pill ─────────────────────────────────────────────────────────────────── */
export type PillTone = "ok" | "warn" | "bad" | "info" | "muted";
export function Pill({ tone = "info", children }: { tone?: PillTone; children: ReactNode }) {
  return <span className={cx("ds-pill", `ds-${tone}`)}>{children}</span>;
}

/* ── Button ───────────────────────────────────────────────────────────────── */
export type ButtonVariant = "primary" | "accent" | "ghost";
export function Button({
  variant = "primary",
  children,
  onClick,
  disabled,
  type = "button",
  href,
  className,
}: {
  variant?: ButtonVariant;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  href?: string;
  className?: string;
}) {
  const cls = cx("ds-btn", variant === "accent" && "ds-accent", variant === "ghost" && "ds-ghost", className);
  if (href) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

/* ── Field ────────────────────────────────────────────────────────────────── */
export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <label className="ds-field" htmlFor={htmlFor}>
      {label ? <span className="ds-flabel">{label}</span> : null}
      {children}
      {hint ? <span className="ds-fhint">{hint}</span> : null}
    </label>
  );
}
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx("ds-fcontrol", props.className)} />;
}

/* ── Bar (progress meter) ─────────────────────────────────────────────────── */
export type BarTone = "accent" | "teal" | "good" | "warn" | "bad";
export function Bar({ value, tone = "accent" }: { value: number; tone?: BarTone }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cx("ds-bar", tone !== "accent" && `ds-${tone}`)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ── Chart helpers (CSS-only) ─────────────────────────────────────────────── */
export function BarChart({ data, max }: { data: Array<{ label: string; value: number }>; max?: number }) {
  const m = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="ds-chart-bars">
      {data.map((d, i) => (
        <div key={i} className="ds-cb">
          <i style={{ height: `${(d.value / m) * 100}%` }} />
          <span className="ds-cl">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
export function Donut({ percent, label }: { percent: number; label?: ReactNode }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className="ds-chart-donut" style={{ ["--_p" as keyof CSSProperties]: `${p}%` } as CSSProperties}>
      <span className="ds-dv">{label ?? `${Math.round(p)}%`}</span>
    </div>
  );
}
export function Sparkline({ values, peakIndex }: { values: number[]; peakIndex?: number }) {
  const m = Math.max(1, ...values);
  return (
    <div className="ds-spark" aria-hidden>
      {values.map((v, i) => (
        <i key={i} className={i === peakIndex ? "ds-peak" : undefined} style={{ height: `${(v / m) * 100}%` }} />
      ))}
    </div>
  );
}

/* ── Layout helpers ───────────────────────────────────────────────────────── */
export function Cols2({ children }: { children: ReactNode }) {
  return <div className="ds-cols2">{children}</div>;
}
export function Tiles({ children }: { children: ReactNode }) {
  return <div className="ds-tiles">{children}</div>;
}
export function Tile({ icon, title, subtitle }: { icon?: ReactNode; title: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="ds-tile">
      {icon ? <div className="ds-ic">{icon}</div> : null}
      <div className="ds-tt">{title}</div>
      {subtitle ? <div className="ds-ss">{subtitle}</div> : null}
    </div>
  );
}
