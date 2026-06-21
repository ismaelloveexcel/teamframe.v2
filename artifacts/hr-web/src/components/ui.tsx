import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "../lib/utils";

// ── Button ──────────────────────────────────────────────────────────────────
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    const variants: Record<string, string> = {
      primary:
        "bg-accent text-slate-900 hover:bg-accent-dark focus-visible:ring-accent disabled:bg-slate-200 disabled:text-slate-400",
      secondary:
        "bg-white text-tf-text border border-tf-border hover:bg-tf-panel disabled:opacity-50",
      danger: "bg-tf-danger text-white hover:bg-red-700 disabled:opacity-50",
      ghost: "text-tf-muted hover:bg-tf-panel hover:text-tf-text disabled:opacity-50",
    };
    const sizes: Record<string, string> = {
      sm: "px-2.5 py-1.5 text-xs",
      md: "px-3.5 py-2 text-sm",
    };
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed",
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

// ── Inputs ──────────────────────────────────────────────────────────────────
const fieldBase =
  "w-full rounded-md border border-tf-border bg-white px-3 py-2 text-sm text-tf-text placeholder:text-tf-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-tf-panel disabled:text-tf-muted transition-colors";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(fieldBase, className)} {...props} />
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldBase, "min-h-24", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(fieldBase, className)} {...props} />
));
Select.displayName = "Select";

export function Field({
  label,
  htmlFor,
  required,
  children,
  hint,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="block space-y-1.5">
      <span className="text-sm font-medium text-tf-text">
        {label}
        {required && <span className="ml-0.5 text-tf-danger"> *</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-tf-subtle">{hint}</span>}
    </label>
  );
}

// ── Card ────────────────────────────────────────────────────────────────────
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-tf-border bg-white shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  action,
  description,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-tf-border-soft px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold text-tf-text">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-tf-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

// ── Badge ───────────────────────────────────────────────────────────────────
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "amber" | "red" | "blue" | "accent";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-tf-panel text-tf-muted",
    green:   "bg-tf-success-soft text-tf-success",
    amber:   "bg-tf-warning-soft text-tf-warning",
    red:     "bg-tf-danger-soft text-tf-danger",
    blue:    "bg-blue-50 text-blue-600",
    accent:  "bg-accent-soft text-accent-strong",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function statusTone(
  status: string,
): "neutral" | "green" | "amber" | "red" | "blue" {
  const s = status.toLowerCase();
  if (["active", "approved", "completed"].includes(s)) return "green";
  if (["pending", "invited", "requested", "draft"].includes(s)) return "amber";
  if (["rejected", "inactive", "terminated", "cancelled"].includes(s)) return "red";
  return "neutral";
}
