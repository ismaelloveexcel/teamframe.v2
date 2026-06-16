import {
  getList,
  getValidated,
  patchValidated,
  postValidated,
  putValidated,
} from "../lib/api-client";
import {
  leaveBalanceSchema,
  leaveSchema,
  leaveTypeSchema,
  type Leave,
  type LeaveBalance,
  type LeaveType,
} from "./schemas";
import { z } from "zod";

export function getLeaveTypes(): Promise<LeaveType[]> {
  return getValidated("/leave/types", z.array(leaveTypeSchema));
}

export function listLeave(employeeId?: string) {
  return getList("/leave", leaveSchema, employeeId ? { employeeId } : undefined);
}

export function getLeave(id: string): Promise<Leave> {
  return getValidated(`/leave/${id}`, leaveSchema);
}

export type CreateLeaveInput = {
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
};

export function createLeave(input: CreateLeaveInput): Promise<Leave> {
  return postValidated("/leave", input, leaveSchema);
}

export function updateLeave(
  id: string,
  input: Partial<{ status: string } & CreateLeaveInput>,
): Promise<Leave> {
  return patchValidated(`/leave/${id}`, input, leaveSchema);
}

export function listLeaveBalances(employeeId?: string) {
  return getList(
    "/leave-balances",
    leaveBalanceSchema,
    employeeId ? { employeeId } : undefined,
  );
}

export type SetLeaveBalanceInput = {
  employeeId: string;
  type: LeaveType;
  balanceDays: number;
};

export function setLeaveBalance(input: SetLeaveBalanceInput): Promise<LeaveBalance> {
  // Backend uses PUT for upsert of a balance.
  return putValidated("/leave-balances", input, leaveBalanceSchema);
}
