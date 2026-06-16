import type { HrReport } from "@workspace/db";
import type { ExitReportContent, FinanceReportContent } from "./hr-report-service.js";
import {
  esc,
  formatDate,
  formatMoney,
  formatTenure,
  formatTimestamp,
  humanizeComponent,
} from "../lib/report-format.js";

/**
 * PURE VIEW over a FROZEN hr_report row. Given the stored row (whose `content`
 * jsonb was serialized at generation time), produce a self-contained,
 * print-optimized HTML document. This NEVER queries live source tables and
 * NEVER mutates anything — same input row => byte-identical output. Editing a
 * source employee/compensation row after generation does not change this output
 * because the output is derived solely from the frozen `content`.
 *
 * Design: a premium letterhead document. Serif display headline, restrained
 * navy/ink palette, A4 print geometry via @page, all CSS inlined in a <style>
 * block — no external fonts or assets, so it renders identically offline and
 * prints cleanly to PDF from the browser. A "FROZEN AS OF" stamp makes the
 * point-in-time nature explicit on the page itself.
 */

const STYLE = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  @page { size: A4; margin: 18mm 16mm; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #1a2238;
    background: #f3f4f7;
    font-size: 13px;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet {
    max-width: 820px;
    margin: 24px auto;
    background: #ffffff;
    padding: 44px 52px 56px;
    box-shadow: 0 1px 3px rgba(26,34,56,0.12), 0 10px 40px rgba(26,34,56,0.08);
  }
  .letterhead {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #1a2238;
    padding-bottom: 18px;
  }
  .company { display: flex; align-items: center; gap: 14px; }
  .crest {
    width: 46px; height: 46px; border-radius: 9px;
    background: linear-gradient(135deg, #1a2238 0%, #2f3e6e 100%);
    color: #fff; font-weight: 700; font-size: 20px;
    display: flex; align-items: center; justify-content: center;
    font-family: Georgia, "Times New Roman", serif;
    letter-spacing: 0.5px;
  }
  .company-name { font-size: 19px; font-weight: 700; letter-spacing: 0.2px; }
  .company-sub { font-size: 11px; color: #6b7390; text-transform: uppercase; letter-spacing: 1.5px; }
  .doc-meta { text-align: right; font-size: 11px; color: #6b7390; }
  .doc-meta strong { color: #1a2238; }
  .title-block { margin: 30px 0 6px; }
  .doc-kicker { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #2f3e6e; font-weight: 600; }
  .doc-title { font-family: Georgia, "Times New Roman", serif; font-size: 30px; font-weight: 700; margin: 4px 0 0; }
  .frozen-stamp {
    display: inline-block; margin-top: 14px;
    border: 1.5px solid #b04632; color: #b04632;
    border-radius: 6px; padding: 7px 14px;
    font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 700;
    transform: rotate(-1deg);
  }
  .frozen-stamp small { display: block; font-weight: 400; letter-spacing: 0.4px; text-transform: none; color: #8a3a2b; }
  .summary { display: flex; gap: 14px; margin: 28px 0 12px; flex-wrap: wrap; }
  .stat { flex: 1 1 160px; background: #f7f8fb; border: 1px solid #e6e8f0; border-radius: 9px; padding: 14px 16px; }
  .stat .label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 1.2px; color: #6b7390; }
  .stat .value { font-size: 20px; font-weight: 700; margin-top: 4px; font-family: Georgia, serif; }
  table { width: 100%; border-collapse: collapse; margin-top: 22px; }
  thead th {
    text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: 1px;
    color: #6b7390; border-bottom: 2px solid #1a2238; padding: 9px 10px; font-weight: 600;
  }
  tbody td { padding: 9px 10px; border-bottom: 1px solid #ecedf3; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #fafbfd; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tfoot td { padding: 11px 10px; border-top: 2px solid #1a2238; font-weight: 700; }
  .emp-name { font-weight: 600; }
  .emp-no { color: #6b7390; font-size: 11px; }
  .components { color: #6b7390; font-size: 11px; margin-top: 2px; }
  .section-h { font-family: Georgia, serif; font-size: 16px; margin: 30px 0 6px; border-bottom: 1px solid #e6e8f0; padding-bottom: 6px; }
  .kv { display: grid; grid-template-columns: 200px 1fr; gap: 6px 18px; margin-top: 12px; }
  .kv dt { color: #6b7390; font-size: 12px; }
  .kv dd { margin: 0; font-weight: 600; }
  .eosg-box {
    margin-top: 26px; background: #f7f8fb; border: 1px solid #e6e8f0; border-left: 4px solid #2f3e6e;
    border-radius: 8px; padding: 18px 22px;
  }
  .eosg-box .label { font-size: 11px; text-transform: uppercase; letter-spacing: 1.4px; color: #6b7390; }
  .eosg-box .amount { font-family: Georgia, serif; font-size: 30px; font-weight: 700; margin-top: 4px; }
  .eosg-note { font-size: 11px; color: #6b7390; margin-top: 8px; }
  .signatures { display: flex; gap: 60px; margin-top: 56px; }
  .sig { flex: 1; }
  .sig .line { border-top: 1px solid #1a2238; padding-top: 6px; font-size: 11px; color: #6b7390; text-transform: uppercase; letter-spacing: 1px; }
  .footer { margin-top: 40px; padding-top: 14px; border-top: 1px solid #ecedf3; font-size: 10.5px; color: #9aa0b8; text-align: center; }
  @media print { body { background: #fff; } .sheet { box-shadow: none; margin: 0; max-width: none; padding: 0; } }
`;

function shell(title: string, body: string): string {
  // Compact, deterministic whitespace so byte-output is stable.
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${STYLE}</style>
</head>
<body>
<main class="sheet">
${body}
</main>
</body>
</html>`;
}

function companyDisplay(content: { companyName?: string | null; companyId: string; currency?: string | null }): {
  name: string;
  crest: string;
} {
  const name = content.companyName?.trim() || "Company";
  const crest = name.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "CO";
  return { name, crest };
}

function letterhead(name: string, crest: string, jurisdiction: string | null, generatedAt: string): string {
  return `<header class="letterhead">
  <div class="company">
    <div class="crest">${esc(crest)}</div>
    <div>
      <div class="company-name">${esc(name)}</div>
      <div class="company-sub">${esc(jurisdiction || "Human Resources")}</div>
    </div>
  </div>
  <div class="doc-meta">
    Generated<br><strong>${esc(generatedAt)}</strong>
  </div>
</header>`;
}

// ── Finance / payroll handoff ────────────────────────────────────────────────

function renderFinance(content: FinanceReportContent & { companyName?: string | null; jurisdiction?: string | null }): string {
  const { name, crest } = companyDisplay(content);
  const generatedAt = formatTimestamp(content.generatedAt);
  const cutoff = formatDate(content.periodCutoff);

  const sortedLines = [...content.lines].sort((a, b) => a.employeeNo.localeCompare(b.employeeNo));

  const rows = sortedLines
    .map((l) => {
      const comps = l.components
        ? Object.entries(l.components)
            .map(([k, v]) => `${humanizeComponent(k)} ${formatMoney(v, l.currency)}`)
            .join(" · ")
        : "";
      return `<tr>
  <td>
    <div class="emp-name">${esc(l.name)}</div>
    <div class="emp-no">${esc(l.employeeNo)}</div>
    ${comps ? `<div class="components">${esc(comps)}</div>` : ""}
  </td>
  <td class="num">${esc(l.unpaidLeaveDays)}</td>
  <td class="num">${esc(formatMoney(l.amount, l.currency))}</td>
</tr>`;
    })
    .join("\n");

  // Display currency for totals: the first line's currency, else none.
  const totalsCurrency = sortedLines[0]?.currency ?? null;

  const body = `${letterhead(name, crest, content.jurisdiction ?? null, generatedAt)}
<div class="title-block">
  <div class="doc-kicker">Payroll Handoff</div>
  <h1 class="doc-title">Finance Statement</h1>
  <div class="frozen-stamp">Frozen as of ${esc(cutoff)}<small>Point-in-time snapshot — source changes after this date are not reflected</small></div>
</div>
<section class="summary">
  <div class="stat"><div class="label">Period Cutoff</div><div class="value">${esc(cutoff)}</div></div>
  <div class="stat"><div class="label">Employees</div><div class="value">${esc(content.totals.employees)}</div></div>
  <div class="stat"><div class="label">Unpaid Leave (days)</div><div class="value">${esc(content.totals.totalUnpaidLeaveDays)}</div></div>
  <div class="stat"><div class="label">Gross Payroll</div><div class="value">${esc(formatMoney(content.totals.grossAmount, totalsCurrency))}</div></div>
</section>
<table>
  <thead>
    <tr>
      <th>Employee</th>
      <th class="num">Unpaid Leave (days)</th>
      <th class="num">Gross Compensation</th>
    </tr>
  </thead>
  <tbody>
${rows || `<tr><td colspan="3" style="color:#9aa0b8">No employees in this period.</td></tr>`}
  </tbody>
  <tfoot>
    <tr>
      <td>Total — ${esc(content.totals.employees)} employee(s)</td>
      <td class="num">${esc(content.totals.totalUnpaidLeaveDays)}</td>
      <td class="num">${esc(formatMoney(content.totals.grossAmount, totalsCurrency))}</td>
    </tr>
  </tfoot>
</table>
<div class="footer">
  This statement is a frozen point-in-time payroll handoff. Amounts shown are gross monthly compensation in minor-unit-accurate display. Generated ${esc(generatedAt)}.
</div>`;

  return shell(`Finance Statement — ${name}`, body);
}

// ── Exit report ──────────────────────────────────────────────────────────────

function str(rec: Record<string, unknown> | null | undefined, key: string): string | null {
  if (!rec) return null;
  const v = rec[key];
  return v === null || v === undefined ? null : String(v);
}

function num(rec: Record<string, unknown> | null | undefined, key: string): number | null {
  if (!rec) return null;
  const v = rec[key];
  return typeof v === "number" ? v : null;
}

function renderExit(content: ExitReportContent & { companyName?: string | null; jurisdiction?: string | null }): string {
  const { name, crest } = companyDisplay(content);
  const generatedAt = formatTimestamp(content.generatedAt);

  const emp = content.employee ?? {};
  const off = content.offboarding;

  const firstName = str(emp, "firstName") ?? "";
  const lastName = str(emp, "lastName") ?? "";
  const fullName = `${firstName} ${lastName}`.trim() || "Employee";
  const employeeNo = str(emp, "employeeNo") ?? "—";
  const joinDate = str(emp, "joinDate");
  const exitDate = content.exitDate ?? str(emp, "dateOfExit");
  const nationality = str(emp, "nationality");
  const companyEmail = str(emp, "companyEmail") ?? str(emp, "personalEmail");

  const reason = str(off, "reason");
  // gratuity stored both as top-level gratuityAmount and inside eosgInputs.
  const gratuity = num(off, "gratuityAmount");
  const eosgInputs = (off?.eosgInputs ?? null) as Record<string, unknown> | null;
  const basicMonthlyPay = num(eosgInputs, "basicMonthlyPay");
  const capApplied = eosgInputs ? eosgInputs.capApplied === true : false;

  // Currency from the frozen compensation snapshot (first record).
  const firstComp = (content.compensation && content.compensation[0]) as Record<string, unknown> | undefined;
  const currency = (firstComp ? str(firstComp, "currency") : null) ?? "AED";

  const body = `${letterhead(name, crest, content.jurisdiction ?? null, generatedAt)}
<div class="title-block">
  <div class="doc-kicker">End of Service</div>
  <h1 class="doc-title">Certificate of Service & Final Settlement</h1>
  <div class="frozen-stamp">Frozen as of ${esc(formatDate(exitDate))}<small>Point-in-time snapshot — figures reflect the record at exit date</small></div>
</div>

<h2 class="section-h">Employee</h2>
<dl class="kv">
  <dt>Full name</dt><dd>${esc(fullName)}</dd>
  <dt>Employee number</dt><dd>${esc(employeeNo)}</dd>
  ${nationality ? `<dt>Nationality</dt><dd>${esc(nationality)}</dd>` : ""}
  ${companyEmail ? `<dt>Email</dt><dd>${esc(companyEmail)}</dd>` : ""}
</dl>

<h2 class="section-h">Service</h2>
<dl class="kv">
  <dt>Join date</dt><dd>${esc(formatDate(joinDate))}</dd>
  <dt>Exit date</dt><dd>${esc(formatDate(exitDate))}</dd>
  <dt>Tenure</dt><dd>${esc(formatTenure(joinDate, exitDate))}</dd>
  <dt>Reason for exit</dt><dd>${esc(reason ? humanizeComponent(reason) : "—")}</dd>
  ${basicMonthlyPay !== null ? `<dt>Basic monthly pay</dt><dd>${esc(formatMoney(basicMonthlyPay, currency))}</dd>` : ""}
</dl>

<div class="eosg-box">
  <div class="label">End-of-Service Gratuity (EOSG)</div>
  <div class="amount">${esc(gratuity !== null ? formatMoney(gratuity, currency) : "—")}</div>
  <div class="eosg-note">Computed per UAE Labour Law: 21 days' basic pay per year for the first five years, 30 days thereafter, pro-rated for partial years${capApplied ? ", capped at two years' total pay (cap applied)" : ""}. This value was frozen at generation and does not change with later edits.</div>
</div>

<div class="signatures">
  <div class="sig"><div class="line">Employee signature & date</div></div>
  <div class="sig"><div class="line">Authorised signatory (${esc(name)})</div></div>
</div>

<div class="footer">
  This is a frozen end-of-service document for ${esc(fullName)} (${esc(employeeNo)}). Generated ${esc(generatedAt)}.
</div>`;

  return shell(`End of Service — ${fullName}`, body);
}

// ── Entry point ──────────────────────────────────────────────────────────────

/**
 * Render a stored hr_report row to a self-contained HTML document.
 * `companyName` / `jurisdiction` are optional letterhead enrichments resolved
 * by the caller from the company row (presentation only — not part of the
 * frozen financial content, so they don't affect frozen values/determinism of
 * the figures). When omitted, sensible defaults are used.
 */
export function renderReportHtml(
  row: Pick<HrReport, "kind" | "content">,
  opts?: { companyName?: string | null; jurisdiction?: string | null },
): string {
  const content = row.content as Record<string, unknown>;
  const enriched = {
    ...content,
    companyName: opts?.companyName ?? null,
    jurisdiction: opts?.jurisdiction ?? null,
  };
  if (row.kind === "finance") {
    return renderFinance(enriched as unknown as FinanceReportContent & { companyName?: string | null; jurisdiction?: string | null });
  }
  if (row.kind === "exit") {
    return renderExit(enriched as unknown as ExitReportContent & { companyName?: string | null; jurisdiction?: string | null });
  }
  throw new Error(`Unsupported report kind: ${String(row.kind)}`);
}
