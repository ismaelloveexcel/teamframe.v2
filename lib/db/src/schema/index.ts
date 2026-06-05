import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const membershipRoleEnum = pgEnum("membership_role", [
  "owner",
  "admin",
  "member",
]);
export const employmentStatusEnum = pgEnum("employment_status", [
  "active",
  "on_leave",
  "offboarding",
]);
export const positionLifecycleStatusEnum = pgEnum("position_lifecycle_status", [
  "filled",
  "vacant",
  "frozen",
]);
export const actionStatusEnum = pgEnum("action_status", [
  "open",
  "in_progress",
  "done",
]);
export const personPositionAssignmentStatusEnum = pgEnum(
  "person_position_assignment_status",
  ["active", "ended"],
);
export const policyScopeEnum = pgEnum("policy_scope", [
  "organization",
  "team",
  "position",
]);
export const auditEventTypeEnum = pgEnum("audit_event_type", [
  "ownership_changed",
  "action_status_changed",
  "policy_scope_changed",
]);
export const documentLifecycleStateEnum = pgEnum("document_lifecycle_state", [
  "uploaded",
  "signed",
  "expired",
  "revoked",
]);
export const complianceDerivedStatusEnum = pgEnum("compliance_derived_status", [
  "missing",
  "pending",
  "compliant",
  "non_compliant",
]);

export const organizationsTable = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const usersTable = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const organizationMembershipsTable = pgTable(
  "organization_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    role: membershipRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("organization_memberships_org_user_unique").on(
      table.organizationId,
      table.userId,
    ),
    index("organization_memberships_org_idx").on(table.organizationId),
    index("organization_memberships_user_idx").on(table.userId),
  ],
);

export const teamsTable = pgTable(
  "teams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code"),
    parentTeamId: uuid("parent_team_id").references((): AnyPgColumn => teamsTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("teams_org_name_unique").on(table.organizationId, table.name),
    index("teams_org_idx").on(table.organizationId),
    index("teams_parent_idx").on(table.parentTeamId),
  ],
);

export const positionsTable = pgTable(
  "positions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    teamId: uuid("team_id").references(() => teamsTable.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    reportsToPositionId: uuid("reports_to_position_id").references(
      (): AnyPgColumn => positionsTable.id,
      { onDelete: "set null" },
    ),
    lifecycleStatus: positionLifecycleStatusEnum("lifecycle_status")
      .notNull()
      .default("vacant"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("positions_org_idx").on(table.organizationId),
    index("positions_team_idx").on(table.teamId),
    index("positions_reports_to_idx").on(table.reportsToPositionId),
  ],
);

export const peopleTable = pgTable(
  "people",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    positionId: uuid("position_id").references(() => positionsTable.id, {
      onDelete: "set null",
    }),
    employmentStatus: employmentStatusEnum("employment_status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("people_org_idx").on(table.organizationId),
    unique("people_position_unique").on(table.positionId),
  ],
);


export const personPositionAssignmentsTable = pgTable(
  "person_position_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => peopleTable.id),
    positionId: uuid("position_id")
      .notNull()
      .references(() => positionsTable.id),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    status: personPositionAssignmentStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("person_position_assignments_org_person_idx").on(
      table.organizationId,
      table.personId,
    ),
    index("person_position_assignments_org_position_idx").on(
      table.organizationId,
      table.positionId,
    ),
    index("person_position_assignments_person_ended_at_idx").on(table.personId, table.endedAt),
    uniqueIndex("person_position_assignments_active_person_unique")
      .on(table.personId)
      .where(sql`${table.status} = 'active'`),
  ],
);

export const evidenceRequirementProfilesTable = pgTable(
  "evidence_requirement_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    positionId: uuid("position_id")
      .notNull()
      .references(() => positionsTable.id, { onDelete: "cascade" }),
    profileName: text("profile_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("evidence_requirement_profiles_org_position_unique").on(
      table.organizationId,
      table.positionId,
    ),
    index("evidence_requirement_profiles_org_idx").on(table.organizationId),
  ],
);

export const evidenceRequirementsTable = pgTable(
  "evidence_requirements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => evidenceRequirementProfilesTable.id, { onDelete: "cascade" }),
    requirementKey: text("requirement_key").notNull(),
    displayName: text("display_name").notNull(),
    isRequired: boolean("is_required").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("evidence_requirements_profile_key_unique").on(table.profileId, table.requirementKey),
    index("evidence_requirements_org_profile_idx").on(table.organizationId, table.profileId),
  ],
);

