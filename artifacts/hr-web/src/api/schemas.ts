import { z } from "zod";

// ── Auth ────────────────────────────────────────────────────────────────────
export const roleSchema = z
  .enum(["admin", "employee", "super_admin"])
  .nullable();
export type Role = z.infer<typeof roleSchema>;

export const loginResponseSchema = z.object({
  token: z.string(),
  userId: z.string(),
  companyId: z.string().nullable(),
  expiresAt: z.string(),
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const actorSchema = z.object({
  userId: z.string(),
  email: z.string(),
  status: z.enum(["invited", "active", "inactive"]),
  companyId: z.string().nullable(),
  role: roleSchema,
});
export type Actor = z.infer<typeof actorSchema>;

export const meResponseSchema = z.object({ actor: actorSchema });

export const bootstrapResponseSchema = z.object({
  companyId: z.string(),
  admin: z.object({
    id: z.string(),
    email: z.string(),
    role: z.string(),
  }),
});
export type BootstrapResponse = z.infer<typeof bootstrapResponseSchema>;

// ── Positions ─────────────────────────────────────────────────────────────
export const positionSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  title: z.string(),
  department: z.string().nullable(),
  function: z.string().nullable(),
  lineManagerId: z.string().nullable(),
  grade: z.string().nullable(),
  location: z.string().nullable(),
  employmentType: z.string().nullable(),
  workSchedule: z.string().nullable(),
  budgeted: z.boolean(),
  jobDescription: z.string().nullable(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Position = z.infer<typeof positionSchema>;

export type PositionNode = Position & { reports: PositionNode[] };
export const positionNodeSchema: z.ZodType<PositionNode> = positionSchema.extend(
  {
    reports: z.lazy(() => z.array(positionNodeSchema)),
  },
) as unknown as z.ZodType<PositionNode>;

// ── Employees ─────────────────────────────────────────────────────────────
export const employeeSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  employeeNo: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  dateOfBirth: z.string().nullable(),
  gender: z.string().nullable(),
  nationality: z.string().nullable(),
  personalEmail: z.string().nullable(),
  companyEmail: z.string().nullable(),
  mobileNumber: z.string().nullable(),
  address: z.string().nullable(),
  emergencyContacts: z.array(z.record(z.string(), z.unknown())).nullable(),
  joinDate: z.string().nullable(),
  dateOfExit: z.string().nullable(),
  status: z.string(),
  userId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Employee = z.infer<typeof employeeSchema>;

export const assignmentSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  employeeId: z.string(),
  positionId: z.string(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Assignment = z.infer<typeof assignmentSchema>;

export const inviteResponseSchema = z.object({ userId: z.string() });

// ── Org chart ───────────────────────────────────────────────────────────────
export type OrgChartNode = {
  position: {
    id: string;
    title: string;
    department: string | null;
    grade: string | null;
    location: string | null;
    employmentType: string | null;
  };
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNo: string;
    status: string;
  } | null;
  children: OrgChartNode[];
};
export const orgChartNodeSchema: z.ZodType<OrgChartNode> = z.object({
  position: z.object({
    id: z.string(),
    title: z.string(),
    department: z.string().nullable(),
    grade: z.string().nullable(),
    location: z.string().nullable(),
    employmentType: z.string().nullable(),
  }),
  employee: z
    .object({
      id: z.string(),
      firstName: z.string(),
      lastName: z.string(),
      employeeNo: z.string(),
      status: z.string(),
    })
    .nullable(),
  children: z.lazy(() => z.array(orgChartNodeSchema)),
}) as unknown as z.ZodType<OrgChartNode>;

// ── Compensation ──────────────────────────────────────────────────────────
// amount/components are admin-only and may be ABSENT for employee role (the
// backend field-gates them), so they are optional here.
export const compensationSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  employeeId: z.string(),
  amount: z.number().optional(),
  currency: z.string().nullable(),
  components: z.record(z.string(), z.number()).nullable().optional(),
  effectiveDate: z.string().nullable(),
  bankName: z.string().nullable(),
  iban: z.string().nullable(),
  swiftCode: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Compensation = z.infer<typeof compensationSchema>;

// ── Leave ───────────────────────────────────────────────────────────────────
export const leaveTypeSchema = z.enum([
  "annual",
  "sick",
  "maternity",
  "paternity",
  "hajj",
  "bereavement",
  "unpaid",
]);
export type LeaveType = z.infer<typeof leaveTypeSchema>;

export const leaveSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  employeeId: z.string(),
  type: leaveTypeSchema,
  startDate: z.string(),
  endDate: z.string(),
  days: z.number(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Leave = z.infer<typeof leaveSchema>;

export const leaveBalanceSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  employeeId: z.string(),
  type: leaveTypeSchema,
  balanceDays: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type LeaveBalance = z.infer<typeof leaveBalanceSchema>;

// ── Policies ──────────────────────────────────────────────────────────────
export const policySchema = z.object({
  id: z.string(),
  companyId: z.string(),
  title: z.string(),
  body: z.string(),
  version: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Policy = z.infer<typeof policySchema>;

export const policyAckSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  policyId: z.string(),
  employeeId: z.string(),
  version: z.number(),
  acknowledgedAt: z.string(),
  createdAt: z.string(),
});
export type PolicyAck = z.infer<typeof policyAckSchema>;

// ── Templates + Documents ─────────────────────────────────────────────────
export const templateSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string(),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Template = z.infer<typeof templateSchema>;

export const documentSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  employeeId: z.string().nullable(),
  templateId: z.string().nullable(),
  name: z.string(),
  content: z.string().nullable(),
  attachments: z.array(z.record(z.string(), z.unknown())).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Document = z.infer<typeof documentSchema>;

// ── Offboarding ───────────────────────────────────────────────────────────
export const eosgResultSchema = z.object({
  basicMonthlyPay: z.number(),
  joinDate: z.string(),
  exitDate: z.string(),
  yearsOfService: z.number(),
  dailyWage: z.number(),
  gratuityAmount: z.number(),
  capApplied: z.boolean(),
});
export type EosgResult = z.infer<typeof eosgResultSchema>;

export const offboardingSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  employeeId: z.string(),
  exitDate: z.string(),
  reason: z.string().nullable(),
  eosgInputs: z.record(z.string(), z.unknown()).nullable(),
  gratuityAmount: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  // POST /offboarding additionally returns a computed `eosg` object.
  eosg: eosgResultSchema.optional(),
});
export type Offboarding = z.infer<typeof offboardingSchema>;

// ── Reports ───────────────────────────────────────────────────────────────
export const reportSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  kind: z.enum(["finance", "exit"]),
  subjectId: z.string().nullable(),
  periodCutoff: z.string().nullable(),
  content: z.record(z.string(), z.unknown()),
  generatedBy: z.string().nullable(),
  generatedAt: z.string(),
});
export type Report = z.infer<typeof reportSchema>;
