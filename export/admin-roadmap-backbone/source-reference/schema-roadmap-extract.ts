// Extracted roadmap-related schema definitions from shared/schema.ts
// This file is a reference extract — not runnable without the full project dependencies.

// === Enums ===
export const roadmapTaskStatusEnum = pgEnum("roadmap_task_status", ["todo", "in-progress", "done"]);
export const roadmapEffortEnum = pgEnum("roadmap_effort", ["small", "medium", "large"]);
export const roadmapPriorityEnum = pgEnum("roadmap_priority", ["low", "medium", "high", "critical"]);

export const roadmapProjectStatusEnum = pgEnum("roadmap_project_status", ["active", "complete", "archived"]);

// === Core Roadmap Tables ===
/**
 * Roadmap tables (roadmapProjects, roadmapWorkstreams, roadmapTasks) are intentionally
 * global/admin-scoped and do NOT have an associationId column. They track platform-wide
 * development work visible only to admin users, not tenant-specific data.
 */
export const roadmapProjects = pgTable("admin_roadmap_projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  status: roadmapProjectStatusEnum("status").notNull().default("active"),
  isCollapsed: integer("is_collapsed").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const roadmapWorkstreams = pgTable("admin_roadmap_workstreams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => roadmapProjects.id),
  title: text("title").notNull(),
  description: text("description"),
  orderIndex: integer("order_index").notNull().default(0),
  isCollapsed: integer("is_collapsed").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const roadmapTasks = pgTable("admin_roadmap_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => roadmapProjects.id),
  workstreamId: varchar("workstream_id").notNull().references(() => roadmapWorkstreams.id),
  title: text("title").notNull(),
  description: text("description"),
  status: roadmapTaskStatusEnum("status").notNull().default("todo"),
  effort: roadmapEffortEnum("effort"),
  priority: roadmapPriorityEnum("priority"),
  dependencyTaskIds: text("dependency_task_ids").array().notNull().default(sql`'{}'::text[]`),
  targetStartDate: timestamp("target_start_date"),
  targetEndDate: timestamp("target_end_date"),
  completedDate: timestamp("completed_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const roadmapTaskAttachments = pgTable("admin_roadmap_task_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => roadmapTasks.id),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes"),
  uploadedBy: text("uploaded_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// === Executive Update Tables (synced from roadmap) ===
export const executiveUpdateStatusEnum = pgEnum("executive_update_status", ["draft", "published"]);
export const executiveSourceTypeEnum = pgEnum("executive_source_type", ["manual", "roadmap-task", "roadmap-project"]);
export const executiveEvidenceTypeEnum = pgEnum("executive_evidence_type", ["release-note", "metric", "screenshot", "link", "note"]);

export const executiveUpdates = pgTable("admin_executive_updates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  headline: text("headline").notNull(),
  summary: text("summary").notNull(),
  problemStatement: text("problem_statement"),
  solutionSummary: text("solution_summary"),
  featuresDelivered: text("features_delivered").array().notNull().default(sql`'{}'::text[]`),
  businessValue: text("business_value"),
  status: executiveUpdateStatusEnum("status").notNull().default("draft"),
  sourceType: executiveSourceTypeEnum("source_type").notNull().default("manual"),
  sourceKey: text("source_key"),
  projectId: varchar("project_id").references(() => roadmapProjects.id),
  workstreamId: varchar("workstream_id").references(() => roadmapWorkstreams.id),
  taskId: varchar("task_id").references(() => roadmapTasks.id),
  deliveredAt: timestamp("delivered_at"),
  displayOrder: integer("display_order").notNull().default(0),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueSourceKey: uniqueIndex("admin_executive_updates_source_key_uq").on(table.sourceKey),
}));

export const executiveEvidence = pgTable("admin_executive_evidence", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  executiveUpdateId: varchar("executive_update_id").notNull().references(() => executiveUpdates.id),
  evidenceType: executiveEvidenceTypeEnum("evidence_type").notNull().default("note"),
  label: text("label").notNull(),
  value: text("value").notNull(),
  metadataJson: jsonb("metadata_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// === Analysis Tables (backbone telemetry) ===
export const analysisVersions = pgTable("admin_analysis_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resourceId: text("resource_id").notNull(),
  module: text("module").notNull(),
  version: integer("version").notNull(),
  payloadJson: jsonb("payload_json").notNull(),
  itemCount: integer("item_count").notNull().default(0),
  trigger: text("trigger").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const analysisRuns = pgTable("admin_analysis_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resourceId: text("resource_id").notNull(),
  module: text("module").notNull(),
  action: text("action").notNull(),
  success: integer("success").notNull().default(1),
  durationMs: integer("duration_ms").notNull().default(0),
  itemCount: integer("item_count").notNull().default(0),
  errorMessage: text("error_message"),
  metadataJson: jsonb("metadata_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
