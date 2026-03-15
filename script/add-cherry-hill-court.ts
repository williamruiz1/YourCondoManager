import { db } from "../server/db";
import { associations, persons, portalAccess } from "@shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const email = "chcmgmt18@gmail.com";
  const [existingAssociation] = await db.select().from(associations).where(eq(associations.name, "Cherry Hill Court")).limit(1);

  const association =
    existingAssociation ||
    (
      await db
        .insert(associations)
        .values({
          name: "Cherry Hill Court",
          associationType: "condo",
          address: "101 Cherry Hill Court",
          city: "Cherry Hill",
          state: "NJ",
          country: "USA",
        })
        .returning()
    )[0];

  const [existingPerson] = await db.select().from(persons).where(eq(persons.email, email)).limit(1);
  const person =
    existingPerson ||
    (
      await db
        .insert(persons)
        .values({
          firstName: "CHC",
          lastName: "Management",
          email,
        })
        .returning()
    )[0];

  const [existingPortal] = await db
    .select()
    .from(portalAccess)
    .where(eq(portalAccess.associationId, association.id))
    .where(eq(portalAccess.email, email))
    .limit(1);

  if (!existingPortal) {
    await db.insert(portalAccess).values({
      associationId: association.id,
      personId: person.id,
      email,
      role: "board-member",
      status: "active",
      invitedBy: "system",
      invitedAt: new Date(),
      acceptedAt: new Date(),
    });
  }

  console.log(`Association ${association.name} linked to ${email}`);
}

main().catch((error) => {
  console.error("Failed to add Cherry Hill Court association:", error);
  process.exit(1);
});
