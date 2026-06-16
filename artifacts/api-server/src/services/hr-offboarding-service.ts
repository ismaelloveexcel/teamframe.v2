import { and, eq } from "drizzle-orm";
import { db, hrOffboardingTable, type HrOffboarding } from "@workspace/db";
import { mutateWithAudit } from "./hr-audit.js";

const rec = (v: unknown) => v as unknown as Record<string, unknown>;

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

export type CreateOffboardingInput = {
  employeeId: string;
  exitDate: string;
  reason?: string | null;
  eosg: EosgInputs; // basic pay + join/exit dates; gratuity computed + frozen
};

/**
 * Create a FROZEN offboarding exit record. The EOSG is computed at write time
 * from the supplied inputs and the inputs + computed value are stored on the
 * record so it does not change if pay data later moves.
 */
export async function createOffboarding(
  companyId: string,
  actorId: string,
  input: CreateOffboardingInput,
): Promise<HrOffboarding & { eosg: EosgResult }> {
  const eosg = computeEosg({ ...input.eosg, exitDate: input.eosg.exitDate ?? input.exitDate });
  return mutateWithAudit(async (tx) => {
    const [row] = await tx
      .insert(hrOffboardingTable)
      .values({
        companyId,
        employeeId: input.employeeId,
        exitDate: input.exitDate,
        reason: input.reason ?? null,
        eosgInputs: { ...eosg },
        gratuityAmount: eosg.gratuityAmount,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();
    return {
      result: { ...row, eosg },
      audit: { companyId, entityType: "offboarding", entityId: row.id, action: "create" as const, after: rec(row), actorId },
    };
  });
}

export function listOffboarding(companyId: string): Promise<HrOffboarding[]> {
  return db.select().from(hrOffboardingTable).where(eq(hrOffboardingTable.companyId, companyId));
}

export async function getOffboarding(companyId: string, id: string): Promise<HrOffboarding | null> {
  const [row] = await db
    .select()
    .from(hrOffboardingTable)
    .where(and(eq(hrOffboardingTable.id, id), eq(hrOffboardingTable.companyId, companyId)));
  return row ?? null;
}
