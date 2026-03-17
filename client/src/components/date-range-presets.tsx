import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

export type DateRange = { from: Date | null; to: Date | null };

type Preset = { label: string; compute: () => DateRange };

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

const PRESETS: Preset[] = [
  {
    label: "Today",
    compute: () => {
      const d = new Date();
      return { from: startOfDay(d), to: endOfDay(d) };
    },
  },
  {
    label: "This Week",
    compute: () => {
      const now = new Date();
      const day = now.getDay();
      const from = new Date(now);
      from.setDate(now.getDate() - day);
      return { from: startOfDay(from), to: endOfDay(now) };
    },
  },
  {
    label: "This Month",
    compute: () => {
      const now = new Date();
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: endOfDay(now),
      };
    },
  },
  {
    label: "Last 30 Days",
    compute: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 30);
      return { from: startOfDay(from), to: endOfDay(to) };
    },
  },
  {
    label: "Last 90 Days",
    compute: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 90);
      return { from: startOfDay(from), to: endOfDay(to) };
    },
  },
  {
    label: "Year to Date",
    compute: () => {
      const now = new Date();
      return {
        from: new Date(now.getFullYear(), 0, 1),
        to: endOfDay(now),
      };
    },
  },
];

type Props = {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
};

function toInputDate(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().split("T")[0];
}

function fromInputDate(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function DateRangePresets({ value, onChange, className = "" }: Props) {
  const isActive = value.from !== null || value.to !== null;

  function isPresetActive(preset: Preset) {
    const computed = preset.compute();
    if (!value.from || !value.to) return false;
    return (
      toInputDate(value.from) === toInputDate(computed.from) &&
      toInputDate(value.to) === toInputDate(computed.to)
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {PRESETS.map((preset) => (
        <Button
          key={preset.label}
          type="button"
          variant={isPresetActive(preset) ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs px-2.5"
          onClick={() => onChange(isPresetActive(preset) ? { from: null, to: null } : preset.compute())}
        >
          {preset.label}
        </Button>
      ))}
      <div className="flex items-center gap-1 ml-1">
        <Label className="text-xs text-muted-foreground sr-only">From</Label>
        <Input
          type="date"
          className="h-7 text-xs w-32"
          value={toInputDate(value.from)}
          onChange={(e) => onChange({ ...value, from: fromInputDate(e.target.value) })}
          aria-label="Date from"
        />
        <span className="text-xs text-muted-foreground">–</span>
        <Input
          type="date"
          className="h-7 text-xs w-32"
          value={toInputDate(value.to)}
          onChange={(e) => onChange({ ...value, to: fromInputDate(e.target.value) })}
          aria-label="Date to"
        />
        {isActive && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onChange({ from: null, to: null })}
            aria-label="Clear date filter"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
