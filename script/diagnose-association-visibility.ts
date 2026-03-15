import { and, eq, ilike } from "drizzle-orm";
import { db } from "../server/db";
import { adminAssociationScopes, adminUsers, associations, authUsers, portalAccess } from "../shared/schema";

async function main() {
  const email = (process.argv[2] || "chcmgmt18@gmail.com").trim().toLowerCase();
  const associationQuery = (process.argv[3] || "Cherry Hill Court").trim();

  const matchingAssociations = await db
    .select()
    .from(associations)
    .where(ilike(associations.name, `%${associationQuery}%`));

  const [adminUser] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, email))
    .limit(1);

  const authUserMatches = await db
    .select()
    .from(authUsers)
    .where(eq(authUsers.email, email));

  const adminScopes = adminUser
    ? await db
      .select({ associationId: adminAssociationScopes.associationId, scope: adminAssociationScopes.scope })
      .from(adminAssociationScopes)
      .where(eq(adminAssociationScopes.adminUserId, adminUser.id))
    : [];

  const portalRows = await db
    .select()
    .from(portalAccess)
    .where(eq(portalAccess.email, email));

  const scopedAssociationIds = new Set(adminScopes.map((scope) => scope.associationId));
  const scopedAssociations = matchingAssociations.filter((association) => scopedAssociationIds.has(association.id));

  console.log(JSON.stringify({
    runtime: {
      nodeEnv: process.env.NODE_ENV || null,
      dbHost: (() => {
        try {
          return new URL(process.env.DATABASE_URL || "").host;
        } catch {
          return null;
        }
      })(),
    },
    email,
    associationQuery,
    checks: {
      matchingAssociations: matchingAssociations.map((association) => ({
        id: association.id,
        name: association.name,
        isArchived: association.isArchived,
      })),
      adminUser: adminUser
        ? { id: adminUser.id, email: adminUser.email, role: adminUser.role, isActive: adminUser.isActive }
        : null,
      adminScopes,
      matchingAssociationsInAdminScope: scopedAssociations.map((association) => ({
        id: association.id,
        name: association.name,
      })),
      authUsersByExactEmail: authUserMatches.map((authUser) => ({
        id: authUser.id,
        email: authUser.email,
        adminUserId: authUser.adminUserId,
        isActive: authUser.isActive,
      })),
      authUsersLinkedToAdmin: adminUser
        ? await db
          .select()
          .from(authUsers)
          .where(eq(authUsers.adminUserId, adminUser.id))
        : [],
      portalAccessByEmail: portalRows.map((portal) => ({
        id: portal.id,
        associationId: portal.associationId,
        role: portal.role,
        status: portal.status,
      })),
    },
    assessment: {
      canAppearInAdminAssociationsList: Boolean(adminUser && adminUser.isActive === 1 && scopedAssociations.length > 0),
      likelyFailure:
        !matchingAssociations.length
          ? "Association row not found"
          : !adminUser
            ? "Admin user missing for email"
            : adminUser.isActive !== 1
              ? "Admin user inactive"
              : scopedAssociations.length === 0
                ? "Admin scope missing for target association"
                : "Core database links are present; remaining issue is likely runtime environment mismatch or stale frontend auth/session headers",
    },
  }, null, 2));
}

main().catch((error) => {
  console.error("Failed to diagnose association visibility:", error);
  process.exit(1);
});
