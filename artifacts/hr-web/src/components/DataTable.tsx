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
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            {columns.map((c) => (
              <th key={c.key} className={cn("px-4 py-3 font-medium", c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "border-b border-slate-100 last:border-0",
                onRowClick && "cursor-pointer hover:bg-slate-50",
              )}
            >
              {columns.map((c) => (
                <td key={c.key} className={cn("px-4 py-3 text-slate-700", c.className)}>
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
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
      <span>
        Page {page} of {pageCount} · {total} total
      </span>
      <div className="flex gap-2">
        <button
          className="rounded-md border border-slate-300 px-2.5 py-1 disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </button>
        <button
          className="rounded-md border border-slate-300 px-2.5 py-1 disabled:opacity-40"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
