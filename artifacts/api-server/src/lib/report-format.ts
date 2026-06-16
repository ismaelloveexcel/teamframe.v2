/**
 * Pure formatting helpers for rendered reports. No I/O, no DB, no Date.now() —
 * deterministic by construction so identical frozen content renders identical
 * bytes. Money is stored as integer MINOR UNITS (e.g. fils for AED); these
 * helpers convert to a currency-aware human display.
 */

// Minor-unit exponents per ISO 4217 currency. Default is 2 (the common case).
const CURRENCY_MINOR_DIGITS: Record<string, number> = {
  AED: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  SAR: 2,
  QAR: 2,
  KWD: 3,
  BHD: 3,
  OMR: 3,
  JPY: 0,
  // zero-decimal currencies
};

export function minorDigitsFor(currency: string | null | undefined): number {
  if (!currency) return 2;
  const code = currency.toUpperCase();
  return CURRENCY_MINOR_DIGITS[code] ?? 2;
}

/**
 * Convert integer minor units into a grouped decimal string (no currency code),
 * e.g. 1_200_000 (AED) -> "12,000.00", 1_234_567 (KWD) -> "1,234.567".
 * Handles negatives and rounds defensively if a non-integer slips in.
 */
export function formatMinorUnits(amount: number, currency: string | null | undefined): string {
  const digits = minorDigitsFor(currency);
  const divisor = 10 ** digits;
  const rounded = Math.round(amount);
  const negative = rounded < 0;
  const abs = Math.abs(rounded);

  const whole = Math.trunc(abs / divisor);
  const frac = abs % divisor;

  // Group the integer part with thousands separators.
  const groupedWhole = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  const sign = negative ? "-" : "";
  if (digits === 0) return `${sign}${groupedWhole}`;
  const fracStr = String(frac).padStart(digits, "0");
  return `${sign}${groupedWhole}.${fracStr}`;
}

/**
 * Currency-prefixed money display, e.g. "AED 12,000.00". Falls back gracefully
 * when currency is unknown (just the formatted number).
 */
export function formatMoney(amount: number, currency: string | null | undefined): string {
  const value = formatMinorUnits(amount, currency);
  return currency ? `${currency.toUpperCase()} ${value}` : value;
}

/**
 * Format an ISO date/timestamp into a fixed, locale-independent display:
 *   "2024-06-30" -> "30 Jun 2024".
 * Deterministic: parses the calendar parts directly (UTC), never uses the host
 * timezone or Intl locale defaults. Returns the input unchanged if unparseable.
 */
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  const [, y, mo, d] = m;
  const monthIdx = Number(mo) - 1;
  if (monthIdx < 0 || monthIdx > 11) return value;
  return `${Number(d)} ${MONTHS[monthIdx]} ${y}`;
}

/**
 * Format an ISO timestamp into "30 Jun 2024, 14:05 UTC" — fixed UTC, no host
 * timezone. Used for the "generated at" line.
 */
export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return formatDate(value);
  const [, y, mo, d, hh, mm] = m;
  const monthIdx = Number(mo) - 1;
  if (monthIdx < 0 || monthIdx > 11) return value;
  return `${Number(d)} ${MONTHS[monthIdx]} ${y}, ${hh}:${mm} UTC`;
}

/**
 * Tenure between two ISO dates as "3 years, 5 months" (deterministic, UTC).
 * Returns "—" if either bound is missing/unparseable.
 */
export function formatTenure(joinDate: string | null | undefined, exitDate: string | null | undefined): string {
  const j = parseYmd(joinDate);
  const e = parseYmd(exitDate);
  if (!j || !e) return "—";
  let years = e.y - j.y;
  let months = e.mo - j.mo;
  if (e.d < j.d) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return "—";
  const yPart = `${years} ${years === 1 ? "year" : "years"}`;
  const mPart = `${months} ${months === 1 ? "month" : "months"}`;
  return `${yPart}, ${mPart}`;
}

function parseYmd(value: string | null | undefined): { y: number; mo: number; d: number } | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) };
}

/** HTML-escape untrusted text so frozen content can't break the document. */
export function esc(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Human label for a component key: "airTicket" -> "Air Ticket". */
export function humanizeComponent(key: string): string {
  const known: Record<string, string> = {
    basic: "Basic",
    housing: "Housing",
    transport: "Transport",
    airTicket: "Air Ticket",
    allowances: "Allowances",
  };
  if (known[key]) return known[key];
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
