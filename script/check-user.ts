import { db } from "../server/db";
import { adminUsers, authUsers, adminAssociationScopes } from "../shared/schema";
import { ilike } from "drizzle-orm";

async function main() {
  const email = "chcmgmt18@gmail.com";
  const [admin] = await db.select().from(adminUsers).where(ilike(adminUsers.email, email));
  const [auth] = await db.select().from(authUsers).where(ilike(authUsers.email, email));
  console.log("adminUser:", JSON.stringify(admin, null, 2));
  console.log("authUser:", JSON.stringify(auth, null, 2));
  if (admin) {
    const scopes = await db.select().from(adminAssociationScopes).where(
      (await import("drizzle-orm")).eq(adminAssociationScopes.adminUserId, admin.id)
    );
    console.log("scopes:", JSON.stringify(scopes, null, 2));
  }
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
