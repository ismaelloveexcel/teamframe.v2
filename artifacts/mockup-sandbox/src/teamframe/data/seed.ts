export interface Position {
  id: string;
  title: string;
  department: string;
  reportsToId: string | null;
  order: number;
  level: number;
}

export type EmployeeStatus = "active" | "on_leave" | "offboarding";
export type OnboardingStatus = "complete" | "in_progress" | "not_started";
export type DocumentCategory =
  | "Employment Contract"
  | "Job Description"
  | "Passport"
  | "Visa"
  | "NDA"
  | "Other";
export type DocumentStatus = "valid" | "expired";

export interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  positionId: string;
  status: EmployeeStatus;
  email: string;
  phone: string;
  location: string;
  address: string;
  nationality: string;
  dateOfBirth: string;
  employmentType: "full_time" | "contractor";
  startDate: string;
  avatarInitials: string;
  avatarColor: string;
  salary: number;
  currency: string;
  bankName: string;
  bankAccount: string;
  iban: string;
  requiresVisa: boolean;
  onboardingStatus: OnboardingStatus;
  onboardingProgress: number;
}

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  category: DocumentCategory;
  fileName: string;
  uploadedAt: string;
  uploadedBy: string;
  status: DocumentStatus;
}

export interface SeedData {
  positions: Position[];
  employees: Employee[];
  documents: EmployeeDocument[];
}

export const REQUIRED_DOCUMENT_CATEGORIES: DocumentCategory[] = [
  "Employment Contract",
  "Job Description",
  "Passport",
  "NDA",
];

