import fs from "fs";

function read(path: string) {
  return fs.readFileSync(path, "utf8");
}

function assertContains(content: string, token: string, message: string) {
  if (!content.includes(token)) {
    throw new Error(message);
  }
}

function run() {
  const schema = read("shared/schema.ts");
  const routes = read("server/routes.ts");
  const meetings = read("client/src/pages/meetings.tsx");
  const compliance = read("client/src/pages/governance-compliance.tsx");
  const app = read("client/src/App.tsx");
  const sidebar = read("client/src/components/app-sidebar.tsx");

  assertContains(schema, "governanceMeetings", "missing governance meetings schema");
  assertContains(schema, "governanceComplianceTemplates", "missing compliance templates schema");
  assertContains(schema, "annualGovernanceTasks", "missing annual governance tasks schema");

  assertContains(routes, '"/api/governance/meetings"', "missing meetings routes");
  assertContains(routes, '"/api/governance/templates"', "missing templates routes");
  assertContains(routes, '"/api/governance/tasks"', "missing governance task routes");
  assertContains(routes, '"/api/governance/tasks/generate"', "missing template task generation route");

  assertContains(meetings, "Edit Notes", "meeting notes edit action missing");
  assertContains(meetings, "Publish Summary", "publish summary action missing");
  assertContains(meetings, "New Budget Meeting", "budget meeting workflow action missing");

  assertContains(compliance, "Compliance Kanban", "kanban visibility section missing");
  assertContains(compliance, "Overdue", "compliance dashboard overdue metric missing");
  assertContains(compliance, "Generate Year Tasks", "annual task generation action missing");

  assertContains(app, 'path="/governance/meetings"', "meetings route missing in app router");
  assertContains(app, 'path="/governance/compliance"', "compliance route missing in app router");
  assertContains(sidebar, 'url: "/governance/meetings"', "meetings link missing in sidebar");
  assertContains(sidebar, 'url: "/governance/compliance"', "compliance link missing in sidebar");

  console.log("Phase 3 governance verification checks passed.");
}

try {
  run();
} catch (error: any) {
  console.error(`Verification failed: ${error.message}`);
  process.exit(1);
}
