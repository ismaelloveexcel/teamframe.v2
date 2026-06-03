export type EmploymentStatusId = "active" | "on_leave" | "offboarding";

export interface Position {
  id: string;
  title: string;
  department: string;
  reportsToId: string | null;
  order: number;
  level: number;
}

export interface CompensationComponent {
  label: string;
  amount: number;
  currency: string;
}

export interface WorkContact {
  email: string;
  phone: string;
  extension?: string;
}

export interface PersonalContact {
  mobile: string;
  personalEmail?: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

export interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  positionId: string;
  status: EmploymentStatusId;
  email: string;
  phone: string;
  location: string;
  startDate: string;
  avatarInitials: string;
  avatarColor: string;
  salary: number;
  workContact: WorkContact;
  personalContact: PersonalContact;
  compensationComponents: CompensationComponent[];
  bankName: string;
  bankAccount: string;
  iban: string;
  onboardingStatus: "complete" | "in_progress" | "not_started";
  emergencyContacts: EmergencyContact[];
}

export interface ComplianceItem {
  id: string;
  positionId: string;
  type: string;
  status: "complete" | "missing" | "expired";
  description: string;
}

export interface TeamFrameConfig {
  employmentStatuses: { id: EmploymentStatusId; label: string; dotColor: string }[];
  documentTypes: string[];
  policyCategories: string[];
  compensationComponentTemplates: string[];
  riskCategories: string[];
}

export interface SeedData {
  positions: Position[];
  employees: Employee[];
  compliance: ComplianceItem[];
  config: TeamFrameConfig;
}

