import { and, eq, ne } from "drizzle-orm";
import { db } from "../server/db";
import { adminAssociationScopes, adminUsers, authUsers } from "../shared/schema";

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

async function enforceSingleAdmin(rawEmail: string) {
  const targetEmail = normalizeEmail(rawEmail);
  if (!targetEmail) {
    throw new Error("Target admin email is required");
  }

  await db.transaction(async (tx) => {
    let [targetAdmin] = await tx
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, targetEmail));

    if (!targetAdmin) {
      [targetAdmin] = await tx
        .insert(adminUsers)
        .values({
          email: targetEmail,
          role: "platform-admin",
          isActive: 1,
        })
        .returning();
      console.log(`Created target admin user: ${targetEmail}`);
    } else {
      [targetAdmin] = await tx
        .update(adminUsers)
        .set({
          role: "platform-admin",
          isActive: 1,
          updatedAt: new Date(),
        })
        .where(eq(adminUsers.id, targetAdmin.id))
        .returning();
      console.log(`Updated target admin user: ${targetEmail}`);
    }

    const deactivated = await tx
      .update(adminUsers)
      .set({
        isActive: 0,
        updatedAt: new Date(),
      })
      .where(ne(adminUsers.id, targetAdmin.id))
      .returning({ id: adminUsers.id, email: adminUsers.email });

    await tx
      .delete(adminAssociationScopes)
      .where(ne(adminAssociationScopes.adminUserId, targetAdmin.id));

    await tx
      .update(authUsers)
      .set({
        adminUserId: null,
        updatedAt: new Date(),
      })
      .where(and(ne(authUsers.adminUserId, targetAdmin.id), ne(authUsers.adminUserId, null)));

    const [targetAuthUser] = await tx
      .select()
      .from(authUsers)
      .where(eq(authUsers.email, targetEmail));

    if (targetAuthUser) {
      await tx
        .update(authUsers)
        .set({
          adminUserId: targetAdmin.id,
          updatedAt: new Date(),
        })
        .where(eq(authUsers.id, targetAuthUser.id));
      console.log(`Linked target auth user to admin profile: ${targetEmail}`);
    }

    console.log(`Deactivated ${deactivated.length} non-target admin users`);
  });
}

async function main() {
  const cliEmail = process.argv[2] || "";
  const envEmail = process.env.TARGET_ADMIN_EMAIL || "";
  const targetEmail = cliEmail || envEmail;
  if (!targetEmail) {
    throw new Error("Usage: npx tsx script/enforce-single-admin.ts <target-admin-email>");
  }

  await enforceSingleAdmin(targetEmail);
  console.log("Single-admin enforcement complete.");
}

main().catch((error: any) => {
  console.error(`Single-admin enforcement failed: ${error.message}`);
  process.exit(1);
});
