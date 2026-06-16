import {
  getList,
  getValidated,
  patchValidated,
  postValidated,
  type ListParams,
} from "../lib/api-client";
import {
  positionNodeSchema,
  positionSchema,
  type Position,
  type PositionNode,
} from "./schemas";
import { z } from "zod";

export function listPositions(params?: ListParams) {
  return getList("/positions", positionSchema, params);
}

export function getPosition(id: string): Promise<Position> {
  return getValidated(`/positions/${id}`, positionSchema);
}

export function getHierarchy(): Promise<PositionNode[]> {
  return getValidated("/positions/hierarchy", z.array(positionNodeSchema));
}

export type CreatePositionInput = {
  title: string;
  department?: string | null;
  function?: string | null;
  lineManagerId?: string | null;
  grade?: string | null;
  location?: string | null;
  employmentType?: string | null;
  workSchedule?: string | null;
  budgeted?: boolean;
  jobDescription?: string | null;
};

export function createPosition(input: CreatePositionInput): Promise<Position> {
  return postValidated("/positions", input, positionSchema);
}

export function updatePosition(
  id: string,
  input: Partial<CreatePositionInput>,
): Promise<Position> {
  return patchValidated(`/positions/${id}`, input, positionSchema);
}
