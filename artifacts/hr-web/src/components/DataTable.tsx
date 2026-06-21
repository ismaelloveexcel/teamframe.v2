import type { ReactNode } from "react";
import { cn } from "../lib/utils";

export type Column<T> = {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-tf-border bg-tf-bg text-left text-xs font-medium uppercase tracking-wide text-tf-subtle">
            {columns.map((c) => (
              <th key={c.key} className={cn("px-4 py-3", c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-tf-border-soft">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "transition-colors",
                onRowClick && "cursor-pointer hover:bg-accent-soft/40",
              )}
            >
              {columns.map((c) => (
                <td key={c.key} className={cn("px-4 py-3 text-tf-text", c.className)}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Client-side pagination ────────────────────────────────────────────────────
export function Pagination({
  page,
  pageCount,
  total,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPage: (p: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-tf-border-soft px-4 py-3 text-sm text-tf-muted">
      <span>
        Page {page} of {pageCount} · {total} total
      </span>
      <div className="flex gap-2">
        <button
          className="rounded-lg border border-tf-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-tf-panel disabled:cursor-not-allowed disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </button>
        <button
          className="rounded-lg border border-tf-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-tf-panel disabled:cursor-not-allowed disabled:opacity-40"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
