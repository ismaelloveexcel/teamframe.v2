import type { ReactNode } from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { errorMessage } from "../lib/api-client";
import { cn } from "../lib/utils";
import { Button, Card } from "./ui";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-lg bg-tf-panel", className)} />
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className={cn("h-4 flex-1", c === 0 && "max-w-[120px]")}
            />
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
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-tf-panel text-tf-subtle">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <div>
        <p className="font-medium text-tf-text">{title}</p>
        {description && (
          <p className="mt-1.5 max-w-xs text-sm text-tf-muted">{description}</p>
        )}
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
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-tf-danger-soft text-tf-danger">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <div>
        <p className="font-medium text-tf-text">Something went wrong</p>
        <p className="mt-1.5 max-w-md text-sm text-tf-muted">{errorMessage(error)}</p>
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
    <div className="flex items-start gap-2.5 rounded-xl border border-tf-danger-soft bg-tf-danger-soft px-3.5 py-3 text-sm text-tf-danger">
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