export const positionRequirementOverridesTable = pgTable(
  "position_requirement_overrides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    positionId: uuid("position_id")
      .notNull()
      .references(() => positionsTable.id, { onDelete: "cascade" }),
    requirementKey: text("requirement_key").notNull(),
    isRequired: boolean("is_required").notNull(),
    reason: text("reason").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("position_requirement_overrides_org_position_key_unique").on(
      table.organizationId,
      table.positionId,
      table.requirementKey,
    ),
    index("position_requirement_overrides_org_position_idx").on(
      table.organizationId,
      table.positionId,
    ),
  ],
);

export const documentsTable = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => personPositionAssignmentsTable.id, { onDelete: "cascade" }),
    positionId: uuid("position_id")
      .notNull()
      .references(() => positionsTable.id, { onDelete: "cascade" }),
    requirementKey: text("requirement_key").notNull(),
    sourceDocumentRef: text("source_document_ref").notNull(),
    state: documentLifecycleStateEnum("state").notNull().default("uploaded"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("documents_org_assignment_idx").on(table.organizationId, table.assignmentId),
    index("documents_org_position_idx").on(table.organizationId, table.positionId),
    index("documents_org_requirement_idx").on(table.organizationId, table.requirementKey),
  ],
);

export const compensationRecordsTable = pgTable(
  "compensation_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => personPositionAssignmentsTable.id, { onDelete: "cascade" }),
    sourceDocumentId: uuid("source_document_id")
      .notNull()
      .references(() => documentsTable.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("compensation_records_org_assignment_effective_idx").on(
      table.organizationId,
      table.assignmentId,
      table.effectiveFrom,
    ),
  ],
);

export const offboardingCompletionsTable = pgTable(
  "offboarding_completions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => personPositionAssignmentsTable.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("offboarding_completions_org_assignment_unique").on(table.organizationId, table.assignmentId),
    index("offboarding_completions_org_idx").on(table.organizationId),
  ],
);

