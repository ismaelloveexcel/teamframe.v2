import {
  del,
  getList,
  getValidated,
  patchValidated,
  postValidated,
} from "../lib/api-client";
import { compensationSchema, type Compensation } from "./schemas";

export function listCompensation(employeeId?: string) {
  return getList(
    "/compensation",
    compensationSchema,
    employeeId ? { employeeId } : undefined,
  );
}

export function getCompensation(id: string): Promise<Compensation> {
  return getValidated(`/compensation/${id}`, compensationSchema);
}

export type CompensationInput = {
  employeeId: string;
  currency: string;
  amount?: number; // minor units; admin-only
  components?: Record<string, number> | null;
  effectiveDate?: string | null;
  bankName?: string | null;
  iban?: string | null;
  swiftCode?: string | null;
};

export function createCompensation(input: CompensationInput): Promise<Compensation> {
  return postValidated("/compensation", input, compensationSchema);
}

export function updateCompensation(
  id: string,
  input: Partial<CompensationInput>,
): Promise<Compensation> {
  return patchValidated(`/compensation/${id}`, input, compensationSchema);
}

export function deleteCompensation(id: string): Promise<void> {
  return del(`/compensation/${id}`);
}
