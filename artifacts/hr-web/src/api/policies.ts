import {
  getList,
  getValidated,
  patchValidated,
  postValidated,
} from "../lib/api-client";
import {
  policyAckSchema,
  policySchema,
  type Policy,
  type PolicyAck,
} from "./schemas";

export function listPolicies() {
  return getList("/policies", policySchema);
}

export function getPolicy(id: string): Promise<Policy> {
  return getValidated(`/policies/${id}`, policySchema);
}

export type PolicyInput = { title: string; body: string };

export function createPolicy(input: PolicyInput): Promise<Policy> {
  return postValidated("/policies", input, policySchema);
}

export function updatePolicy(id: string, input: Partial<PolicyInput>): Promise<Policy> {
  return patchValidated(`/policies/${id}`, input, policySchema);
}

/**
 * Acknowledge a policy. Employees acknowledge as themselves (employeeId is
 * derived server-side from the session); admins must pass an employeeId.
 */
export function acknowledgePolicy(id: string, employeeId?: string): Promise<PolicyAck> {
  return postValidated(
    `/policies/${id}/acknowledge`,
    employeeId ? { employeeId } : {},
    policyAckSchema,
  );
}

export function listAcknowledgements(id: string) {
  return getList(`/policies/${id}/acknowledgements`, policyAckSchema);
}
