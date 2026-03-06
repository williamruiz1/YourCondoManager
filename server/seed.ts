import { db } from "./db";
import {
  associations, units, persons, ownerships, occupancies, boardRoles, documents,
} from "@shared/schema";
import { sql } from "drizzle-orm";

export async function seedDatabase() {
  const existingAssociations = await db.select().from(associations);
  if (existingAssociations.length > 0) return;

  const [a1, a2, a3] = await db.insert(associations).values([
    { name: "Sunset Towers", address: "1200 Ocean Drive", city: "Miami Beach", state: "FL", country: "USA" },
    { name: "Lakewood Residences", address: "450 Lakeview Blvd", city: "Chicago", state: "IL", country: "USA" },
    { name: "Pacific Heights Condos", address: "789 Bay Street", city: "San Francisco", state: "CA", country: "USA" },
  ]).returning();

  const unitRows = await db.insert(units).values([
    { associationId: a1.id, unitNumber: "101", building: "A", squareFootage: 1250 },
    { associationId: a1.id, unitNumber: "102", building: "A", squareFootage: 980 },
    { associationId: a1.id, unitNumber: "201", building: "B", squareFootage: 1400 },
    { associationId: a1.id, unitNumber: "301", building: "B", squareFootage: 1600 },
    { associationId: a2.id, unitNumber: "1A", building: "Main", squareFootage: 1100 },
    { associationId: a2.id, unitNumber: "2A", building: "Main", squareFootage: 1100 },
    { associationId: a2.id, unitNumber: "3B", building: "East", squareFootage: 1350 },
    { associationId: a3.id, unitNumber: "PH1", building: null, squareFootage: 2200 },
    { associationId: a3.id, unitNumber: "501", building: null, squareFootage: 1050 },
  ]).returning();

  const personRows = await db.insert(persons).values([
    { firstName: "Maria", lastName: "Gonzalez", email: "maria.gonzalez@email.com", phone: "(305) 555-0101", mailingAddress: "1200 Ocean Drive Unit 101, Miami Beach, FL 33139" },
    { firstName: "James", lastName: "Chen", email: "j.chen@email.com", phone: "(305) 555-0102", mailingAddress: "1200 Ocean Drive Unit 102, Miami Beach, FL 33139" },
    { firstName: "Sarah", lastName: "Williams", email: "sarah.w@email.com", phone: "(312) 555-0201", mailingAddress: "450 Lakeview Blvd Unit 1A, Chicago, IL 60601" },
    { firstName: "Robert", lastName: "Thompson", email: "r.thompson@email.com", phone: "(415) 555-0301", mailingAddress: "789 Bay Street PH1, San Francisco, CA 94133" },
    { firstName: "Lisa", lastName: "Patel", email: "lisa.patel@email.com", phone: "(312) 555-0202", mailingAddress: "450 Lakeview Blvd Unit 3B, Chicago, IL 60601" },
    { firstName: "David", lastName: "Kim", email: "d.kim@email.com", phone: "(305) 555-0103", mailingAddress: null },
    { firstName: "Jennifer", lastName: "Martinez", email: "j.martinez@email.com", phone: "(415) 555-0302", mailingAddress: "789 Bay Street Unit 501, San Francisco, CA 94133" },
  ]).returning();

  await db.insert(ownerships).values([
    { unitId: unitRows[0].id, personId: personRows[0].id, ownershipPercentage: 100, startDate: new Date("2020-03-15") },
    { unitId: unitRows[1].id, personId: personRows[1].id, ownershipPercentage: 100, startDate: new Date("2021-06-01") },
    { unitId: unitRows[2].id, personId: personRows[0].id, ownershipPercentage: 50, startDate: new Date("2022-01-10") },
    { unitId: unitRows[2].id, personId: personRows[1].id, ownershipPercentage: 50, startDate: new Date("2022-01-10") },
    { unitId: unitRows[4].id, personId: personRows[2].id, ownershipPercentage: 100, startDate: new Date("2019-08-20") },
    { unitId: unitRows[6].id, personId: personRows[4].id, ownershipPercentage: 100, startDate: new Date("2023-02-01") },
    { unitId: unitRows[7].id, personId: personRows[3].id, ownershipPercentage: 100, startDate: new Date("2018-11-05") },
    { unitId: unitRows[8].id, personId: personRows[6].id, ownershipPercentage: 100, startDate: new Date("2024-01-15") },
  ]);

  await db.insert(occupancies).values([
    { unitId: unitRows[0].id, personId: personRows[0].id, occupancyType: "OWNER_OCCUPIED", startDate: new Date("2020-03-15") },
    { unitId: unitRows[1].id, personId: personRows[5].id, occupancyType: "TENANT", startDate: new Date("2023-01-01") },
    { unitId: unitRows[4].id, personId: personRows[2].id, occupancyType: "OWNER_OCCUPIED", startDate: new Date("2019-08-20") },
    { unitId: unitRows[7].id, personId: personRows[3].id, occupancyType: "OWNER_OCCUPIED", startDate: new Date("2018-11-05") },
  ]);

  await db.insert(boardRoles).values([
    { personId: personRows[0].id, associationId: a1.id, role: "President", startDate: new Date("2023-01-01") },
    { personId: personRows[1].id, associationId: a1.id, role: "Treasurer", startDate: new Date("2023-01-01") },
    { personId: personRows[2].id, associationId: a2.id, role: "President", startDate: new Date("2022-06-01") },
    { personId: personRows[4].id, associationId: a2.id, role: "Secretary", startDate: new Date("2022-06-01") },
    { personId: personRows[3].id, associationId: a3.id, role: "President", startDate: new Date("2021-01-01") },
    { personId: personRows[6].id, associationId: a3.id, role: "Board Member", startDate: new Date("2024-01-15") },
  ]);

  console.log("Database seeded successfully");
}
