import { db } from "../server/db";
import { persons, portalAccess } from "../shared/schema";
import { ilike, or, eq } from "drizzle-orm";

async function run() {
  const results = await db.select().from(persons).where(
    or(
      ilike(persons.firstName, "%william%"),
      ilike(persons.lastName, "%ruiz%")
    )
  );
  console.log("Persons found:", JSON.stringify(results, null, 2));

  if (results.length > 0) {
    for (const person of results) {
      const access = await db.select().from(portalAccess).where(eq(portalAccess.personId, person.id));
      console.log(`Portal access for ${person.firstName} ${person.lastName}:`, JSON.stringify(access, null, 2));
    }
  }
}

run().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
