import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format integer minor units (e.g. fils/cents) as a currency-ish string. */
export function formatMinorUnits(
  amount: number | null | undefined,
  currency?: string | null,
): string {
  if (amount == null) return "—";
  const major = amount / 100;
  const formatted = major.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${currency} ${formatted}` : formatted;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function fullName(p: {
  firstName?: string | null;
  lastName?: string | null;
}): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || "—";
}

/** Today's date as YYYY-MM-DD for date inputs. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
