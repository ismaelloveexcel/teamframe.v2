import { getValidated } from "../lib/api-client";
import { orgChartNodeSchema, type OrgChartNode } from "./schemas";
import { z } from "zod";

export function getOrgChart(): Promise<OrgChartNode[]> {
  return getValidated("/orgchart", z.array(orgChartNodeSchema));
}