export const SEED: SeedData = {
  positions: [
    { id: "1-001", title: "CEO", department: "Executive", reportsToId: null, order: 0, level: 0 },
    { id: "1-002", title: "COO", department: "Operations", reportsToId: "1-001", order: 1, level: 1 },
    { id: "1-003", title: "CTO", department: "Engineering", reportsToId: "1-001", order: 2, level: 1 },
    { id: "1-004", title: "Head of People", department: "People", reportsToId: "1-002", order: 3, level: 2 },
    { id: "2-001", title: "VP Engineering", department: "Engineering", reportsToId: "1-003", order: 4, level: 2 },
    { id: "2-002", title: "VP Marketing", department: "Marketing", reportsToId: "1-002", order: 5, level: 2 },
    { id: "2-003", title: "VP Finance", department: "Finance", reportsToId: "1-002", order: 6, level: 2 },
    { id: "2-004", title: "VP Sales", department: "Sales", reportsToId: "1-002", order: 7, level: 2 },
    { id: "3-001", title: "Backend Lead", department: "Engineering", reportsToId: "2-001", order: 8, level: 3 },
    { id: "3-002", title: "Frontend Lead", department: "Engineering", reportsToId: "2-001", order: 9, level: 3 },
    { id: "3-003", title: "Finance Manager", department: "Finance", reportsToId: "2-003", order: 10, level: 3 },
    { id: "3-004", title: "Sales Manager", department: "Sales", reportsToId: "2-004", order: 11, level: 3 },
  ],
  employees: [
    {
      id: "e-001",
      employeeCode: "EMP-1001",
      name: "Alex Thompson",
      positionId: "1-001",
      status: "active",
      email: "alex.thompson@company.com",
      phone: "+1 415 555 0100",
      location: "San Francisco, CA",
      startDate: "2018-01-01",
      avatarInitials: "AT",
      avatarColor: "#6366f1",
      salary: 180000,
      workContact: { email: "alex.thompson@company.com", phone: "+1 415 555 0100", extension: "101" },
      personalContact: { mobile: "+1 415 555 0190", personalEmail: "alex.personal@example.com" },
      compensationComponents: [
        { label: "Basic Salary", amount: 180000, currency: "USD" },
        { label: "Leadership Allowance", amount: 25000, currency: "USD" },
      ],
      bankName: "Chase",
      bankAccount: "1234567890",
      iban: "US64CHAS1234567890",
      onboardingStatus: "complete",
      emergencyContacts: [{ name: "Maya Thompson", relationship: "Spouse", phone: "+1 415 555 0144", email: "maya@example.com" }],
    },
    {
      id: "e-002",
      employeeCode: "EMP-1002",
      name: "Lina Brooks",
      positionId: "1-002",
      status: "active",
      email: "lina.brooks@company.com",
      phone: "+971 50 100 1002",
      location: "Dubai, UAE",
      startDate: "2019-03-15",
      avatarInitials: "LB",
      avatarColor: "#8b5cf6",
      salary: 160000,
      workContact: { email: "lina.brooks@company.com", phone: "+971 50 100 1002" },
      personalContact: { mobile: "+971 50 100 2002" },
      compensationComponents: [
        { label: "Basic Salary", amount: 160000, currency: "USD" },
        { label: "Housing", amount: 22000, currency: "USD" },
        { label: "Transport", amount: 6000, currency: "USD" },
      ],
      bankName: "Emirates NBD",
      bankAccount: "2345678901",
      iban: "AE0703312345678901",
      onboardingStatus: "complete",
      emergencyContacts: [{ name: "Nora Brooks", relationship: "Sister", phone: "+971 55 222 9001" }],
    },
    {
      id: "e-003",
      employeeCode: "EMP-1003",
      name: "Michael Chen",
      positionId: "1-003",
      status: "active",
      email: "michael.chen@company.com",
      phone: "+49 170 500 0003",
      location: "Berlin, DE",
      startDate: "2019-02-01",
      avatarInitials: "MC",
      avatarColor: "#f59e0b",
      salary: 175000,
      workContact: { email: "michael.chen@company.com", phone: "+49 170 500 0003", extension: "301" },
      personalContact: { mobile: "+49 170 500 1003" },
      compensationComponents: [
        { label: "Basic Salary", amount: 175000, currency: "EUR" },
        { label: "Engineering Incentive", amount: 12000, currency: "EUR" },
      ],
      bankName: "Deutsche Bank",
      bankAccount: "3456789012",
      iban: "DE89370400440532013000",
      onboardingStatus: "complete",
      emergencyContacts: [{ name: "Nina Chen", relationship: "Partner", phone: "+49 160 900 3000" }],
    },
    {
      id: "e-004",
      employeeCode: "EMP-1004",
      name: "Emma Davis",
      positionId: "1-004",
      status: "active",
      email: "emma.davis@company.com",
      phone: "+1 415 555 0104",
      location: "San Francisco, CA",
      startDate: "2020-01-20",
      avatarInitials: "ED",
      avatarColor: "#10b981",
      salary: 145000,
      workContact: { email: "emma.davis@company.com", phone: "+1 415 555 0104" },
      personalContact: { mobile: "+1 415 555 0204" },
      compensationComponents: [{ label: "Basic Salary", amount: 145000, currency: "USD" }],
      bankName: "Chase",
      bankAccount: "4567890123",
      iban: "US64CHAS4567890123",
      onboardingStatus: "complete",
      emergencyContacts: [{ name: "James Davis", relationship: "Brother", phone: "+1 415 555 0444" }],
    },
    {
      id: "e-005",
      employeeCode: "EMP-1005",
      name: "James Wilson",
      positionId: "2-001",
      status: "active",
      email: "james.wilson@company.com",
      phone: "+1 415 555 0123",
      location: "San Francisco, CA",
      startDate: "2020-01-15",
      avatarInitials: "JW",
      avatarColor: "#3b82f6",
      salary: 155000,
      workContact: { email: "james.wilson@company.com", phone: "+1 415 555 0123", extension: "501" },
      personalContact: { mobile: "+1 415 555 0223" },
      compensationComponents: [
        { label: "Basic Salary", amount: 155000, currency: "USD" },
        { label: "Sales Incentive", amount: 10000, currency: "USD" },
      ],
      bankName: "Chase",
      bankAccount: "5678901234",
      iban: "US64CHAS5678901234",
      onboardingStatus: "complete",
      emergencyContacts: [{ name: "Liam Wilson", relationship: "Spouse", phone: "+1 415 555 0455", email: "liam@example.com" }],
    },
    {
      id: "e-006",
      employeeCode: "EMP-1006",
      name: "Rachel Green",
      positionId: "2-002",
      status: "on_leave",
      email: "rachel.green@company.com",
      phone: "+1 415 555 0106",
      location: "New York, NY",
      startDate: "2020-04-22",
      avatarInitials: "RG",
      avatarColor: "#ec4899",
      salary: 145000,
      workContact: { email: "rachel.green@company.com", phone: "+1 415 555 0106" },
      personalContact: { mobile: "+1 415 555 0206", personalEmail: "rachel.personal@example.com" },
      compensationComponents: [{ label: "Basic Salary", amount: 145000, currency: "USD" }],
      bankName: "Citibank",
      bankAccount: "6789012345",
      iban: "US64CITI6789012345",
      onboardingStatus: "complete",
      emergencyContacts: [{ name: "Monica Green", relationship: "Sister", phone: "+1 415 555 0466" }],
    },
  ],
  compliance: [
    { id: "c-001", positionId: "2-001", type: "IT Policy", status: "expired", description: "Policy acknowledgement expired" },
    { id: "c-002", positionId: "2-003", type: "Passport Copy", status: "missing", description: "Passport copy is not uploaded" },
    { id: "c-003", positionId: "2-002", type: "Onboarding Step 3", status: "missing", description: "Required onboarding step is pending" },
    { id: "c-004", positionId: "1-001", type: "Board Fiduciary", status: "complete", description: "Board duties acknowledged" },
    { id: "c-005", positionId: "3-001", type: "Code of Conduct", status: "complete", description: "Code of conduct signed" },
    { id: "c-006", positionId: "3-003", type: "Data Privacy", status: "expired", description: "Data privacy refresh needed" },
  ],
  config: {
    employmentStatuses: [
      { id: "active", label: "Active", dotColor: "#22c55e" },
      { id: "on_leave", label: "On Leave", dotColor: "#f59e0b" },
      { id: "offboarding", label: "Offboarding", dotColor: "#ef4444" },
    ],
    documentTypes: ["Passport Copy", "Employment Contract", "Residence Authorization", "NDA", "Job Description", "Other"],
    policyCategories: ["Employee Handbook", "Code of Conduct", "IT Policy", "Data Protection Policy", "Remote Work Policy", "Leave Policy"],
    compensationComponentTemplates: ["Basic Salary", "Housing", "Transport", "Sales Incentive", "Other"],
    riskCategories: ["Vacancy", "Offboarding", "Leave", "Compliance", "Capacity"],
  },
};
