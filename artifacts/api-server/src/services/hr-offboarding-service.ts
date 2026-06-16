import { and, eq } from "drizzle-orm";
import { db, hrOffboardingTable, type HrOffboarding } from "@workspace/db";
import { mutateWithAudit } from "./hr-audit.js";
import { resolveProviderForCompany } from "../compliance/index.js";
import type { OffboardingResult } from "../compliance/provider.js";
// The UAE EOSG formula now lives in the UAE compliance provider. Re-exported
// here so existing importers (routes, gates) keep their import paths.
import { computeEosg, type EosgInputs, type EosgResult } from "../compliance/providers/uae.js";

export { computeEosg };
export type { EosgInputs, EosgResult };

const rec = (v: unknown) => v as unknown as Record<string, unknown>;

export type CreateOffboardingInput = {
  employeeId: string;
  exitDate: string;
  reason?: string | null;
  eosg: EosgInputs; // basic pay + join/exit dates; gratuity computed + frozen
};

/**
 * Preview the gratuity for a company WITHOUT persisting. Routes through the
 * company's compliance provider: UAE returns the full EOSG result (+ method);
 * generic returns { gratuityAmount: null, calculationMethod: "manual" }.
 */
export async function previewOffboarding(
  companyId: string,
  eosg: EosgInputs,
): Promise<OffboardingResult> {
  const provider = await resolveProviderForCompany(companyId);
  return provider.calculateOffboarding({ ...eosg });
}

/**
 * Create a FROZEN offboarding exit record. The gratuity is computed at write
 * time by the company's COMPLIANCE PROVIDER (UAE -> EOSG; everything else ->
 * generic/manual with a null gratuity). The provider result + inputs are stored
 * on the record so it does not change if pay data later moves.
 *
 * Historical safety: for a UAE company the stored eosgInputs + gratuityAmount
 * are byte-for-byte identical to the pre-provider behaviour.
 */
export async function createOffboarding(
  companyId: string,
  actorId: string,
  input: CreateOffboardingInput,
): Promise<HrOffboarding & { eosg?: EosgResult }> {
  const provider = await resolveProviderForCompany(companyId);
  const calc = provider.calculateOffboarding({
    ...input.eosg,
    exitDate: input.eosg.exitDate ?? input.exitDate,
  });

  // UAE provider passes the full EOSG result through; eosgInputs stays frozen
  // exactly as before. Generic provider returns no gratuity -> eosgInputs holds
  // the raw inputs supplied, gratuity stays NULL.
  const isEosg = calc.calculationMethod === "uae_eosg";
  const eosgFrozen: Record<string, unknown> = isEosg
    ? { ...calc }
    : { ...input.eosg, exitDate: input.eosg.exitDate ?? input.exitDate };
  // Drop the bookkeeping field so a UAE eosgInputs blob is byte-identical to
  // the legacy EosgResult shape (no calculationMethod key).
  delete eosgFrozen.calculationMethod;

  return mutateWithAudit(async (tx) => {
    const [row] = await tx
      .insert(hrOffboardingTable)
      .values({
        companyId,
        employeeId: input.employeeId,
        exitDate: input.exitDate,
        reason: input.reason ?? null,
        eosgInputs: eosgFrozen,
        gratuityAmount: calc.gratuityAmount,
        calculationMethod: calc.calculationMethod,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();
    const result: HrOffboarding & { eosg?: EosgResult } = isEosg
      ? { ...row, eosg: calc as unknown as EosgResult }
      : { ...row };
    return {
      result,
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
