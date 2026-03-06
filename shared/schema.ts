import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const associations = pgTable("associations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  country: text("country").notNull().default("USA"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const units = pgTable("units", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  unitNumber: text("unit_number").notNull(),
  building: text("building"),
  squareFootage: real("square_footage"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const persons = pgTable("persons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  mailingAddress: text("mailing_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ownerships = pgTable("ownerships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  unitId: varchar("unit_id").notNull().references(() => units.id),
  personId: varchar("person_id").notNull().references(() => persons.id),
  ownershipPercentage: real("ownership_percentage").notNull().default(100),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
});

export const occupancyTypeEnum = pgEnum("occupancy_type", ["OWNER_OCCUPIED", "TENANT"]);

export const occupancies = pgTable("occupancies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  unitId: varchar("unit_id").notNull().references(() => units.id),
  personId: varchar("person_id").notNull().references(() => persons.id),
  occupancyType: occupancyTypeEnum("occupancy_type").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
});

export const boardRoles = pgTable("board_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  personId: varchar("person_id").notNull().references(() => persons.id),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  role: text("role").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
});

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  associationId: varchar("association_id").notNull().references(() => associations.id),
  title: text("title").notNull(),
  fileUrl: text("file_url").notNull(),
  documentType: text("document_type").notNull(),
  uploadedBy: text("uploaded_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAssociationSchema = createInsertSchema(associations).omit({ id: true, createdAt: true });
export const insertUnitSchema = createInsertSchema(units).omit({ id: true, createdAt: true });
export const insertPersonSchema = createInsertSchema(persons).omit({ id: true, createdAt: true });
export const insertOwnershipSchema = createInsertSchema(ownerships).omit({ id: true });
export const insertOccupancySchema = createInsertSchema(occupancies).omit({ id: true });
export const insertBoardRoleSchema = createInsertSchema(boardRoles).omit({ id: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true });

export type Association = typeof associations.$inferSelect;
export type InsertAssociation = z.infer<typeof insertAssociationSchema>;
export type Unit = typeof units.$inferSelect;
export type InsertUnit = z.infer<typeof insertUnitSchema>;
export type Person = typeof persons.$inferSelect;
export type InsertPerson = z.infer<typeof insertPersonSchema>;
export type Ownership = typeof ownerships.$inferSelect;
export type InsertOwnership = z.infer<typeof insertOwnershipSchema>;
export type Occupancy = typeof occupancies.$inferSelect;
export type InsertOccupancy = z.infer<typeof insertOccupancySchema>;
export type BoardRole = typeof boardRoles.$inferSelect;
export type InsertBoardRole = z.infer<typeof insertBoardRoleSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
