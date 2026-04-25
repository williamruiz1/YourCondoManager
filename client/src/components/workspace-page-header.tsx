import type { ReactNode } from "react";
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

export function WorkspacePageHeader({
  title,
  summary,
  eyebrow,
  breadcrumbs,
  shortcuts,
  actions,
  subPages,
  headingId,
}: {
  title: string;
  summary: string;
  eyebrow?: string;
  breadcrumbs?: BreadcrumbCrumb[];
  shortcuts?: Shortcut[];
  actions?: ReactNode;
  subPages?: SubPage[];
  // Wave 23 a11y: optional id propagated to the <h1>. When the page wrapper
  // is a <section aria-labelledby={headingId}>, this lets assistive tech
  // resolve the section's accessible name from the visible heading.
  headingId?: string;
}) {
  const crumbs = breadcrumbs ?? [{ label: title }];
  const [location] = useLocation();

  return (
    <div className="space-y-3 border-b border-outline-variant/40 pb-6">
      <Breadcrumb className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <BreadcrumbList>
          {crumbs.map((crumb, index) => (
            <BreadcrumbItem key={`${crumb.label}-${index}`}>
              {crumb.href ? (
                <BreadcrumbLink asChild>
                  <Link href={crumb.href} className="text-xs text-on-surface/50 hover:text-on-surface transition-colors">{crumb.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="text-xs text-on-surface/70">{crumb.label}</BreadcrumbPage>
              )}
              {index < crumbs.length - 1 ? <BreadcrumbSeparator className="text-on-surface/30" /> : null}
            </BreadcrumbItem>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          {eyebrow ? (
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/60" />
              <span className="text-[10px] font-label font-semibold uppercase tracking-[0.2em] text-on-surface/50">{eyebrow}</span>
            </div>
          ) : null}
          <div>
            <h1 id={headingId} className="font-headline text-3xl font-bold tracking-tight text-on-surface sm:text-[1.85rem]">{title}</h1>
            <p className="text-sm text-on-surface/60 max-w-3xl mt-1 leading-relaxed">{summary}</p>
          </div>
          {shortcuts?.length ? (
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              {shortcuts.map((shortcut, i) =>
                shortcut.onClick ? (
                  <Button key={i} size="sm" variant="outline" onClick={shortcut.onClick} className="min-h-11 justify-center sm:min-h-9 border-outline-variant/60 text-on-surface/70 hover:text-primary hover:border-primary/40">
                    {shortcut.label}
                  </Button>
                ) : (
                  <Button key={shortcut.href} asChild size="sm" variant="outline" className="min-h-11 justify-center sm:min-h-9 border-outline-variant/60 text-on-surface/70 hover:text-primary hover:border-primary/40">
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
        // Wave 23 a11y: aria-label scopes this nav so it's distinguishable
        // from the operator sidebar nav and the breadcrumb nav. Each Link
        // gets a focus-visible ring (Tailwind reset removes the default
        // outline). Material icons inside the link are decorative — the
        // text label is the accessible name — so they receive aria-hidden.
        <nav aria-label="Section navigation" className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap">
          {subPages.map((page) => {
            const active = location === page.href;
            return (
              <Link
                key={page.href}
                href={page.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-body font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                  active
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface/60 hover:bg-surface-variant/50 hover:text-on-surface"
                }`}
              >
                {page.icon ? (
                  <span aria-hidden="true" className="material-symbols-outlined text-[14px]">{page.icon}</span>
                ) : null}
                {page.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}

export function WorkspaceHeaderBadge({ label }: { label: string }) {
  return <Badge variant="outline">{label}</Badge>;
}
