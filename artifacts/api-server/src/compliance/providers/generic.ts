// Phase 1 (Jurisdiction Packs) — Generic compliance provider.
//
// The SAFE default for every jurisdiction that is not the UAE. It makes NO
// legal assumptions: offboarding returns a null gratuity with a "manual"
// method (never 0 — 0 would imply a legal calc happened). Leave types come
// from the GENERIC jurisdiction defaults (+ any company overrides).

import type {
  ComplianceProvider,
  LeaveType,
  OffboardingInputs,
  OffboardingResult,
} from "../provider.js";
import { readLeaveTypes } from "./uae.js";

export const GENERIC_JURISDICTION = "GENERIC";

export class GenericComplianceProvider implements ComplianceProvider {
  readonly jurisdiction = GENERIC_JURISDICTION;

  async getLeaveTypes(companyId?: string | null): Promise<LeaveType[]> {
    return readLeaveTypes(GENERIC_JURISDICTION, companyId ?? null);
  }

  calculateOffboarding(_inputs: OffboardingInputs): OffboardingResult {
    // No statutory calculation. Null (NOT 0) signals "compute manually".
    return { gratuityAmount: null, calculationMethod: "manual" };
  }
}
