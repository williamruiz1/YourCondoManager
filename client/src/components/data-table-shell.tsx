import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";

export function DataTableShell({
  title,
  description,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search records",
  filterSlot,
  summary,
  children,
  page,
  totalPages,
  onPageChange,
}: {
  title: string;
  description?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filterSlot?: ReactNode;
  summary?: string;
  children: ReactNode;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {summary ? <div className="text-sm text-muted-foreground">{summary}</div> : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          className="min-h-11 w-full sm:max-w-sm"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        {filterSlot}
      </div>

      <div className="rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          {children}
        </div>
      </div>

      {totalPages > 1 ? (
        <Pagination className="justify-end">
          <PaginationContent>
            <PaginationItem>
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
                Previous
              </Button>
            </PaginationItem>
            <PaginationItem>
              <div className="px-3 text-sm text-muted-foreground">Page {page} of {totalPages}</div>
            </PaginationItem>
            <PaginationItem>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
                Next
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  );
}
