import fs from "fs";

function assertCheck(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function read(filePath: string) {
  return fs.readFileSync(filePath, "utf8");
}

function countMatches(content: string, pattern: RegExp) {
  const matches = content.match(pattern);
  return matches ? matches.length : 0;
}

async function run() {
  const routes = read("server/routes.ts");
  const docsPage = read("client/src/pages/documents.tsx");
  const app = read("client/src/App.tsx");
  const sidebar = read("client/src/components/app-sidebar.tsx");
  const adminUsersPage = read("client/src/pages/admin-users.tsx");
  const queryClient = read("client/src/lib/queryClient.ts");

  const protectedPhase1RouteCount = countMatches(
    routes,
    /app\.(get|post|patch)\("\/api\/(dashboard\/stats|associations|units|persons|ownerships|occupancies|board-roles|documents)[^"]*", requireAdmin/g,
  );
  assertCheck(protectedPhase1RouteCount >= 20, "Expected all Phase 1 CRUD endpoints to require admin middleware");

  assertCheck(!routes.includes("upsertAdminUser({ email: adminUserEmail"), "Auto-bootstrap admin path should not exist");
  assertCheck(routes.includes("storage.updateUnit(getParam(req.params.id), parsed, req.adminUserEmail)"), "Unit update must pass actor email");
  assertCheck(routes.includes("/api/documents/:id/tags"), "Document tag routes must exist");
  assertCheck(routes.includes("/api/documents/:id/versions"), "Document version routes must exist");

  assertCheck(queryClient.includes('!url.startsWith("/api/uploads")'), "API client should attach admin headers to /api calls except uploads");

  assertCheck(docsPage.includes("/api/documents/${selectedDocument.id}/tags"), "Documents UI must support tag creation");
  assertCheck(docsPage.includes("/api/documents/${selectedDocument.id}/versions"), "Documents UI must support version upload");
  assertCheck(docsPage.includes("Manage"), "Documents UI should expose manage action for metadata");

  assertCheck(app.includes('path="/admin/users"'), "Admin users route should be registered");
  assertCheck(sidebar.includes('url: "/admin/users"'), "Admin users link should exist in sidebar");
  assertCheck(adminUsersPage.includes("Role change reason is required"), "Admin users UI should enforce role-change reason");

  console.log("Phase 1 remediation verification checks passed.");
}

run().catch((error) => {
  console.error("Verification failed:", error.message);
  process.exit(1);
});
