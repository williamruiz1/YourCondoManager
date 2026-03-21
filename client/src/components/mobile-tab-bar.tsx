import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

type TabItem<T extends string> = {
  id: T;
  label: string;
  icon?: ReactNode;
};

export function MobileTabBar<T extends string>({
  items,
  value,
  onChange,
  className,
  fullWidth = false,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={cn("overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}>
      <div
        className={cn(fullWidth ? "grid min-w-full gap-2" : "flex min-w-full gap-2")}
        style={fullWidth ? ({ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` } as CSSProperties) : undefined}
      >
        {items.map((item) => {
          const active = item.id === value;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={cn(
                "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                fullWidth ? "w-full" : "",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
