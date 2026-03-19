import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MobileSectionShell({
  eyebrow,
  title,
  summary,
  actions,
  meta,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  summary?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4 rounded-2xl border bg-white p-4 shadow-sm sm:p-5 md:p-6", className)}>
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            {eyebrow ? (
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {eyebrow}
              </div>
            ) : null}
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground sm:text-xl">{title}</h2>
              {summary ? <p className="mt-1 text-sm text-muted-foreground">{summary}</p> : null}
            </div>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {meta ? <div className="flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {children}
    </section>
  );
}
