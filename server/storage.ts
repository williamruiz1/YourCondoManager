import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  associations, units, persons, ownerships, occupancies, boardRoles, documents,
  type Association, type InsertAssociation,
  type Unit, type InsertUnit,
  type Person, type InsertPerson,
  type Ownership, type InsertOwnership,
  type Occupancy, type InsertOccupancy,
  type BoardRole, type InsertBoardRole,
  type Document, type InsertDocument,
} from "@shared/schema";

export interface IStorage {
  getAssociations(): Promise<Association[]>;
  createAssociation(data: InsertAssociation): Promise<Association>;
  updateAssociation(id: string, data: Partial<InsertAssociation>): Promise<Association | undefined>;

  getUnits(): Promise<Unit[]>;
  createUnit(data: InsertUnit): Promise<Unit>;
  updateUnit(id: string, data: Partial<InsertUnit>): Promise<Unit | undefined>;

  getPersons(): Promise<Person[]>;
  createPerson(data: InsertPerson): Promise<Person>;
  updatePerson(id: string, data: Partial<InsertPerson>): Promise<Person | undefined>;

  getOwnerships(): Promise<Ownership[]>;
  createOwnership(data: InsertOwnership): Promise<Ownership>;

  getOccupancies(): Promise<Occupancy[]>;
  createOccupancy(data: InsertOccupancy): Promise<Occupancy>;

  getBoardRoles(): Promise<BoardRole[]>;
  createBoardRole(data: InsertBoardRole): Promise<BoardRole>;

  getDocuments(): Promise<Document[]>;
  createDocument(data: InsertDocument): Promise<Document>;

  getDashboardStats(): Promise<{
    totalAssociations: number;
    totalUnits: number;
    totalOwners: number;
    totalTenants: number;
    totalBoardMembers: number;
    totalDocuments: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getAssociations(): Promise<Association[]> {
    return db.select().from(associations);
  }

  async createAssociation(data: InsertAssociation): Promise<Association> {
    const [result] = await db.insert(associations).values(data).returning();
    return result;
  }

  async updateAssociation(id: string, data: Partial<InsertAssociation>): Promise<Association | undefined> {
    const [result] = await db.update(associations).set(data).where(eq(associations.id, id)).returning();
    return result;
  }

  async getUnits(): Promise<Unit[]> {
    return db.select().from(units);
  }

  async createUnit(data: InsertUnit): Promise<Unit> {
    const [result] = await db.insert(units).values(data).returning();
    return result;
  }

  async updateUnit(id: string, data: Partial<InsertUnit>): Promise<Unit | undefined> {
    const [result] = await db.update(units).set(data).where(eq(units.id, id)).returning();
    return result;
  }

  async getPersons(): Promise<Person[]> {
    return db.select().from(persons);
  }

  async createPerson(data: InsertPerson): Promise<Person> {
    const [result] = await db.insert(persons).values(data).returning();
    return result;
  }

  async updatePerson(id: string, data: Partial<InsertPerson>): Promise<Person | undefined> {
    const [result] = await db.update(persons).set(data).where(eq(persons.id, id)).returning();
    return result;
  }

  async getOwnerships(): Promise<Ownership[]> {
    return db.select().from(ownerships);
  }

  async createOwnership(data: InsertOwnership): Promise<Ownership> {
    const [result] = await db.insert(ownerships).values(data).returning();
    return result;
  }

  async getOccupancies(): Promise<Occupancy[]> {
    return db.select().from(occupancies);
  }

  async createOccupancy(data: InsertOccupancy): Promise<Occupancy> {
    const [result] = await db.insert(occupancies).values(data).returning();
    return result;
  }

  async getBoardRoles(): Promise<BoardRole[]> {
    return db.select().from(boardRoles);
  }

  async createBoardRole(data: InsertBoardRole): Promise<BoardRole> {
    const [result] = await db.insert(boardRoles).values(data).returning();
    return result;
  }

  async getDocuments(): Promise<Document[]> {
    return db.select().from(documents);
  }

  async createDocument(data: InsertDocument): Promise<Document> {
    const [result] = await db.insert(documents).values(data).returning();
    return result;
  }

  async getDashboardStats() {
    const [allAssociations, allUnits, allOwnerships, allOccupancies, allBoardRoles, allDocuments] = await Promise.all([
      db.select().from(associations),
      db.select().from(units),
      db.select().from(ownerships),
      db.select().from(occupancies),
      db.select().from(boardRoles),
      db.select().from(documents),
    ]);

    const activeOwnerships = allOwnerships.filter((o) => !o.endDate);
    const activeTenants = allOccupancies.filter((o) => o.occupancyType === "TENANT" && !o.endDate);
    const activeBoardMembers = allBoardRoles.filter((b) => !b.endDate);

    return {
      totalAssociations: allAssociations.length,
      totalUnits: allUnits.length,
      totalOwners: activeOwnerships.length,
      totalTenants: activeTenants.length,
      totalBoardMembers: activeBoardMembers.length,
      totalDocuments: allDocuments.length,
    };
  }
}

export const storage = new DatabaseStorage();
