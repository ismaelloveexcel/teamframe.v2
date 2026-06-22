import type { ReactNode } from "react";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-tf-bg p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent shadow-md shadow-black/10">
            <span className="text-sm font-bold text-slate-900 tracking-tight">TF</span>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-tf-text tracking-tight">TeamFrame</p>
            <p className="text-xs text-tf-subtle">People-Ops Control Platform</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-tf-border bg-white p-7 shadow-sm">
          <div className="mb-6">
            <h1 className="text-lg font-semibold text-tf-text">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-sm text-tf-muted">{subtitle}</p>
            )}
          </div>
          {children}
        </div>

        {footer && (
          <div className="mt-5 text-center text-sm text-tf-muted">{footer}</div>
        )}
      </div>
    </div>
  );
}
