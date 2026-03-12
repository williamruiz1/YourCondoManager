import fs from "fs";
import { randomUUID } from "crypto";
import { storage } from "../server/storage";

function assertCheck(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function read(path: string) {
  return fs.readFileSync(path, "utf8");
}

async function verifyCodeCoverage() {
  const schema = read("shared/schema.ts");
  const routes = read("server/routes.ts");
  const app = read("client/src/App.tsx");
  const sidebar = read("client/src/components/app-sidebar.tsx");
  const page = read("client/src/pages/financial-budgets.tsx");

  assertCheck(schema.includes("export const budgets"), "missing budgets schema");
  assertCheck(schema.includes("export const budgetVersions"), "missing budgetVersions schema");
  assertCheck(schema.includes("export const budgetLines"), "missing budgetLines schema");

  assertCheck(routes.includes('"/api/financial/budgets"'), "missing budgets routes");
  assertCheck(routes.includes('"/api/financial/budget-versions"'), "missing budget versions routes");
  assertCheck(routes.includes('"/api/financial/budget-lines"'), "missing budget lines routes");
  assertCheck(routes.includes('"/api/financial/budgets/:associationId/variance/:budgetVersionId"'), "missing variance route");

  assertCheck(app.includes('path="/financial/budgets"'), "missing financial budgets app route");
  assertCheck(sidebar.includes('url: "/financial/budgets"'), "missing financial budgets nav link");

  assertCheck(page.includes("Mark Ratified"), "missing ratification action in budget page");
  assertCheck(page.includes("budget-vs-actual variance"), "missing budget variance UX context");
}

async function verifyRuntime() {
  const marker = randomUUID();
  const actor = `m2-verify-${Date.now()}@local`;

  const association = await storage.createAssociation(
    {
      name: `M2 Verify ${marker}`,
      address: "2 Budget Lane",
      city: "New Haven",
      state: "CT",
      country: "USA",
    },
    actor,
  );

  const account = await storage.createFinancialAccount({
    associationId: association.id,
    name: `Utilities ${marker.slice(0, 4)}`,
    accountCode: "6100",
    accountType: "expense",
    isActive: 1,
  });

  const category = await storage.createFinancialCategory({
    associationId: association.id,
    name: `Water ${marker.slice(0, 4)}`,
    categoryType: "expense",
    isActive: 1,
  });

  const budget = await storage.createBudget({
    associationId: association.id,
    name: `FY ${new Date().getFullYear()} Budget`,
    fiscalYear: new Date().getFullYear(),
    periodStart: new Date("2026-01-01T00:00:00.000Z"),
    periodEnd: new Date("2026-12-31T23:59:59.000Z"),
  });

  const version = await storage.createBudgetVersion({
    budgetId: budget.id,
    versionNumber: 1,
    status: "draft",
    notes: "runtime verify",
  });

  const line = await storage.createBudgetLine({
    budgetVersionId: version.id,
    accountId: account.id,
    categoryId: category.id,
    lineItemName: "Water Utilities",
    plannedAmount: 1200,
    sortOrder: 1,
  });

  const updatedVersion = await storage.updateBudgetVersion(version.id, { status: "ratified" });
  assertCheck(updatedVersion?.status === "ratified", "budget version should be ratified");

  await storage.createVendorInvoice({
    associationId: association.id,
    vendorName: "City Water",
    invoiceNumber: null,
    invoiceDate: new Date(),
    dueDate: null,
    amount: 300,
    status: "received",
    accountId: account.id,
    categoryId: category.id,
    notes: null,
  });

  await storage.createUtilityPayment({
    associationId: association.id,
    utilityType: "Water",
    providerName: "City Water",
    servicePeriodStart: new Date(),
    servicePeriodEnd: new Date(),
    dueDate: new Date(),
    paidDate: null,
    amount: 150,
    status: "due",
    accountId: account.id,
    categoryId: category.id,
    notes: null,
  });

  const variance = await storage.getBudgetVariance(association.id, version.id);
  const matched = variance.find((v) => v.budgetLineId === line.id);
  assertCheck(Boolean(matched), "variance row should exist for budget line");
  assertCheck((matched?.actualAmount || 0) >= 450, "actual amount should include invoice + utility totals");
}

async function run() {
  await verifyCodeCoverage();
  await verifyRuntime();
  console.log("Phase 2 gap-closure verification checks passed.");
}

run().catch((error) => {
  console.error(`Verification failed: ${error.message}`);
  process.exit(1);
});
