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
    <div className="space-y-4">
      <Breadcrumb>
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

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          {eyebrow ? <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</div> : null}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <p className="text-muted-foreground max-w-3xl">{summary}</p>
          </div>
          {shortcuts?.length ? (
            <div className="flex gap-2 flex-wrap">
              {shortcuts.map((shortcut, i) =>
                shortcut.onClick ? (
                  <Button key={i} size="sm" variant="outline" onClick={shortcut.onClick}>
                    {shortcut.label}
                  </Button>
                ) : (
                  <Button key={shortcut.href} asChild size="sm" variant="outline">
                    <Link href={shortcut.href!}>{shortcut.label}</Link>
                  </Button>
                )
              )}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2 flex-wrap">{actions}</div> : null}
      </div>
    </div>
  );
}

export function WorkspaceHeaderBadge({ label }: { label: string }) {
  return <Badge variant="outline">{label}</Badge>;
}
