type Role = "owner" | "board" | "manager" | "admin" | "public" | "shared";

const viewportMatrix = ["320px", "375px", "390px", "430px", "768px"];

const journeys: Record<Role, string[]> = {
  owner: [
    "Login, OTP, and association selection",
    "Overview tabs and sticky header behavior",
    "Maintenance request submit and history review",
    "Financial statement, payment action, and transaction history",
    "Documents and notices message center",
  ],
  board: [
    "Board roster and board package review",
    "Meetings register, note editing, and summary publishing",
    "Resolution selection and vote recording",
    "Governance compliance template and task review",
  ],
  manager: [
    "Work-order filters, queue cards, and conversion flow",
    "Communications queues and dispatch approvals",
    "Operations dashboard recent work and audit review",
  ],
  admin: [
    "Workspace dashboard alerts and association context switching",
    "Payments tab navigation, event review, and exceptions",
    "Admin user role updates and board role review",
  ],
  public: [
    "Onboarding invite and intake forms",
    "Auth steps with keyboard visibility",
  ],
  shared: [
    "Workspace shell header, tabs, and safe-area behavior",
    "Dense table fallbacks changed in current release",
  ],
};

function normalizeRole(input: string | undefined): Role | "all" {
  if (!input) return "all";
  const lowered = input.toLowerCase();
  if (lowered === "all") return "all";
  if (lowered in journeys) return lowered as Role;
  throw new Error(`Unknown role "${input}". Expected one of: all, ${Object.keys(journeys).join(", ")}`);
}

function printRole(role: Role) {
  console.log(`\n${role.toUpperCase()}`);
  console.log("Viewports:");
  viewportMatrix.forEach((viewport) => console.log(`- ${viewport}`));
  console.log("Journeys:");
  journeys[role].forEach((journey) => console.log(`- ${journey}`));
}

function main() {
  const requestedRole = normalizeRole(process.argv[2]);

  console.log("Mobile manual verification runner");
  console.log("Use this output with docs/projects/mobile-test-checklist.md and docs/projects/mobile-release-gate.md.");

  if (requestedRole === "all") {
    (Object.keys(journeys) as Role[]).forEach(printRole);
    return;
  }

  printRole(requestedRole);
}

main();
