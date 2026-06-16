import type { ReactNode } from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { errorMessage } from "../lib/api-client";
import { cn } from "../lib/utils";
import { Button, Card } from "./ui";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-slate-200", className)} />;
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="text-slate-300">{icon ?? <Inbox className="h-10 w-10" />}</div>
      <div>
        <p className="font-medium text-slate-700">{title}</p>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <AlertTriangle className="h-10 w-10 text-red-400" />
      <div>
        <p className="font-medium text-slate-700">Something went wrong</p>
        <p className="mt-1 max-w-md text-sm text-slate-500">{errorMessage(error)}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** Inline error banner for forms/mutations. */
export function ErrorBanner({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{errorMessage(error)}</span>
    </div>
  );
}

/**
 * Render-prop wrapper that handles the loading/error/empty/data state machine
 * for a TanStack query result so every module gets consistent UX.
 */
export function QueryState<T>({
  isLoading,
  isError,
  error,
  data,
  refetch,
  loading,
  empty,
  isEmpty,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  data: T | undefined;
  refetch?: () => void;
  loading?: ReactNode;
  empty?: ReactNode;
  isEmpty?: (data: T) => boolean;
  children: (data: T) => ReactNode;
}) {
  if (isLoading) return <>{loading ?? <TableSkeleton />}</>;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (data === undefined) return <ErrorState error={error} onRetry={refetch} />;
  if (empty && isEmpty && isEmpty(data)) return <>{empty}</>;
  return <>{children(data)}</>;
}

export function PageCard({ children }: { children: ReactNode }) {
  return <Card className="overflow-hidden">{children}</Card>;
}
