export interface Position {
  id: string;
  title: string;
  department: string;
  reportsToId: string | null;
  order: number;
  level: number;
  isCriticalPosition: boolean;
}

export type EmployeeStatus = "active" | "on_leave" | "offboarding";
export type OnboardingStatus = "complete" | "in_progress" | "not_started";
export type DocumentScope = "employee" | "company";
export type RequirementLevel = "required" | "optional" | "not_applicable";

export type DocumentCategory =
  | "Identity Document"
  | "Employment Authorization"
  | "Residence Authorization"
  | "NDA"
  | "Employment Contract"
  | "Job Description"
  | "Passport"
  | "Visa"
  | "Employee Handbook"
  | "Code of Conduct"
  | "IT Policy"
  | "Data Protection Policy"
  | "Remote Work Policy"
  | "Leave Policy"
  | "Compliance Document"
  | "Internal Procedure"
  | "Other";

export type DocumentStatus = "valid" | "expired";

export interface EmergencyContact {
  name: string;
  relation: string;
  phone: string;
}

export interface ActivityLogEntry {
  id: string;
  at: string;
  description: string;
}

export interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  positionId: string;
  status: EmployeeStatus;
  email: string;
  phone: string;
  location: string;
  timeZone: string;
  region: string;
  startDate: string;
  address: string;
  nationality: string;
  dateOfBirth: string;
  employmentType: "full_time" | "contractor";
  avatarInitials: string;
  avatarColor: string;
  salary: number;
  currency: string;
  bankName: string;
  bankAccount: string;
  iban: string;
  requiresResidenceAuthorization: boolean;
  onboardingStatus: OnboardingStatus;
  onboardingProgress: number;
  leaveStartDate?: string;
  leaveEndDate?: string;
  emergencyContacts: EmergencyContact[];
  activityHistory: ActivityLogEntry[];
}

export interface EmployeeDocument {
  id: string;
  employeeId: string | null;
  positionId: string | null;
  scope: DocumentScope;
  category: DocumentCategory;
  requirementLevel: RequirementLevel;
  fileName: string;
  uploadedAt: string;
  uploadedBy: string;
  status: DocumentStatus;
  expiresAt?: string;
}

export interface PolicyDefinition {
  id: string;
  name: string;
  version: number;
  effectiveDate: string;
  uploadedBy: string;
  applicableDepartments: string[];
  applicableRegions: string[];
}

export interface PolicyAcknowledgement {
  policyId: string;
  employeeId: string;
  version: number;
  status: "acknowledged" | "pending";
  acknowledgedAt?: string;
  pendingSince: string;
}

export interface OnboardingTaskDefinition {
  id: string;
  title: string;
  requirementLevel: RequirementLevel;
}

export interface EmployeeOnboardingState {
  employeeId: string;
  taskId: string;
  status: "complete" | "pending" | "not_applicable";
  completedAt?: string;
}

export interface SeedData {
  organizationName: string;
  positions: Position[];
  employees: Employee[];
  documents: EmployeeDocument[];
  policies: PolicyDefinition[];
  policyAcknowledgements: PolicyAcknowledgement[];
  onboardingTasks: OnboardingTaskDefinition[];
  employeeOnboarding: EmployeeOnboardingState[];
}

export const REQUIRED_EMPLOYEE_DOCUMENTS: DocumentCategory[] = [
  "Identity Document",
  "Employment Authorization",
  "NDA",
  "Employment Contract",
];

export const REQUIRED_COMPANY_DOCUMENTS: DocumentCategory[] = [
  "Job Description",
  "Employee Handbook",
  "Code of Conduct",
  "IT Policy",
  "Data Protection Policy",
];

