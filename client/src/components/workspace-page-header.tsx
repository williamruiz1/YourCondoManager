import type { ReactNode } from "react";
import { Link } from "wouter";
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

export function WorkspacePageHeader({
  title,
  summary,
  eyebrow,
  breadcrumbs,
  shortcuts,
  actions,
}: {
  title: string;
  summary: string;
  eyebrow?: string;
  breadcrumbs?: BreadcrumbCrumb[];
  shortcuts?: Shortcut[];
  actions?: ReactNode;
}) {
  const crumbs = breadcrumbs ?? [{ label: title }];

  return (
    <div className="space-y-4 border-b border-border pb-5">
      <Breadcrumb className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <BreadcrumbList>
          {crumbs.map((crumb, index) => (
            <BreadcrumbItem key={`${crumb.label}-${index}`}>
              {crumb.href ? (
                <BreadcrumbLink asChild>
                  <Link href={crumb.href}>{crumb.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              )}
              {index < crumbs.length - 1 ? <BreadcrumbSeparator /> : null}
            </BreadcrumbItem>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          {eyebrow ? (
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/70" />
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</span>
            </div>
          ) : null}
          <div>
            <h1 className="text-[1.65rem] font-semibold leading-tight tracking-[-0.025em] sm:text-[1.75rem]">{title}</h1>
            <p className="text-sm text-muted-foreground max-w-3xl mt-0.5">{summary}</p>
          </div>
          {shortcuts?.length ? (
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              {shortcuts.map((shortcut, i) =>
                shortcut.onClick ? (
                  <Button key={i} size="sm" variant="outline" onClick={shortcut.onClick} className="min-h-11 justify-center sm:min-h-9">
                    {shortcut.label}
                  </Button>
                ) : (
                  <Button key={shortcut.href} asChild size="sm" variant="outline" className="min-h-11 justify-center sm:min-h-9">
                    <Link href={shortcut.href!}>{shortcut.label}</Link>
                  </Button>
                )
              )}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">{actions}</div> : null}
      </div>
    </div>
  );
}

export function WorkspaceHeaderBadge({ label }: { label: string }) {
  return <Badge variant="outline">{label}</Badge>;
}
