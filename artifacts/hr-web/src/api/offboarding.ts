import { getList, getValidated, postValidated } from "../lib/api-client";
import {
  eosgResultSchema,
  offboardingSchema,
  type EosgResult,
  type Offboarding,
} from "./schemas";

export type EosgInputs = {
  basicMonthlyPay: number; // minor units
  joinDate: string;
  exitDate: string;
};

/** Preview EOSG without persisting — server computes, never the client. */
export function previewOffboarding(input: EosgInputs): Promise<EosgResult> {
  return postValidated("/offboarding/preview", input, eosgResultSchema);
}

export type CreateOffboardingInput = {
  employeeId: string;
  exitDate: string;
  reason?: string | null;
  eosg: EosgInputs;
};

export function createOffboarding(input: CreateOffboardingInput): Promise<Offboarding> {
  return postValidated("/offboarding", input, offboardingSchema);
}

export function listOffboarding() {
  return getList("/offboarding", offboardingSchema);
}

export function getOffboarding(id: string): Promise<Offboarding> {
  return getValidated(`/offboarding/${id}`, offboardingSchema);
}