export const SEED: SeedData = {
  positions: [
    { id: "1-001", title: "CEO", department: "Executive", reportsToId: null, order: 0, level: 0 },
    { id: "1-002", title: "Head of People", department: "HR", reportsToId: "1-001", order: 1, level: 1 },
    { id: "1-003", title: "CTO", department: "Engineering", reportsToId: "1-001", order: 2, level: 1 },
    { id: "1-004", title: "COO", department: "Operations", reportsToId: "1-001", order: 3, level: 1 },
    { id: "2-001", title: "VP Engineering", department: "Engineering", reportsToId: "1-003", order: 4, level: 2 },
    { id: "2-002", title: "VP Marketing", department: "Marketing", reportsToId: "1-004", order: 5, level: 2 },
    { id: "2-003", title: "VP Product", department: "Product", reportsToId: "1-003", order: 6, level: 2 },
    { id: "2-004", title: "VP Finance", department: "Finance", reportsToId: "1-004", order: 7, level: 2 },
    { id: "2-005", title: "VP Sales", department: "Sales", reportsToId: "1-004", order: 8, level: 2 },
    { id: "3-001", title: "Tech Lead Backend", department: "Engineering", reportsToId: "2-001", order: 9, level: 3 },
    { id: "3-002", title: "Tech Lead Frontend", department: "Engineering", reportsToId: "2-001", order: 10, level: 3 },
    { id: "3-003", title: "QA Manager", department: "Engineering", reportsToId: "2-001", order: 11, level: 3 },
    { id: "3-004", title: "DevOps Lead", department: "Engineering", reportsToId: "2-001", order: 12, level: 3 },
    { id: "3-005", title: "Product Manager", department: "Product", reportsToId: "2-003", order: 13, level: 3 },
    { id: "3-006", title: "Product Designer", department: "Product", reportsToId: "2-003", order: 14, level: 3 },
    { id: "3-007", title: "UX Researcher", department: "Product", reportsToId: "2-003", order: 15, level: 3 },
    { id: "3-008", title: "Finance Manager", department: "Finance", reportsToId: "2-004", order: 16, level: 3 },
    { id: "3-009", title: "Accountant", department: "Finance", reportsToId: "2-004", order: 17, level: 3 },
    { id: "3-010", title: "Payroll Specialist", department: "Finance", reportsToId: "2-004", order: 18, level: 3 },
    { id: "3-011", title: "Marketing Manager", department: "Marketing", reportsToId: "2-002", order: 19, level: 3 },
    { id: "3-012", title: "Content Lead", department: "Marketing", reportsToId: "2-002", order: 20, level: 3 },
    { id: "3-013", title: "Brand Designer", department: "Marketing", reportsToId: "2-002", order: 21, level: 3 },
    { id: "3-014", title: "Sales Development", department: "Sales", reportsToId: "2-005", order: 22, level: 3 },
    { id: "3-015", title: "Sales Manager", department: "Sales", reportsToId: "2-005", order: 23, level: 3 },
    { id: "3-016", title: "Account Executive", department: "Sales", reportsToId: "2-005", order: 24, level: 3 },
    { id: "3-017", title: "Sales Development", department: "Sales", reportsToId: "2-005", order: 25, level: 3 },
  ],
  employees: [
    {
      id: "e-001", employeeCode: "EMP-1001", name: "Alex Thompson", positionId: "1-001", status: "active",
      email: "alex.thompson@company.com", phone: "(415) 555-0100", location: "San Francisco, CA",
      address: "100 Market St, San Francisco, CA", nationality: "USA", dateOfBirth: "1985-06-12",
      employmentType: "full_time", startDate: "2018-01-01", avatarInitials: "AT", avatarColor: "#6366f1",
      salary: 180000, currency: "USD", bankName: "Chase", bankAccount: "1234567890", iban: "US64CHAS1234567890",
      requiresVisa: false, onboardingStatus: "complete", onboardingProgress: 100,
    },
    {
      id: "e-002", employeeCode: "EMP-1002", name: "Emma Davis", positionId: "1-002", status: "active",
      email: "emma.davis@company.com", phone: "(415) 555-0101", location: "San Francisco, CA",
      address: "218 Howard St, San Francisco, CA", nationality: "USA", dateOfBirth: "1988-02-03",
      employmentType: "full_time", startDate: "2019-03-15", avatarInitials: "ED", avatarColor: "#8b5cf6",
      salary: 160000, currency: "USD", bankName: "Chase", bankAccount: "2345678901", iban: "US65CHAS2345678901",
      requiresVisa: false, onboardingStatus: "complete", onboardingProgress: 100,
    },
    {
      id: "e-003", employeeCode: "EMP-1003", name: "Michael Chen", positionId: "1-003", status: "active",
      email: "michael.chen@company.com", phone: "(415) 555-0102", location: "San Francisco, CA",
      address: "99 Battery St, San Francisco, CA", nationality: "USA", dateOfBirth: "1987-11-18",
      employmentType: "full_time", startDate: "2019-02-01", avatarInitials: "MC", avatarColor: "#f59e0b",
      salary: 175000, currency: "USD", bankName: "Bank of America", bankAccount: "3456789012", iban: "US66BOFA3456789012",
      requiresVisa: false, onboardingStatus: "complete", onboardingProgress: 100,
    },
    {
      id: "e-004", employeeCode: "EMP-1004", name: "Lisa Martinez", positionId: "1-004", status: "active",
      email: "lisa.martinez@company.com", phone: "(415) 555-0103", location: "Austin, TX",
      address: "701 Congress Ave, Austin, TX", nationality: "USA", dateOfBirth: "1986-01-30",
      employmentType: "full_time", startDate: "2019-07-10", avatarInitials: "LM", avatarColor: "#10b981",
      salary: 165000, currency: "USD", bankName: "Wells Fargo", bankAccount: "4567890123", iban: "US67WFBI4567890123",
      requiresVisa: false, onboardingStatus: "complete", onboardingProgress: 100,
    },
    {
      id: "e-005", employeeCode: "EMP-1005", name: "James Wilson", positionId: "2-001", status: "active",
      email: "james.wilson@company.com", phone: "(415) 555-0123", location: "San Francisco, CA",
      address: "500 Folsom St, San Francisco, CA", nationality: "USA", dateOfBirth: "1990-05-07",
      employmentType: "full_time", startDate: "2020-01-15", avatarInitials: "JW", avatarColor: "#3b82f6",
      salary: 155000, currency: "USD", bankName: "Chase", bankAccount: "5678901234", iban: "US68CHAS5678901234",
      requiresVisa: false, onboardingStatus: "complete", onboardingProgress: 100,
    },
    {
      id: "e-006", employeeCode: "EMP-1006", name: "Rachel Green", positionId: "2-002", status: "on_leave",
      email: "rachel.green@company.com", phone: "(415) 555-0104", location: "New York, NY",
      address: "99 Hudson St, New York, NY", nationality: "USA", dateOfBirth: "1991-12-10",
      employmentType: "full_time", startDate: "2020-04-22", avatarInitials: "RG", avatarColor: "#ec4899",
      salary: 145000, currency: "USD", bankName: "Citibank", bankAccount: "6789012345", iban: "US69CITI6789012345",
      requiresVisa: false, onboardingStatus: "complete", onboardingProgress: 100,
    },
    {
      id: "e-007", employeeCode: "EMP-1007", name: "Priya Patel", positionId: "2-003", status: "active",
      email: "priya.patel@company.com", phone: "(415) 555-0105", location: "San Francisco, CA",
      address: "20 Mission St, San Francisco, CA", nationality: "India", dateOfBirth: "1992-04-19",
      employmentType: "full_time", startDate: "2020-06-01", avatarInitials: "PP", avatarColor: "#06b6d4",
      salary: 150000, currency: "USD", bankName: "Chase", bankAccount: "7890123456", iban: "US70CHAS7890123456",
      requiresVisa: true, onboardingStatus: "complete", onboardingProgress: 100,
    },
    {
      id: "e-008", employeeCode: "EMP-1008", name: "Daniel Kim", positionId: "2-004", status: "offboarding",
      email: "daniel.kim@company.com", phone: "(415) 555-0106", location: "Chicago, IL",
      address: "120 Lake St, Chicago, IL", nationality: "USA", dateOfBirth: "1989-08-08",
      employmentType: "full_time", startDate: "2020-09-15", avatarInitials: "DK", avatarColor: "#f97316",
      salary: 140000, currency: "USD", bankName: "Bank of America", bankAccount: "8901234567", iban: "US71BOFA8901234567",
      requiresVisa: false, onboardingStatus: "complete", onboardingProgress: 100,
    },
    {
      id: "e-009", employeeCode: "EMP-1009", name: "Robert Brown", positionId: "2-005", status: "active",
      email: "robert.brown@company.com", phone: "(415) 555-0107", location: "Dallas, TX",
      address: "810 Main St, Dallas, TX", nationality: "USA", dateOfBirth: "1991-03-03",
      employmentType: "full_time", startDate: "2020-11-03", avatarInitials: "RB", avatarColor: "#84cc16",
      salary: 135000, currency: "USD", bankName: "Wells Fargo", bankAccount: "9012345678", iban: "US72WFBI9012345678",
      requiresVisa: false, onboardingStatus: "complete", onboardingProgress: 100,
    },
    {
      id: "e-010", employeeCode: "EMP-1010", name: "Sarah Lee", positionId: "3-001", status: "active",
      email: "sarah.lee@company.com", phone: "(415) 555-0108", location: "San Francisco, CA",
      address: "18 King St, San Francisco, CA", nationality: "USA", dateOfBirth: "1994-09-11",
      employmentType: "full_time", startDate: "2021-01-10", avatarInitials: "SL", avatarColor: "#a78bfa",
      salary: 125000, currency: "USD", bankName: "Chase", bankAccount: "0123456789", iban: "US73CHAS0123456789",
      requiresVisa: false, onboardingStatus: "in_progress", onboardingProgress: 72,
    },
    {
      id: "e-011", employeeCode: "EMP-1011", name: "Tom Nguyen", positionId: "3-011", status: "active",
      email: "tom.nguyen@company.com", phone: "(415) 555-0109", location: "New York, NY",
      address: "121 5th Ave, New York, NY", nationality: "Vietnam", dateOfBirth: "1993-10-25",
      employmentType: "full_time", startDate: "2021-03-05", avatarInitials: "TN", avatarColor: "#fb923c",
      salary: 110000, currency: "USD", bankName: "Citibank", bankAccount: "1123456789", iban: "US74CITI1123456789",
      requiresVisa: true, onboardingStatus: "complete", onboardingProgress: 100,
    },
    {
      id: "e-012", employeeCode: "EMP-1012", name: "Amy Chen", positionId: "3-005", status: "active",
      email: "amy.chen@company.com", phone: "(415) 555-0110", location: "San Francisco, CA",
      address: "50 Howard St, San Francisco, CA", nationality: "USA", dateOfBirth: "1995-01-08",
      employmentType: "full_time", startDate: "2021-05-17", avatarInitials: "AC", avatarColor: "#34d399",
      salary: 120000, currency: "USD", bankName: "Chase", bankAccount: "2123456789", iban: "US75CHAS2123456789",
      requiresVisa: false, onboardingStatus: "not_started", onboardingProgress: 20,
    },
    {
      id: "e-013", employeeCode: "EMP-1013", name: "Mark Davis", positionId: "3-008", status: "active",
      email: "mark.davis@company.com", phone: "(415) 555-0111", location: "Chicago, IL",
      address: "300 W Adams St, Chicago, IL", nationality: "USA", dateOfBirth: "1990-06-14",
      employmentType: "full_time", startDate: "2021-07-22", avatarInitials: "MD", avatarColor: "#60a5fa",
      salary: 105000, currency: "USD", bankName: "Bank of America", bankAccount: "3123456789", iban: "US76BOFA3123456789",
      requiresVisa: false, onboardingStatus: "complete", onboardingProgress: 100,
    },
    {
      id: "e-014", employeeCode: "EMP-1014", name: "Nina Foster", positionId: "3-015", status: "active",
      email: "nina.foster@company.com", phone: "(415) 555-0112", location: "Dallas, TX",
      address: "450 Elm St, Dallas, TX", nationality: "USA", dateOfBirth: "1992-11-27",
      employmentType: "full_time", startDate: "2021-08-30", avatarInitials: "NF", avatarColor: "#f472b6",
      salary: 100000, currency: "USD", bankName: "Wells Fargo", bankAccount: "4123456789", iban: "US77WFBI4123456789",
      requiresVisa: false, onboardingStatus: "complete", onboardingProgress: 100,
    },
  ],
  documents: [
    { id: "doc-001", employeeId: "e-001", category: "Employment Contract", fileName: "alex-contract.pdf", uploadedAt: "2024-01-10", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-002", employeeId: "e-001", category: "Job Description", fileName: "ceo-jd-v3.pdf", uploadedAt: "2024-02-01", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-003", employeeId: "e-001", category: "Passport", fileName: "alex-passport.pdf", uploadedAt: "2023-11-12", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-004", employeeId: "e-001", category: "NDA", fileName: "alex-nda.pdf", uploadedAt: "2023-11-12", uploadedBy: "Legal", status: "valid" },
    { id: "doc-005", employeeId: "e-002", category: "Employment Contract", fileName: "emma-contract.pdf", uploadedAt: "2024-01-15", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-006", employeeId: "e-002", category: "Job Description", fileName: "head-people-jd.pdf", uploadedAt: "2024-02-09", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-007", employeeId: "e-002", category: "Passport", fileName: "emma-passport.pdf", uploadedAt: "2023-11-01", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-008", employeeId: "e-002", category: "NDA", fileName: "emma-nda.pdf", uploadedAt: "2023-11-01", uploadedBy: "Legal", status: "valid" },
    { id: "doc-009", employeeId: "e-003", category: "Employment Contract", fileName: "michael-contract.pdf", uploadedAt: "2024-01-20", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-010", employeeId: "e-003", category: "Job Description", fileName: "cto-jd-v2.pdf", uploadedAt: "2024-02-15", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-011", employeeId: "e-003", category: "Passport", fileName: "michael-passport.pdf", uploadedAt: "2023-10-20", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-012", employeeId: "e-003", category: "NDA", fileName: "michael-nda.pdf", uploadedAt: "2023-10-20", uploadedBy: "Legal", status: "valid" },
    { id: "doc-013", employeeId: "e-004", category: "Employment Contract", fileName: "lisa-contract.pdf", uploadedAt: "2024-01-21", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-014", employeeId: "e-004", category: "Job Description", fileName: "coo-jd-v2.pdf", uploadedAt: "2024-02-15", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-015", employeeId: "e-004", category: "Passport", fileName: "lisa-passport.pdf", uploadedAt: "2023-12-01", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-016", employeeId: "e-004", category: "NDA", fileName: "lisa-nda.pdf", uploadedAt: "2023-12-01", uploadedBy: "Legal", status: "valid" },
    { id: "doc-017", employeeId: "e-005", category: "Employment Contract", fileName: "james-contract.pdf", uploadedAt: "2024-01-25", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-018", employeeId: "e-005", category: "Job Description", fileName: "vp-eng-jd.pdf", uploadedAt: "2024-03-03", uploadedBy: "HR Ops", status: "expired" },
    { id: "doc-019", employeeId: "e-005", category: "Passport", fileName: "james-passport.pdf", uploadedAt: "2023-12-04", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-020", employeeId: "e-005", category: "NDA", fileName: "james-nda.pdf", uploadedAt: "2023-12-04", uploadedBy: "Legal", status: "valid" },
    { id: "doc-021", employeeId: "e-006", category: "Employment Contract", fileName: "rachel-contract.pdf", uploadedAt: "2024-01-26", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-022", employeeId: "e-006", category: "Passport", fileName: "rachel-passport.pdf", uploadedAt: "2024-01-26", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-023", employeeId: "e-006", category: "NDA", fileName: "rachel-nda.pdf", uploadedAt: "2024-01-26", uploadedBy: "Legal", status: "valid" },
    { id: "doc-024", employeeId: "e-007", category: "Employment Contract", fileName: "priya-contract.pdf", uploadedAt: "2024-01-26", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-025", employeeId: "e-007", category: "Job Description", fileName: "vp-product-jd.pdf", uploadedAt: "2024-01-26", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-026", employeeId: "e-007", category: "Passport", fileName: "priya-passport.pdf", uploadedAt: "2024-01-26", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-027", employeeId: "e-007", category: "Visa", fileName: "priya-visa.pdf", uploadedAt: "2024-01-26", uploadedBy: "HR Ops", status: "expired" },
    { id: "doc-028", employeeId: "e-007", category: "NDA", fileName: "priya-nda.pdf", uploadedAt: "2024-01-26", uploadedBy: "Legal", status: "valid" },
    { id: "doc-029", employeeId: "e-008", category: "Job Description", fileName: "vp-finance-jd.pdf", uploadedAt: "2024-01-26", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-030", employeeId: "e-008", category: "Passport", fileName: "daniel-passport.pdf", uploadedAt: "2024-01-26", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-031", employeeId: "e-009", category: "Employment Contract", fileName: "robert-contract.pdf", uploadedAt: "2024-01-26", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-032", employeeId: "e-009", category: "Job Description", fileName: "vp-sales-jd.pdf", uploadedAt: "2024-01-26", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-033", employeeId: "e-009", category: "Passport", fileName: "robert-passport.pdf", uploadedAt: "2024-01-26", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-034", employeeId: "e-009", category: "NDA", fileName: "robert-nda.pdf", uploadedAt: "2024-01-26", uploadedBy: "Legal", status: "valid" },
    { id: "doc-035", employeeId: "e-010", category: "Employment Contract", fileName: "sarah-contract.pdf", uploadedAt: "2024-01-26", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-036", employeeId: "e-010", category: "Job Description", fileName: "tech-lead-backend-jd.pdf", uploadedAt: "2024-01-26", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-037", employeeId: "e-010", category: "NDA", fileName: "sarah-nda.pdf", uploadedAt: "2024-01-26", uploadedBy: "Legal", status: "valid" },
    { id: "doc-038", employeeId: "e-011", category: "Employment Contract", fileName: "tom-contract.pdf", uploadedAt: "2024-01-26", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-039", employeeId: "e-011", category: "Job Description", fileName: "marketing-manager-jd.pdf", uploadedAt: "2024-01-26", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-040", employeeId: "e-011", category: "Passport", fileName: "tom-passport.pdf", uploadedAt: "2024-01-26", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-041", employeeId: "e-011", category: "NDA", fileName: "tom-nda.pdf", uploadedAt: "2024-01-26", uploadedBy: "Legal", status: "valid" },
    { id: "doc-042", employeeId: "e-012", category: "Employment Contract", fileName: "amy-contract.pdf", uploadedAt: "2024-01-26", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-043", employeeId: "e-012", category: "Passport", fileName: "amy-passport.pdf", uploadedAt: "2024-01-26", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-044", employeeId: "e-013", category: "Employment Contract", fileName: "mark-contract.pdf", uploadedAt: "2024-01-26", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-045", employeeId: "e-013", category: "Job Description", fileName: "finance-manager-jd.pdf", uploadedAt: "2024-01-26", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-046", employeeId: "e-013", category: "Passport", fileName: "mark-passport.pdf", uploadedAt: "2024-01-26", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-047", employeeId: "e-013", category: "NDA", fileName: "mark-nda.pdf", uploadedAt: "2024-01-26", uploadedBy: "Legal", status: "valid" },
    { id: "doc-048", employeeId: "e-014", category: "Employment Contract", fileName: "nina-contract.pdf", uploadedAt: "2024-01-26", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-049", employeeId: "e-014", category: "Job Description", fileName: "sales-manager-jd.pdf", uploadedAt: "2024-01-26", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-050", employeeId: "e-014", category: "Passport", fileName: "nina-passport.pdf", uploadedAt: "2024-01-26", uploadedBy: "HR Ops", status: "valid" },
    { id: "doc-051", employeeId: "e-014", category: "NDA", fileName: "nina-nda.pdf", uploadedAt: "2024-01-26", uploadedBy: "Legal", status: "valid" },
    { id: "doc-052", employeeId: "e-005", category: "Other", fileName: "engineering-headcount-plan.xlsx", uploadedAt: "2024-03-15", uploadedBy: "James Wilson", status: "valid" },
    { id: "doc-053", employeeId: "e-012", category: "Other", fileName: "product-roadmap-notes.txt", uploadedAt: "2024-03-15", uploadedBy: "Amy Chen", status: "valid" },
  ],
};
