import { Link } from "wouter";
import { cn } from "@/lib/utils";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function BreadcrumbNav({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav className={cn("flex items-center gap-2", className)} aria-label="Breadcrumb">
      {items.map((item, idx) => (
        <span key={idx} className="flex items-center gap-2">
          {idx > 0 && (
            <span className="label-caps text-on-surface-variant/40">/</span>
          )}
          {item.href && idx < items.length - 1 ? (
            <Link href={item.href}>
              <span className="label-caps text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
                {item.label}
              </span>
            </Link>
          ) : (
            <span className={cn(
              "label-caps",
              idx === items.length - 1
                ? "text-primary font-bold"
                : "text-on-surface-variant"
            )}>
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
