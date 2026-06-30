/**
 * V1.5 weekly admin digest — GENERATOR ONLY.
 *
 * This is the one scoped admin digest allowed by the anti-drift constraints. It
 * is NOT a reminders engine: no per-signal rules, no user-configurable
 * preferences, no scheduling logic, no multi-channel delivery, no per-employee
 * nudges. It is a pure function that turns a list of already-computed open
 * red/yellow signals into a digest payload. It does not fetch data and it does
 * not send email (the repo has no email provider — see the runbook
 * docs/hr/WEEKLY_DIGEST.md for how an operator/cron wires sourcing + delivery).
 *
 * Keeping this a pure function makes it deterministic and unit-testable, and
 * keeps the "is this a reminders platform?" answer firmly "no".
 */

export type DigestSeverity = "red" | "yellow";

export type DigestSignal = {
  /** Short human label, e.g. an action/risk title. */
  title: string;
  /** red = urgent, yellow = important. Anything else is not a digest signal. */
  severity: DigestSeverity;
  /** Optional ISO date (YYYY-MM-DD) used only for ordering most-overdue first. */
  dueDate?: string | null;
};

export type WeeklyDigestInput = {
  tenantName: string;
  /** Absolute URL to the tenant's dashboard. */
  dashboardUrl: string;
  /** Open red/yellow signals. Resolved/done items must be filtered out upstream. */
  signals: DigestSignal[];
  /** Override "now" for deterministic tests; defaults to new Date(). */
  now?: Date;
};

export type WeeklyDigest = {
  subject: string;
  redCount: number;
  yellowCount: number;
  /** Up to 5 signals, red first, then most-overdue first. */
  top: DigestSignal[];
  /** Plain-text body (the canonical rendering; no email is sent here). */
  text: string;
};

const FOOTER = "TeamFrame is not legal advice.";

function severityRank(s: DigestSeverity): number {
  return s === "red" ? 0 : 1;
}

/** Sort: red before yellow, then most-overdue (earliest dueDate) first, then title. */
function orderSignals(signals: DigestSignal[]): DigestSignal[] {
  return [...signals].sort((a, b) => {
    const bySev = severityRank(a.severity) - severityRank(b.severity);
    if (bySev !== 0) return bySev;
    const ad = a.dueDate ? Date.parse(a.dueDate) : Number.POSITIVE_INFINITY;
    const bd = b.dueDate ? Date.parse(b.dueDate) : Number.POSITIVE_INFINITY;
    if (ad !== bd) return ad - bd;
    return a.title.localeCompare(b.title);
  });
}

/**
 * Build the weekly digest payload for a single tenant.
 *
 * Content (per spec): tenant name, count of urgent/red signals, count of
 * important/yellow signals, top 5 open signals, link to dashboard, and the
 * "not legal advice" footer.
 */
export function buildWeeklyDigest(input: WeeklyDigestInput): WeeklyDigest {
  const open = input.signals.filter(
    (s) => s.severity === "red" || s.severity === "yellow",
  );
  const ordered = orderSignals(open);
  const redCount = open.filter((s) => s.severity === "red").length;
  const yellowCount = open.filter((s) => s.severity === "yellow").length;
  const top = ordered.slice(0, 5);

  const subject = `TeamFrame weekly risk summary — ${input.tenantName} (${redCount} red, ${yellowCount} yellow)`;

  const lines: string[] = [];
  lines.push(`Weekly risk summary for ${input.tenantName}`);
  lines.push("");
  lines.push(`Urgent (red):    ${redCount}`);
  lines.push(`Important (yellow): ${yellowCount}`);
  lines.push("");
  if (top.length > 0) {
    lines.push(`Top ${top.length} open signal${top.length === 1 ? "" : "s"}:`);
    for (const s of top) {
      const tag = s.severity === "red" ? "[RED]   " : "[YELLOW]";
      const due = s.dueDate ? ` (due ${s.dueDate})` : "";
      lines.push(`  ${tag} ${s.title}${due}`);
    }
  } else {
    lines.push("No open red or yellow signals this week.");
  }
  lines.push("");
  lines.push(`Open the dashboard: ${input.dashboardUrl}`);
  lines.push("");
  lines.push(FOOTER);

  return { subject, redCount, yellowCount, top, text: lines.join("\n") };
}