export const SEED: SeedData = {
  organizationName: "TeamFrame Demo Org",
  positions: [
    { id: "1-001", title: "CEO", department: "Executive", reportsToId: null, order: 0, level: 0, isCriticalPosition: true },
    { id: "1-002", title: "COO", department: "Operations", reportsToId: "1-001", order: 1, level: 1, isCriticalPosition: true },
    { id: "1-003", title: "Head of Engineering", department: "Engineering", reportsToId: "1-001", order: 2, level: 1, isCriticalPosition: true },
    { id: "1-004", title: "Head of Finance", department: "Finance", reportsToId: "1-001", order: 3, level: 1, isCriticalPosition: true },
    { id: "1-005", title: "Head of Sales", department: "Sales", reportsToId: "1-001", order: 4, level: 1, isCriticalPosition: true },
    { id: "2-001", title: "Product Manager", department: "Product", reportsToId: "1-003", order: 5, level: 2, isCriticalPosition: false },
    { id: "2-002", title: "Backend Engineer", department: "Engineering", reportsToId: "1-003", order: 6, level: 2, isCriticalPosition: false },
    { id: "2-003", title: "Frontend Engineer", department: "Engineering", reportsToId: "1-003", order: 7, level: 2, isCriticalPosition: false },
    { id: "2-004", title: "DevOps Engineer", department: "Engineering", reportsToId: "1-003", order: 8, level: 2, isCriticalPosition: false },
    { id: "2-005", title: "HR Generalist", department: "People", reportsToId: "1-002", order: 9, level: 2, isCriticalPosition: false },
    { id: "2-006", title: "Finance Analyst", department: "Finance", reportsToId: "1-004", order: 10, level: 2, isCriticalPosition: false },
    { id: "2-007", title: "Sales Manager", department: "Sales", reportsToId: "1-005", order: 11, level: 2, isCriticalPosition: true },
    { id: "3-001", title: "Account Executive", department: "Sales", reportsToId: "2-007", order: 12, level: 3, isCriticalPosition: false },
    { id: "3-002", title: "Customer Success Manager", department: "Sales", reportsToId: "2-007", order: 13, level: 3, isCriticalPosition: false },
  ],
  employees: [
    {
      id: "e-001", employeeCode: "EMP-1001", name: "Alex Thompson", positionId: "1-001", status: "active",
      email: "alex@teamframe.com", phone: "+1 415-555-0100", location: "San Francisco", timeZone: "PST", region: "US",
      startDate: "2024-01-02", address: "100 Market St", nationality: "USA", dateOfBirth: "1987-06-12", employmentType: "full_time",
      avatarInitials: "AT", avatarColor: "#6366f1", salary: 220000, currency: "USD", bankName: "Chase", bankAccount: "1234567890", iban: "US64CHAS1234567890",
      requiresResidenceAuthorization: false, onboardingStatus: "complete", onboardingProgress: 100,
      emergencyContacts: [{ name: "Maya Thompson", relation: "Spouse", phone: "+1 415-555-9991" }],
      activityHistory: [
        { id: "act-e001-1", at: "2026-05-31T09:00:00Z", description: "Reviewed org gaps" },
        { id: "act-e001-2", at: "2026-06-01T12:30:00Z", description: "Approved policy update" },
      ],
    },
    {
      id: "e-002", employeeCode: "EMP-1002", name: "Lina Brooks", positionId: "1-002", status: "active",
      email: "lina@teamframe.com", phone: "+1 415-555-0101", location: "Dubai", timeZone: "GST", region: "UAE",
      startDate: "2024-02-11", address: "Dubai Marina", nationality: "UAE", dateOfBirth: "1989-02-01", employmentType: "full_time",
      avatarInitials: "LB", avatarColor: "#10b981", salary: 180000, currency: "USD", bankName: "Emirates NBD", bankAccount: "2234567890", iban: "AE070331234567890",
      requiresResidenceAuthorization: true, onboardingStatus: "complete", onboardingProgress: 100,
      emergencyContacts: [{ name: "Nora Brooks", relation: "Sister", phone: "+971-50-111-8899" }],
      activityHistory: [{ id: "act-e002-1", at: "2026-06-01T08:00:00Z", description: "Published setup checklist" }],
    },
    {
      id: "e-003", employeeCode: "EMP-1003", name: "Michael Chen", positionId: "1-003", status: "active",
      email: "michael@teamframe.com", phone: "+1 415-555-0102", location: "Berlin", timeZone: "CET", region: "EU",
      startDate: "2024-03-01", address: "Kreuzberg", nationality: "Germany", dateOfBirth: "1990-10-18", employmentType: "full_time",
      avatarInitials: "MC", avatarColor: "#f59e0b", salary: 195000, currency: "EUR", bankName: "Deutsche Bank", bankAccount: "3234567890", iban: "DE89370400440532013000",
      requiresResidenceAuthorization: false, onboardingStatus: "complete", onboardingProgress: 100,
      emergencyContacts: [{ name: "Nina Chen", relation: "Partner", phone: "+49-151-222-8899" }],
      activityHistory: [{ id: "act-e003-1", at: "2026-05-30T10:20:00Z", description: "Updated engineering JD" }],
    },
    {
      id: "e-004", employeeCode: "EMP-1004", name: "Sofia Patel", positionId: "1-004", status: "active",
      email: "sofia@teamframe.com", phone: "+44 20 5555 1234", location: "London", timeZone: "GMT", region: "EU",
      startDate: "2024-04-12", address: "Canary Wharf", nationality: "UK", dateOfBirth: "1992-03-17", employmentType: "full_time",
      avatarInitials: "SP", avatarColor: "#3b82f6", salary: 170000, currency: "GBP", bankName: "HSBC", bankAccount: "4234567890", iban: "GB82WEST12345698765432",
      requiresResidenceAuthorization: false, onboardingStatus: "complete", onboardingProgress: 100,
      emergencyContacts: [{ name: "Ravi Patel", relation: "Brother", phone: "+44-7700-111222" }],
      activityHistory: [{ id: "act-e004-1", at: "2026-05-29T11:10:00Z", description: "Reviewed finance report" }],
    },
    {
      id: "e-005", employeeCode: "EMP-1005", name: "Ralph Morris", positionId: "2-001", status: "active",
      email: "ralph@teamframe.com", phone: "+1 415-555-0103", location: "San Francisco", timeZone: "PST", region: "US",
      startDate: "2025-01-07", address: "Mission Bay", nationality: "USA", dateOfBirth: "1993-09-21", employmentType: "full_time",
      avatarInitials: "RM", avatarColor: "#8b5cf6", salary: 145000, currency: "USD", bankName: "Chase", bankAccount: "5234567890", iban: "US64CHAS5234567890",
      requiresResidenceAuthorization: false, onboardingStatus: "in_progress", onboardingProgress: 72,
      emergencyContacts: [{ name: "Anne Morris", relation: "Mother", phone: "+1 415-555-8890" }],
      activityHistory: [{ id: "act-e005-1", at: "2026-06-02T08:05:00Z", description: "Requested policy reminder" }],
    },
    {
      id: "e-006", employeeCode: "EMP-1006", name: "Rachel Green", positionId: "2-002", status: "on_leave",
      email: "rachel@teamframe.com", phone: "+1 415-555-0104", location: "New York", timeZone: "EST", region: "US",
      startDate: "2025-02-02", address: "Hudson St", nationality: "USA", dateOfBirth: "1991-12-10", employmentType: "full_time",
      avatarInitials: "RG", avatarColor: "#ec4899", salary: 130000, currency: "USD", bankName: "Citi", bankAccount: "6234567890", iban: "US64CITI6234567890",
      requiresResidenceAuthorization: false, onboardingStatus: "complete", onboardingProgress: 100,
      leaveStartDate: "2026-06-01", leaveEndDate: "2026-06-10",
      emergencyContacts: [{ name: "Mona Green", relation: "Mother", phone: "+1 212-555-8890" }],
      activityHistory: [{ id: "act-e006-1", at: "2026-05-31T16:30:00Z", description: "Started approved leave" }],
    },
    {
      id: "e-007", employeeCode: "EMP-1007", name: "Priya Singh", positionId: "2-004", status: "active",
      email: "priya.singh@teamframe.com", phone: "+971 54 444 2211", location: "Dubai", timeZone: "GST", region: "UAE",
      startDate: "2025-01-20", address: "JLT", nationality: "India", dateOfBirth: "1994-04-13", employmentType: "full_time",
      avatarInitials: "PS", avatarColor: "#06b6d4", salary: 125000, currency: "USD", bankName: "Mashreq", bankAccount: "7234567890", iban: "AE070337234567890",
      requiresResidenceAuthorization: true, onboardingStatus: "in_progress", onboardingProgress: 58,
      emergencyContacts: [{ name: "Amit Singh", relation: "Father", phone: "+91-98-0000-8899" }],
      activityHistory: [{ id: "act-e007-1", at: "2026-06-02T07:45:00Z", description: "Uploaded residence authorization" }],
    },
    {
      id: "e-008", employeeCode: "EMP-1008", name: "Daniel Kim", positionId: "2-006", status: "offboarding",
      email: "daniel@teamframe.com", phone: "+44 20 5555 7821", location: "London", timeZone: "GMT", region: "EU",
      startDate: "2025-03-18", address: "Paddington", nationality: "UK", dateOfBirth: "1990-08-08", employmentType: "full_time",
      avatarInitials: "DK", avatarColor: "#f97316", salary: 118000, currency: "GBP", bankName: "Barclays", bankAccount: "8234567890", iban: "GB29NWBK60161331926819",
      requiresResidenceAuthorization: false, onboardingStatus: "complete", onboardingProgress: 100,
      emergencyContacts: [{ name: "Jin Kim", relation: "Brother", phone: "+44-7700-009911" }],
      activityHistory: [{ id: "act-e008-1", at: "2026-06-01T14:20:00Z", description: "Initiated offboarding" }],
    },
    {
      id: "e-009", employeeCode: "EMP-1009", name: "Nina Foster", positionId: "2-007", status: "active",
      email: "nina@teamframe.com", phone: "+230 5500 9001", location: "Port Louis", timeZone: "MUT", region: "MU",
      startDate: "2025-04-10", address: "Port Louis", nationality: "Mauritius", dateOfBirth: "1993-11-27", employmentType: "full_time",
      avatarInitials: "NF", avatarColor: "#f472b6", salary: 110000, currency: "USD", bankName: "MCB", bankAccount: "9234567890", iban: "MU17MCBL9234567890",
      requiresResidenceAuthorization: false, onboardingStatus: "in_progress", onboardingProgress: 64,
      emergencyContacts: [{ name: "Sam Foster", relation: "Spouse", phone: "+230-5510-1234" }],
      activityHistory: [{ id: "act-e009-1", at: "2026-06-02T06:15:00Z", description: "Reviewed sales action queue" }],
    },
    {
      id: "e-010", employeeCode: "EMP-1010", name: "Tom Nguyen", positionId: "3-001", status: "active",
      email: "tom@teamframe.com", phone: "+230 5500 9322", location: "Port Louis", timeZone: "MUT", region: "MU",
      startDate: "2025-05-21", address: "Rose Hill", nationality: "Mauritius", dateOfBirth: "1995-09-19", employmentType: "full_time",
      avatarInitials: "TN", avatarColor: "#84cc16", salary: 90000, currency: "USD", bankName: "SBM", bankAccount: "1034567890", iban: "MU17SBMU1034567890",
      requiresResidenceAuthorization: false, onboardingStatus: "not_started", onboardingProgress: 20,
      emergencyContacts: [{ name: "Tran Nguyen", relation: "Father", phone: "+230-5757-7744" }],
      activityHistory: [{ id: "act-e010-1", at: "2026-06-01T09:12:00Z", description: "Pending handbook acknowledgement" }],
    },
  ],
  documents: [
    { id: "doc-001", employeeId: "e-001", positionId: "1-001", scope: "employee", category: "Identity Document", requirementLevel: "required", fileName: "alex-id.pdf", uploadedAt: "2025-01-03", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-002", employeeId: "e-001", positionId: "1-001", scope: "employee", category: "Employment Authorization", requirementLevel: "required", fileName: "alex-work-auth.pdf", uploadedAt: "2025-01-03", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-003", employeeId: "e-001", positionId: "1-001", scope: "employee", category: "NDA", requirementLevel: "required", fileName: "alex-nda.pdf", uploadedAt: "2025-01-03", uploadedBy: "Legal", status: "valid" },
    { id: "doc-004", employeeId: "e-001", positionId: "1-001", scope: "employee", category: "Employment Contract", requirementLevel: "required", fileName: "alex-contract.pdf", uploadedAt: "2025-01-03", uploadedBy: "HR Ops", status: "valid" },

    { id: "doc-005", employeeId: "e-002", positionId: "1-002", scope: "employee", category: "Identity Document", requirementLevel: "required", fileName: "lina-id.pdf", uploadedAt: "2025-02-12", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-006", employeeId: "e-002", positionId: "1-002", scope: "employee", category: "Employment Authorization", requirementLevel: "required", fileName: "lina-work-auth.pdf", uploadedAt: "2025-02-12", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-007", employeeId: "e-002", positionId: "1-002", scope: "employee", category: "Residence Authorization", requirementLevel: "required", fileName: "lina-residence-auth.pdf", uploadedAt: "2025-02-12", uploadedBy: "HR Ops", status: "expired", expiresAt: "2026-05-15" },
    { id: "doc-008", employeeId: "e-002", positionId: "1-002", scope: "employee", category: "NDA", requirementLevel: "required", fileName: "lina-nda.pdf", uploadedAt: "2025-02-12", uploadedBy: "Legal", status: "valid" },

    { id: "doc-009", employeeId: "e-003", positionId: "1-003", scope: "employee", category: "Identity Document", requirementLevel: "required", fileName: "michael-id.pdf", uploadedAt: "2025-03-01", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-010", employeeId: "e-003", positionId: "1-003", scope: "employee", category: "Employment Authorization", requirementLevel: "required", fileName: "michael-work-auth.pdf", uploadedAt: "2025-03-01", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-011", employeeId: "e-003", positionId: "1-003", scope: "employee", category: "Employment Contract", requirementLevel: "required", fileName: "michael-contract.pdf", uploadedAt: "2025-03-01", uploadedBy: "HR Ops", status: "valid" },

    { id: "doc-012", employeeId: "e-007", positionId: "2-004", scope: "employee", category: "Identity Document", requirementLevel: "required", fileName: "priya-id.pdf", uploadedAt: "2025-01-22", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-013", employeeId: "e-007", positionId: "2-004", scope: "employee", category: "Employment Authorization", requirementLevel: "required", fileName: "priya-work-auth.pdf", uploadedAt: "2025-01-22", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-014", employeeId: "e-007", positionId: "2-004", scope: "employee", category: "Residence Authorization", requirementLevel: "required", fileName: "priya-residence.pdf", uploadedAt: "2025-01-22", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-015", employeeId: "e-007", positionId: "2-004", scope: "employee", category: "NDA", requirementLevel: "required", fileName: "priya-nda.pdf", uploadedAt: "2025-01-22", uploadedBy: "Legal", status: "valid" },
    { id: "doc-016", employeeId: "e-007", positionId: "2-004", scope: "employee", category: "Employment Contract", requirementLevel: "required", fileName: "priya-contract.pdf", uploadedAt: "2025-01-22", uploadedBy: "HR Ops", status: "valid" },

    { id: "doc-017", employeeId: null, positionId: "1-003", scope: "company", category: "Job Description", requirementLevel: "required", fileName: "head-engineering-jd-v2.pdf", uploadedAt: "2026-05-20", uploadedBy: "COO", status: "valid" },
    { id: "doc-018", employeeId: null, positionId: null, scope: "company", category: "Employee Handbook", requirementLevel: "required", fileName: "employee-handbook-v3.pdf", uploadedAt: "2026-05-18", uploadedBy: "COO", status: "valid" },
    { id: "doc-019", employeeId: null, positionId: null, scope: "company", category: "Code of Conduct", requirementLevel: "required", fileName: "code-of-conduct-v2.pdf", uploadedAt: "2026-05-18", uploadedBy: "COO", status: "valid" },
    { id: "doc-020", employeeId: null, positionId: null, scope: "company", category: "IT Policy", requirementLevel: "required", fileName: "it-policy-v1.pdf", uploadedAt: "2026-05-18", uploadedBy: "COO", status: "valid" },
    { id: "doc-021", employeeId: null, positionId: null, scope: "company", category: "Data Protection Policy", requirementLevel: "required", fileName: "data-protection-v4.pdf", uploadedAt: "2026-05-18", uploadedBy: "COO", status: "valid" },
  ],
  policies: [
    { id: "pol-001", name: "Employee Handbook", version: 3, effectiveDate: "2026-05-18", uploadedBy: "COO", applicableDepartments: ["all"], applicableRegions: ["all"] },
    { id: "pol-002", name: "Code of Conduct", version: 2, effectiveDate: "2026-05-18", uploadedBy: "COO", applicableDepartments: ["all"], applicableRegions: ["all"] },
    { id: "pol-003", name: "IT Policy", version: 1, effectiveDate: "2026-05-18", uploadedBy: "COO", applicableDepartments: ["all"], applicableRegions: ["all"] },
    { id: "pol-004", name: "Data Protection Policy", version: 4, effectiveDate: "2026-05-18", uploadedBy: "COO", applicableDepartments: ["all"], applicableRegions: ["all"] },
    { id: "pol-005", name: "Remote Work Policy", version: 1, effectiveDate: "2026-04-20", uploadedBy: "COO", applicableDepartments: ["Engineering", "Product"], applicableRegions: ["US", "EU"] },
    { id: "pol-006", name: "Leave Policy", version: 2, effectiveDate: "2026-03-15", uploadedBy: "COO", applicableDepartments: ["all"], applicableRegions: ["all"] },
  ],
  policyAcknowledgements: [
    { policyId: "pol-001", employeeId: "e-001", version: 3, status: "acknowledged", acknowledgedAt: "2026-05-19", pendingSince: "2026-05-18" },
    { policyId: "pol-001", employeeId: "e-002", version: 3, status: "pending", pendingSince: "2026-05-18" },
    { policyId: "pol-001", employeeId: "e-003", version: 3, status: "acknowledged", acknowledgedAt: "2026-05-20", pendingSince: "2026-05-18" },
    { policyId: "pol-002", employeeId: "e-002", version: 2, status: "acknowledged", acknowledgedAt: "2026-05-20", pendingSince: "2026-05-18" },
    { policyId: "pol-003", employeeId: "e-005", version: 1, status: "pending", pendingSince: "2026-05-18" },
    { policyId: "pol-004", employeeId: "e-010", version: 4, status: "pending", pendingSince: "2026-05-18" },
    { policyId: "pol-006", employeeId: "e-006", version: 2, status: "acknowledged", acknowledgedAt: "2026-04-05", pendingSince: "2026-03-15" },
  ],
  onboardingTasks: [
    { id: "ob-001", title: "Account Setup", requirementLevel: "required" },
    { id: "ob-002", title: "Policy Acknowledgement", requirementLevel: "required" },
    { id: "ob-003", title: "Documents Verified", requirementLevel: "required" },
    { id: "ob-004", title: "Manager Introduction", requirementLevel: "required" },
    { id: "ob-005", title: "Equipment Provisioning", requirementLevel: "optional" },
  ],
  employeeOnboarding: [
    { employeeId: "e-005", taskId: "ob-001", status: "complete", completedAt: "2025-01-08" },
    { employeeId: "e-005", taskId: "ob-002", status: "pending" },
    { employeeId: "e-005", taskId: "ob-003", status: "complete", completedAt: "2025-01-10" },
    { employeeId: "e-005", taskId: "ob-004", status: "pending" },

    { employeeId: "e-007", taskId: "ob-001", status: "complete", completedAt: "2025-01-23" },
    { employeeId: "e-007", taskId: "ob-002", status: "complete", completedAt: "2025-01-24" },
    { employeeId: "e-007", taskId: "ob-003", status: "pending" },
    { employeeId: "e-007", taskId: "ob-004", status: "pending" },

    { employeeId: "e-010", taskId: "ob-001", status: "pending" },
    { employeeId: "e-010", taskId: "ob-002", status: "pending" },
    { employeeId: "e-010", taskId: "ob-003", status: "pending" },
    { employeeId: "e-010", taskId: "ob-004", status: "pending" },
  ],
};
