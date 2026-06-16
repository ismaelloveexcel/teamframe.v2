import { and, eq, isNull } from "drizzle-orm";
import {
  db,
  hrEmployeesTable,
  hrPositionAssignmentsTable,
  hrPositionsTable,
  type HrEmployee,
  type HrPosition,
  type HrPositionAssignment,
} from "@workspace/db";

export type OrgChartEmployee = Pick<HrEmployee, "id" | "firstName" | "lastName" | "employeeNo" | "status">;

export type OrgChartNode = {
  position: Pick<HrPosition, "id" | "title" | "department" | "grade" | "location" | "employmentType">;
  employee: OrgChartEmployee | null;
  children: OrgChartNode[];
};

type PositionRow = Pick<
  HrPosition,
  "id" | "title" | "department" | "grade" | "location" | "employmentType" | "lineManagerId"
>;
type AssignmentRow = Pick<HrPositionAssignment, "positionId" | "employeeId">;

export async function getOrgChart(companyId: string): Promise<OrgChartNode[]> {
  const [positions, assignments, employees] = await Promise.all([
    db
      .select({
        id: hrPositionsTable.id,
        title: hrPositionsTable.title,
        department: hrPositionsTable.department,
        grade: hrPositionsTable.grade,
        location: hrPositionsTable.location,
        employmentType: hrPositionsTable.employmentType,
        lineManagerId: hrPositionsTable.lineManagerId,
      })
      .from(hrPositionsTable)
      .where(eq(hrPositionsTable.companyId, companyId)),
    db
      .select({
        positionId: hrPositionAssignmentsTable.positionId,
        employeeId: hrPositionAssignmentsTable.employeeId,
      })
      .from(hrPositionAssignmentsTable)
      .where(
        and(
          eq(hrPositionAssignmentsTable.companyId, companyId),
          isNull(hrPositionAssignmentsTable.endDate),
        ),
      ),
    db
      .select({
        id: hrEmployeesTable.id,
        firstName: hrEmployeesTable.firstName,
        lastName: hrEmployeesTable.lastName,
        employeeNo: hrEmployeesTable.employeeNo,
        status: hrEmployeesTable.status,
      })
      .from(hrEmployeesTable)
      .where(eq(hrEmployeesTable.companyId, companyId)),
  ]);

  const employeeById = new Map(employees.map((e) => [e.id, e]));
  const activeAssignmentByPosition = new Map<string, string>(
    assignments.map((a: AssignmentRow) => [a.positionId, a.employeeId]),
  );

  function buildNode(pos: PositionRow): OrgChartNode {
    const empId = activeAssignmentByPosition.get(pos.id) ?? null;
    const emp = empId ? (employeeById.get(empId) ?? null) : null;
    const childPositions = positions.filter((p) => p.lineManagerId === pos.id);
    return {
      position: {
        id: pos.id,
        title: pos.title,
        department: pos.department,
        grade: pos.grade,
        location: pos.location,
        employmentType: pos.employmentType,
      },
      employee: emp
        ? { id: emp.id, firstName: emp.firstName, lastName: emp.lastName, employeeNo: emp.employeeNo, status: emp.status }
        : null,
      children: childPositions.map(buildNode),
    };
  }

  const rootPositions = positions.filter((p) => p.lineManagerId === null);
  return rootPositions.map(buildNode);
}
