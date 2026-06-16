import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Skeleton } from "./states";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-64 space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

/** Guard a route to admins; employees are redirected to the dashboard. */
export function AdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin, status } = useAuth();
  if (status === "authenticated" && !isAdmin) {
    return <Navigate to="/" replace />;
  }
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
