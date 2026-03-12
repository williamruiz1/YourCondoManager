import fs from "fs";

function read(path: string) {
  return fs.readFileSync(path, "utf8");
}

function assertContains(content: string, token: string, message: string) {
  if (!content.includes(token)) throw new Error(message);
}

function run() {
  const schema = read("shared/schema.ts");
  const routes = read("server/routes.ts");
  const storage = read("server/storage.ts");
  const comms = read("client/src/pages/communications.tsx");
  const platform = read("client/src/pages/platform-controls.tsx");
  const app = read("client/src/App.tsx");

  assertContains(schema, "noticeTemplates", "missing noticeTemplates schema");
  assertContains(schema, "noticeSends", "missing noticeSends schema");
  assertContains(schema, "communicationHistory", "missing communicationHistory schema");
  assertContains(schema, "permissionEnvelopes", "missing permissionEnvelopes schema");
  assertContains(schema, "adminAssociationScopes", "missing adminAssociationScopes schema");

  assertContains(routes, '"/api/communications/templates"', "missing communications template routes");
  assertContains(routes, '"/api/communications/send"', "missing communications send route");
  assertContains(routes, '"/api/communications/history"', "missing communications history route");
  assertContains(routes, '"/api/platform/permission-envelopes"', "missing permission envelope routes");
  assertContains(routes, '"/api/platform/admin-association-scopes"', "missing admin association scope routes");

  assertContains(storage, "sendNotice(", "missing sendNotice persistence logic");
  assertContains(storage, "getCommunicationHistory", "missing communication history storage method");
  assertContains(storage, "upsertAdminAssociationScope", "missing admin association scope storage method");

  assertContains(comms, "Send Notice", "communications send UI missing");
  assertContains(comms, "New Template", "template creation UI missing");
  assertContains(comms, "audit communication history", "communications audit UI missing");

  assertContains(platform, "Permission Envelope", "permission envelope UI missing");
  assertContains(platform, "Multi-Association Data Isolation Foundation", "association isolation UI missing");

  assertContains(app, 'path="/communications"', "communications route missing in app");
  assertContains(app, 'path="/platform/controls"', "platform controls route missing in app");

  console.log("Phase 5 expansion verification checks passed.");
}

try {
  run();
} catch (error: any) {
  console.error(`Verification failed: ${error.message}`);
  process.exit(1);
}
