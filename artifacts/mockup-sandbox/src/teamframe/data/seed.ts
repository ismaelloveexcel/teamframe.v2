export interface Position {
  id: string;
  title: string;
  department: string;
  reportsToId: string | null;
  order: number;
  level: number;
}

export interface Employee {
  id: string;
  name: string;
  positionId: string;
  status: "active" | "on_leave" | "offboarding";
  email: string;
  phone: string;
  location: string;
  startDate: string;
  avatarInitials: string;
  avatarColor: string;
}

export interface ComplianceItem {
  id: string;
  positionId: string;
  type: string;
  status: "complete" | "missing" | "expired";
  description: string;
}

export interface SeedData {
  positions: Position[];
  employees: Employee[];
  compliance: ComplianceItem[];
}

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
      id: "e-001", name: "Alex Thompson", positionId: "1-001", status: "active",
      email: "alex.thompson@company.com", phone: "(415) 555-0100",
      location: "San Francisco, CA", startDate: "Jan 1, 2018",
      avatarInitials: "AT", avatarColor: "#6366f1",
    },
    {
      id: "e-002", name: "Emma Davis", positionId: "1-002", status: "active",
      email: "emma.davis@company.com", phone: "(415) 555-0101",
      location: "San Francisco, CA", startDate: "Mar 15, 2019",
      avatarInitials: "ED", avatarColor: "#8b5cf6",
    },
    {
      id: "e-003", name: "Michael Chen", positionId: "1-003", status: "active",
      email: "michael.chen@company.com", phone: "(415) 555-0102",
      location: "San Francisco, CA", startDate: "Feb 1, 2019",
      avatarInitials: "MC", avatarColor: "#f59e0b",
    },
    {
      id: "e-004", name: "Lisa Martinez", positionId: "1-004", status: "active",
      email: "lisa.martinez@company.com", phone: "(415) 555-0103",
      location: "Austin, TX", startDate: "Jul 10, 2019",
      avatarInitials: "LM", avatarColor: "#10b981",
    },
    {
      id: "e-005", name: "James Wilson", positionId: "2-001", status: "active",
      email: "james.wilson@company.com", phone: "(415) 555-0123",
      location: "San Francisco, CA", startDate: "Jan 15, 2020",
      avatarInitials: "JW", avatarColor: "#3b82f6",
    },
    {
      id: "e-006", name: "Rachel Green", positionId: "2-002", status: "on_leave",
      email: "rachel.green@company.com", phone: "(415) 555-0104",
      location: "New York, NY", startDate: "Apr 22, 2020",
      avatarInitials: "RG", avatarColor: "#ec4899",
    },
    {
      id: "e-007", name: "Priya Patel", positionId: "2-003", status: "active",
      email: "priya.patel@company.com", phone: "(415) 555-0105",
      location: "San Francisco, CA", startDate: "Jun 1, 2020",
      avatarInitials: "PP", avatarColor: "#06b6d4",
    },
    {
      id: "e-008", name: "Daniel Kim", positionId: "2-004", status: "offboarding",
      email: "daniel.kim@company.com", phone: "(415) 555-0106",
      location: "Chicago, IL", startDate: "Sep 15, 2020",
      avatarInitials: "DK", avatarColor: "#f97316",
    },
    {
      id: "e-009", name: "Robert Brown", positionId: "2-005", status: "active",
      email: "robert.brown@company.com", phone: "(415) 555-0107",
      location: "Dallas, TX", startDate: "Nov 3, 2020",
      avatarInitials: "RB", avatarColor: "#84cc16",
    },
    {
      id: "e-010", name: "Sarah Lee", positionId: "3-001", status: "active",
      email: "sarah.lee@company.com", phone: "(415) 555-0108",
      location: "San Francisco, CA", startDate: "Jan 10, 2021",
      avatarInitials: "SL", avatarColor: "#a78bfa",
    },
    {
      id: "e-011", name: "Tom Nguyen", positionId: "3-011", status: "active",
      email: "tom.nguyen@company.com", phone: "(415) 555-0109",
      location: "New York, NY", startDate: "Mar 5, 2021",
      avatarInitials: "TN", avatarColor: "#fb923c",
    },
    {
      id: "e-012", name: "Amy Chen", positionId: "3-005", status: "active",
      email: "amy.chen@company.com", phone: "(415) 555-0110",
      location: "San Francisco, CA", startDate: "May 17, 2021",
      avatarInitials: "AC", avatarColor: "#34d399",
    },
    {
      id: "e-013", name: "Mark Davis", positionId: "3-008", status: "active",
      email: "mark.davis@company.com", phone: "(415) 555-0111",
      location: "Chicago, IL", startDate: "Jul 22, 2021",
      avatarInitials: "MD", avatarColor: "#60a5fa",
    },
    {
      id: "e-014", name: "Nina Foster", positionId: "3-015", status: "active",
      email: "nina.foster@company.com", phone: "(415) 555-0112",
      location: "Dallas, TX", startDate: "Aug 30, 2021",
      avatarInitials: "NF", avatarColor: "#f472b6",
    },
  ],
  compliance: [
    { id: "c-001", positionId: "2-001", type: "Security Training", status: "expired", description: "Annual security training expired" },
    { id: "c-002", positionId: "2-004", type: "Background Check", status: "missing", description: "Background check not on file" },
    { id: "c-003", positionId: "2-002", type: "Confidentiality Agreement", status: "missing", description: "NDA not signed" },
    { id: "c-004", positionId: "1-001", type: "Board Fiduciary", status: "complete", description: "Board duties acknowledged" },
    { id: "c-005", positionId: "3-001", type: "Code of Conduct", status: "complete", description: "Code of conduct signed" },
    { id: "c-006", positionId: "3-011", type: "Data Privacy", status: "expired", description: "GDPR training expired" },
    { id: "c-007", positionId: "3-005", type: "IP Agreement", status: "missing", description: "IP assignment not on file" },
  ],
};
