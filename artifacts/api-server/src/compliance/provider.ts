// Phase 1 (Jurisdiction Packs) — ComplianceProvider interface.
//
// A compliance provider supplies the jurisdiction-specific pieces the GLOBAL
// CORE must NOT hard-code: the leave-type catalogue and end-of-service /
// gratuity calculation. Scope is LOCKED to these two operations — no DI
// container, no plugin system, no statutory engines beyond UAE EOSG.

/** A single leave type offered by a jurisdiction (code + friendly name). */
export type LeaveType = {
  code: string;
  name: string;
};

/** Inputs for an offboarding gratuity calculation. Shape mirrors the existing
 *  EOSG inputs; providers may ignore fields they don't use. */
export type OffboardingInputs = {
  basicMonthlyPay?: number; // minor units
  joinDate?: string; // ISO date
  exitDate?: string; // ISO date
  [key: string]: unknown;
};

/** Result of an offboarding calculation. gratuityAmount is null when no
 *  statutory calculation applies (manual / generic) — NEVER 0, since 0 would
 *  imply a legal calc returned zero. calculationMethod names the method used.
 *  Provider-specific fields (yearsOfService, dailyWage, capApplied, …) pass
 *  through so existing UAE consumers see identical output. */
export type OffboardingResult = {
  gratuityAmount: number | null;
  calculationMethod: string;
  [key: string]: unknown;
};

export interface ComplianceProvider {
  /** The jurisdiction key this provider serves (e.g. "UAE", "GENERIC"). */
  readonly jurisdiction: string;
  /** Statutory + default leave types for the jurisdiction. Implementations read
   *  the leave_types catalogue (global defaults + optional company overrides). */
  getLeaveTypes(companyId?: string | null): Promise<LeaveType[]>;
  /** Compute (or decline to compute) an offboarding gratuity. */
  calculateOffboarding(inputs: OffboardingInputs): OffboardingResult;
}
