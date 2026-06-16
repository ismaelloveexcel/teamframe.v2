// Phase 1 (Jurisdiction Packs) — UAE compliance provider.
//
// Holds the EXACT, unchanged UAE end-of-service gratuity (EOSG) formula that
// previously lived in hr-offboarding-service.ts. Moving it here removes the
// UAE legal assumption from the GLOBAL CORE without changing any number.

import { and, eq, isNull, or } from "drizzle-orm";
import { db, leaveTypesTable } from "@workspace/db";
import type {
  ComplianceProvider,
  LeaveType,
  OffboardingInputs,
  OffboardingResult,
} from "../provider.js";

export type EosgInputs = {
  basicMonthlyPay: number; // minor units (e.g. fils)
  joinDate: string; // ISO date
  exitDate: string; // ISO date
};

export type EosgResult = {
  basicMonthlyPay: number;
  joinDate: string;
  exitDate: string;
  yearsOfService: number;
  dailyWage: number;
  gratuityAmount: number; // minor units, rounded
  capApplied: boolean;
};

/**
 * UAE end-of-service gratuity (unlimited contract, full entitlement):
 *  - 21 days of basic pay for each of the first 5 years of service;
 *  - 30 days of basic pay for each additional year beyond 5;
 *  - pro-rated for partial years;
 *  - total capped at 2 years' total pay (24 months of basic).
 * Daily wage = (basicMonthlyPay * 12) / 365.
 *
 * NOTE: byte-for-byte identical to the pre-Phase-1 computeEosg.
 */
export function computeEosg(inputs: EosgInputs): EosgResult {
  const join = new Date(inputs.joinDate);
  const exit = new Date(inputs.exitDate);
  const msPerYear = 365 * 24 * 60 * 60 * 1000;
  const yearsOfService = Math.max(0, (exit.getTime() - join.getTime()) / msPerYear);

  const dailyWage = (inputs.basicMonthlyPay * 12) / 365;

  const firstYears = Math.min(yearsOfService, 5);
  const beyondYears = Math.max(0, yearsOfService - 5);
  const gratuityDays = firstYears * 21 + beyondYears * 30;

  let gratuity = gratuityDays * dailyWage;

  // Cap at 2 years' total pay = 24 months of basic.
  const cap = inputs.basicMonthlyPay * 24;
  const capApplied = gratuity > cap;
  if (capApplied) gratuity = cap;

  return {
    basicMonthlyPay: inputs.basicMonthlyPay,
    joinDate: inputs.joinDate,
    exitDate: inputs.exitDate,
    yearsOfService,
    dailyWage,
    gratuityAmount: Math.round(gratuity),
    capApplied,
  };
}

export const UAE_JURISDICTION = "UAE";

export class UaeComplianceProvider implements ComplianceProvider {
  readonly jurisdiction = UAE_JURISDICTION;

  async getLeaveTypes(companyId?: string | null): Promise<LeaveType[]> {
    return readLeaveTypes(UAE_JURISDICTION, companyId ?? null);
  }

  calculateOffboarding(inputs: OffboardingInputs): OffboardingResult {
    const eosg = computeEosg({
      basicMonthlyPay: Number(inputs.basicMonthlyPay),
      joinDate: String(inputs.joinDate),
      exitDate: String(inputs.exitDate),
    });
    // Pass the full EOSG result through so existing UAE consumers (preview
    // response, frozen eosgInputs) keep their exact shape + numbers.
    return { ...eosg, gratuityAmount: eosg.gratuityAmount, calculationMethod: "uae_eosg" };
  }
}

/**
 * Read the leave-type catalogue for a jurisdiction: global defaults
 * (company_id IS NULL) UNION active company-specific overrides. Company
 * overrides win on code collision. Returns codes in a stable order.
 */
export async function readLeaveTypes(
  jurisdiction: string,
  companyId: string | null,
): Promise<LeaveType[]> {
  const rows = await db
    .select()
    .from(leaveTypesTable)
    .where(
      or(
        and(isNull(leaveTypesTable.companyId), eq(leaveTypesTable.jurisdiction, jurisdiction)),
        companyId ? eq(leaveTypesTable.companyId, companyId) : undefined,
      ),
    );

  const byCode = new Map<string, LeaveType>();
  // Defaults first, then overrides replace by code.
  for (const r of rows.filter((r) => r.companyId === null)) {
    if (r.active) byCode.set(r.code, { code: r.code, name: r.name });
  }
  for (const r of rows.filter((r) => r.companyId !== null)) {
    if (r.active) byCode.set(r.code, { code: r.code, name: r.name });
    else byCode.delete(r.code); // an inactive override removes the default
  }
  return [...byCode.values()];
}