export const evidenceStatusByAssignmentTable = pgTable(
  "evidence_status_by_assignment",
  {
    assignmentId: uuid("assignment_id")
      .primaryKey()
      .references(() => personPositionAssignmentsTable.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    positionId: uuid("position_id")
      .notNull()
      .references(() => positionsTable.id, { onDelete: "cascade" }),
    status: complianceDerivedStatusEnum("status").notNull(),
    missingCount: integer("missing_count").notNull().default(0),
    pendingCount: integer("pending_count").notNull().default(0),
    nonCompliantCount: integer("non_compliant_count").notNull().default(0),
    computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("evidence_status_by_assignment_org_position_idx").on(table.organizationId, table.positionId),
  ],
);

export const evidenceStatusByPositionTable = pgTable(
  "evidence_status_by_position",
  {
    positionId: uuid("position_id")
      .primaryKey()
      .references(() => positionsTable.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    status: complianceDerivedStatusEnum("status").notNull(),
    missingCount: integer("missing_count").notNull().default(0),
    pendingCount: integer("pending_count").notNull().default(0),
    nonCompliantCount: integer("non_compliant_count").notNull().default(0),
    computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("evidence_status_by_position_org_idx").on(table.organizationId)],
);

export const compensationCurrentTable = pgTable(
  "compensation_current",
  {
    assignmentId: uuid("assignment_id")
      .primaryKey()
      .references(() => personPositionAssignmentsTable.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    compensationRecordId: uuid("compensation_record_id")
      .notNull()
      .references(() => compensationRecordsTable.id, { onDelete: "cascade" }),
    sourceDocumentId: uuid("source_document_id")
      .notNull()
      .references(() => documentsTable.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("compensation_current_org_idx").on(table.organizationId)],
);

export const teamOwnershipsTable = pgTable(
  "team_ownerships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teamsTable.id, { onDelete: "cascade" }),
    ownerPersonId: uuid("owner_person_id").references(() => peopleTable.id, {
      onDelete: "set null",
    }),
    ownerPositionId: uuid("owner_position_id").references(() => positionsTable.id, {
      onDelete: "set null",
    }),
    responsibilityContext: text("responsibility_context").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("team_ownerships_team_unique").on(table.teamId),
    index("team_ownerships_org_idx").on(table.organizationId),
    check(
      "team_ownerships_owner_required",
      sql`${table.ownerPersonId} IS NOT NULL OR ${table.ownerPositionId} IS NOT NULL`,
    ),
  ],
);

export const positionOwnershipsTable = pgTable(
  "position_ownerships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    positionId: uuid("position_id")
      .notNull()
      .references(() => positionsTable.id, { onDelete: "cascade" }),
    ownerPersonId: uuid("owner_person_id").references(() => peopleTable.id, {
      onDelete: "set null",
    }),
    ownerPositionId: uuid("owner_position_id").references(() => positionsTable.id, {
      onDelete: "set null",
    }),
    responsibilityContext: text("responsibility_context").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("position_ownerships_position_unique").on(table.positionId),
    index("position_ownerships_org_idx").on(table.organizationId),
    check(
      "position_ownerships_owner_required",
      sql`${table.ownerPersonId} IS NOT NULL OR ${table.ownerPositionId} IS NOT NULL`,
    ),
  ],
);

export const actionsTable = pgTable(
  "actions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: actionStatusEnum("status").notNull().default("open"),
    dueDate: date("due_date"),
    blocked: boolean("blocked").notNull().default(false),
    ownerPersonId: uuid("owner_person_id").references(() => peopleTable.id, {
      onDelete: "set null",
    }),
    ownerPositionId: uuid("owner_position_id").references(() => positionsTable.id, {
      onDelete: "set null",
    }),
    assignmentId: uuid("assignment_id").references(() => personPositionAssignmentsTable.id, {
      onDelete: "set null",
    }),
    teamId: uuid("team_id").references(() => teamsTable.id, { onDelete: "set null" }),
    positionId: uuid("position_id").references(() => positionsTable.id, {
      onDelete: "set null",
    }),
    personId: uuid("person_id").references(() => peopleTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("actions_org_idx").on(table.organizationId),
    index("actions_status_idx").on(table.status),
    index("actions_org_owner_person_idx").on(table.organizationId, table.ownerPersonId),
    index("actions_org_owner_position_idx").on(table.organizationId, table.ownerPositionId),
    index("actions_org_assignment_idx").on(table.organizationId, table.assignmentId),
    check(
      "actions_owner_required",
      sql`${table.assignmentId} IS NOT NULL OR ${table.ownerPersonId} IS NOT NULL OR ${table.ownerPositionId} IS NOT NULL`,
    ),
    check(
      "actions_structural_link_required",
      sql`(
        (CASE WHEN ${table.teamId} IS NULL THEN 0 ELSE 1 END) +
        (CASE WHEN ${table.positionId} IS NULL THEN 0 ELSE 1 END) +
        (CASE WHEN ${table.personId} IS NULL THEN 0 ELSE 1 END)
      ) = 1`,
    ),
  ],
);

export const policiesTable = pgTable(
  "policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    scope: policyScopeEnum("scope").notNull(),
    teamId: uuid("team_id").references(() => teamsTable.id, { onDelete: "set null" }),
    positionId: uuid("position_id").references(() => positionsTable.id, {
      onDelete: "set null",
    }),
    ownerPersonId: uuid("owner_person_id").references(() => peopleTable.id, {
      onDelete: "set null",
    }),
    ownerPositionId: uuid("owner_position_id").references(() => positionsTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("policies_org_idx").on(table.organizationId),
    check(
      "policies_owner_required",
      sql`${table.ownerPersonId} IS NOT NULL OR ${table.ownerPositionId} IS NOT NULL`,
    ),
    check(
      "policies_scope_target_valid",
      sql`(
        (${table.scope} = 'organization' AND ${table.teamId} IS NULL AND ${table.positionId} IS NULL)
        OR
        (${table.scope} = 'team' AND ${table.teamId} IS NOT NULL AND ${table.positionId} IS NULL)
        OR
        (${table.scope} = 'position' AND ${table.teamId} IS NULL AND ${table.positionId} IS NOT NULL)
      )`,
    ),
  ],
);



export const auditEventsTable = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    eventType: auditEventTypeEnum("event_type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("audit_events_org_idx").on(table.organizationId),
    index("audit_events_entity_idx").on(table.entityType, table.entityId),
  ],
);

export const createOrganizationSchema = createInsertSchema(organizationsTable).pick({
  name: true,
  slug: true,
});
export const createTeamSchema = createInsertSchema(teamsTable).pick({
  organizationId: true,
  name: true,
  code: true,
  parentTeamId: true,
});
export const createPositionSchema = createInsertSchema(positionsTable).pick({
  organizationId: true,
  teamId: true,
  title: true,
  reportsToPositionId: true,
  lifecycleStatus: true,
});
export const createPersonSchema = createInsertSchema(peopleTable).pick({
  organizationId: true,
  fullName: true,
  email: true,
  phone: true,
  positionId: true,
  employmentStatus: true,
});
export const createActionSchema = createInsertSchema(actionsTable).pick({
  organizationId: true,
  title: true,
  description: true,
  dueDate: true,
  blocked: true,
  ownerPersonId: true,
  ownerPositionId: true,
  assignmentId: true,
  teamId: true,
  positionId: true,
  personId: true,
});
export const createPolicySchema = createInsertSchema(policiesTable).pick({
  organizationId: true,
  title: true,
  body: true,
  scope: true,
  teamId: true,
  positionId: true,
  ownerPersonId: true,
  ownerPositionId: true,
});

export type Organization = typeof organizationsTable.$inferSelect;
export type Team = typeof teamsTable.$inferSelect;
export type Position = typeof positionsTable.$inferSelect;
export type Person = typeof peopleTable.$inferSelect;
export type PersonPositionAssignment = typeof personPositionAssignmentsTable.$inferSelect;
export type Action = typeof actionsTable.$inferSelect;
export type Policy = typeof policiesTable.$inferSelect;
export type TeamOwnership = typeof teamOwnershipsTable.$inferSelect;
export type PositionOwnership = typeof positionOwnershipsTable.$inferSelect;
export type EvidenceRequirementProfile = typeof evidenceRequirementProfilesTable.$inferSelect;
export type EvidenceRequirement = typeof evidenceRequirementsTable.$inferSelect;
export type PositionRequirementOverride = typeof positionRequirementOverridesTable.$inferSelect;
export type Document = typeof documentsTable.$inferSelect;
export type CompensationRecord = typeof compensationRecordsTable.$inferSelect;
export type OffboardingCompletion = typeof offboardingCompletionsTable.$inferSelect;
export type EvidenceStatusByAssignment = typeof evidenceStatusByAssignmentTable.$inferSelect;
export type EvidenceStatusByPosition = typeof evidenceStatusByPositionTable.$inferSelect;
export type CompensationCurrent = typeof compensationCurrentTable.$inferSelect;

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type CreatePositionInput = z.infer<typeof createPositionSchema>;
export type CreatePersonInput = z.infer<typeof createPersonSchema>;
export type CreateActionInput = z.infer<typeof createActionSchema>;
export type CreatePolicyInput = z.infer<typeof createPolicySchema>;

export const eventAggregateTypeEnum = pgEnum("event_aggregate_type", [
  "position",
  "assignment",
  "document",
  "compensation",
  "offboarding",
  "employee",
  "system",
]);

export const quarantineStateEnum = pgEnum("quarantine_state", [
  "active",
  "quarantined",
  "restored",
  "archived",
]);

export const phaseRunStatusEnum = pgEnum("phase_run_status", [
  "started",
  "succeeded",
  "failed",
  "rolled_back",
]);

export const orgEventsTable = pgTable(
  "org_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    aggregateType: eventAggregateTypeEnum("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    eventType: text("event_type").notNull(),
    version: integer("version").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    actorUserId: uuid("actor_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    correlationId: uuid("correlation_id"),
    causationId: uuid("causation_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    schemaVersion: integer("schema_version").notNull().default(1),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    payloadHash: text("payload_hash"),
  },
  (table) => [
    uniqueIndex("org_events_org_id_idempotency_key_unique").on(
      table.orgId,
      table.idempotencyKey,
    ),
    uniqueIndex("org_events_org_aggregate_version_unique").on(
      table.orgId,
      table.aggregateType,
      table.aggregateId,
      table.version,
    ),
  ],
);

export const outboxEventsTable = pgTable(
  "outbox_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => orgEventsTable.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    processed: boolean("processed").notNull().default(false),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("outbox_events_org_event_unique").on(table.orgId, table.eventId),
  ],
);

export const aggregateVersionsTable = pgTable(
  "aggregate_versions",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    aggregateType: eventAggregateTypeEnum("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    version: integer("version").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      name: "aggregate_versions_pk",
      columns: [table.orgId, table.aggregateType, table.aggregateId],
    }),
    check(
      "aggregate_versions_version_non_negative",
      sql`${table.version} >= 0`,
    ),
  ],
);

export const idempotencyRecordsTable = pgTable(
  "idempotency_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    responseBlob: jsonb("response_blob")
      .$type<Record<string, unknown>>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idempotency_records_org_key_unique").on(
      table.orgId,
      table.idempotencyKey,
    ),
  ],
);

export const streamQuarantinesTable = pgTable(
  "stream_quarantines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    aggregateType: eventAggregateTypeEnum("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    state: quarantineStateEnum("state").notNull().default("active"),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("stream_quarantines_org_aggregate_unique").on(
      table.orgId,
      table.aggregateType,
      table.aggregateId,
    ),
  ],
);

export const phaseRunsTable = pgTable("phase_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  phaseId: text("phase_id").notNull(),
  status: phaseRunStatusEnum("status").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const createOrgEventSchema = createInsertSchema(orgEventsTable);
export const createIdempotencyRecordSchema = createInsertSchema(idempotencyRecordsTable);

export type OrgEvent = typeof orgEventsTable.$inferSelect;
export type IdempotencyRecord = typeof idempotencyRecordsTable.$inferSelect;

