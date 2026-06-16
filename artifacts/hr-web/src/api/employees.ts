import {
  getList,
  getValidated,
  patchValidated,
  postValidated,
  type ListParams,
} from "../lib/api-client";
import {
  assignmentSchema,
  employeeSchema,
  inviteResponseSchema,
  type Assignment,
  type Employee,
} from "./schemas";

export function listEmployees(params?: ListParams) {
  return getList("/employees", employeeSchema, params);
}

export function getEmployee(id: string): Promise<Employee> {
  return getValidated(`/employees/${id}`, employeeSchema);
}

export type CreateEmployeeInput = {
  employeeNo: string;
  firstName: string;
  lastName: string;
  personalEmail?: string | null;
  companyEmail?: string | null;
  mobileNumber?: string | null;
  joinDate?: string | null;
  nationality?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  address?: string | null;
};

export function createEmployee(input: CreateEmployeeInput): Promise<Employee> {
  return postValidated("/employees", input, employeeSchema);
}

export function updateEmployee(
  id: string,
  input: Partial<CreateEmployeeInput>,
): Promise<Employee> {
  return patchValidated(`/employees/${id}`, input, employeeSchema);
}

export function listAssignments(employeeId: string) {
  return getList(`/employees/${employeeId}/assignments`, assignmentSchema);
}

export function assignPosition(
  employeeId: string,
  positionId: string,
  startDate: string,
): Promise<Assignment> {
  return postValidated(
    `/employees/${employeeId}/assign`,
    { positionId, startDate },
    assignmentSchema,
  );
}

export function inviteEmployee(employeeId: string) {
  return postValidated(`/employees/${employeeId}/invite`, {}, inviteResponseSchema);
}
