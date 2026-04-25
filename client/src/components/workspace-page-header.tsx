import type { CSSProperties, ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type BreadcrumbCrumb = {
  label: string;
  href?: string;
};

type Shortcut = {
  label: string;
  href?: string;
  onClick?: () => void;
};

export type SubPage = {
  label: string;
  href: string;
  icon?: string;
};

// Scope outline-button borders to white on the dark banner so the shared
// Button outline variant (which reads `var(--button-outline)`) renders
// legibly on this gradient without touching every call site.
const bannerStyle: CSSProperties = {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  ["--button-outline" as string]: "rgba(255,255,255,0.4)",
};

export function WorkspacePageHeader({
  title,
  summary,
  eyebrow,
  breadcrumbs,
  shortcuts,
  actions,
  subPages,
}: {
  title: string;
  summary: string;
  eyebrow?: string;
  breadcrumbs?: BreadcrumbCrumb[];
  shortcuts?: Shortcut[];
  actions?: ReactNode;
  subPages?: SubPage[];
}) {
  const crumbs = breadcrumbs ?? [{ label: title }];
  const [location] = useLocation();

  return (
    <section
      className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(145deg,hsl(217_84%_26%)_0%,hsl(219_64%_20%)_55%,hsl(221_48%_12%)_100%)] p-6 text-white"
      style={bannerStyle}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -right-10 top-0 h-36 w-36 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -left-12 bottom-0 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
      </div>
      <div className="relative z-10 space-y-3">
        <Breadcrumb className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <BreadcrumbList>
            {crumbs.map((crumb, index) => (
              <BreadcrumbItem key={`${crumb.label}-${index}`}>
                {crumb.href ? (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href} className="text-xs text-white/60 hover:text-white transition-colors">{crumb.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="text-xs text-white/85">{crumb.label}</BreadcrumbPage>
                )}
                {index < crumbs.length - 1 ? <BreadcrumbSeparator className="text-white/40" /> : null}
              </BreadcrumbItem>
            ))}
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            {eyebrow ? (
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/70" />
                <span className="text-[10px] font-label font-semibold uppercase tracking-[0.2em] text-white/75">{eyebrow}</span>
              </div>
            ) : null}
            <div>
              <h1 className="font-headline text-3xl font-bold tracking-tight text-white sm:text-[1.85rem]">{title}</h1>
              <p className="text-sm text-white/85 max-w-3xl mt-1 leading-relaxed">{summary}</p>
            </div>
            {shortcuts?.length ? (
              <div className="grid gap-2 sm:flex sm:flex-wrap">
                {shortcuts.map((shortcut, i) =>
                  shortcut.onClick ? (
                    <Button key={i} size="sm" variant="outline" onClick={shortcut.onClick} className="min-h-11 justify-center sm:min-h-9 bg-white/10 text-white hover:bg-white/20">
                      {shortcut.label}
                    </Button>
                  ) : (
                    <Button key={shortcut.href} asChild size="sm" variant="outline" className="min-h-11 justify-center sm:min-h-9 bg-white/10 text-white hover:bg-white/20">
                      <Link href={shortcut.href!}>{shortcut.label}</Link>
                    </Button>
                  )
                )}
              </div>
            ) : null}
          </div>
          {actions ? <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">{actions}</div> : null}
        </div>

        {subPages?.length ? (
          <nav className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap">
            {subPages.map((page) => {
              const active = location === page.href;
              return (
                <Link
                  key={page.href}
                  href={page.href}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-body font-medium transition-all ${
                    active
                      ? "bg-white text-on-surface shadow-sm"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {page.icon ? (
                    <span className="material-symbols-outlined text-[14px]">{page.icon}</span>
                  ) : null}
                  {page.label}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </div>
    </section>
  );
}

export function WorkspaceHeaderBadge({ label }: { label: string }) {
  return <Badge variant="outline">{label}</Badge>;
}
