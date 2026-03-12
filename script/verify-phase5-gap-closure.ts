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
  const platform = read("client/src/pages/platform-controls.tsx");
  const portal = read("client/src/pages/owner-portal.tsx");
  const app = read("client/src/App.tsx");

  assertCheck(schema.includes("export const portalAccess"), "missing portalAccess schema");
  assertCheck(schema.includes("export const associationMemberships"), "missing associationMemberships schema");
  assertCheck(schema.includes("export const tenantConfigs"), "missing tenantConfigs schema");
  assertCheck(schema.includes("export const emailThreads"), "missing emailThreads schema");
  assertCheck(schema.includes("export const contactUpdateRequests"), "missing contactUpdateRequests schema");
  assertCheck(schema.includes("isPortalVisible"), "missing document portal visibility fields");

  assertCheck(routes.includes('"/api/portal/session"'), "missing portal session route");
  assertCheck(routes.includes('"/api/portal/documents"'), "missing portal document route");
  assertCheck(routes.includes('"/api/portal/contact-updates"'), "missing portal contact update routes");
  assertCheck(routes.includes('"/api/platform/tenant-config"'), "missing tenant config routes");
  assertCheck(routes.includes('"/api/platform/email-threads"'), "missing email thread route");

  assertCheck(platform.includes("Owner Portal Access and Memberships"), "missing portal provisioning UI");
  assertCheck(platform.includes("Owner-Safe Document Access and Contact Moderation"), "missing moderation/visibility UI");
  assertCheck(portal.includes("Owner Portal"), "missing owner portal shell");
  assertCheck(portal.includes("Submit Update Request"), "missing owner contact update workflow");
  assertCheck(app.includes('path="/portal"'), "missing owner portal route");
}

async function verifyRuntime() {
  const marker = randomUUID().slice(0, 8);
  const actor = `m5-verify-${Date.now()}@local`;

  const associationA = await storage.createAssociation({
    name: `M5 A ${marker}`,
    address: "500 A Street",
    city: "Boston",
    state: "MA",
    country: "USA",
  }, actor);
  const associationB = await storage.createAssociation({
    name: `M5 B ${marker}`,
    address: "501 B Street",
    city: "Boston",
    state: "MA",
    country: "USA",
  }, actor);

  const personA = await storage.createPerson({
    firstName: "Owner",
    lastName: "A",
    email: `owner-a-${marker}@local`,
    phone: null,
    mailingAddress: "Old Address",
  }, actor);
  const personB = await storage.createPerson({
    firstName: "Owner",
    lastName: "B",
    email: `owner-b-${marker}@local`,
    phone: null,
    mailingAddress: null,
  }, actor);

  const unitA = await storage.createUnit({ associationId: associationA.id, unitNumber: `A-${marker}` }, actor);
  const unitB = await storage.createUnit({ associationId: associationB.id, unitNumber: `B-${marker}` }, actor);

  await storage.upsertAssociationMembership({
    associationId: associationA.id,
    personId: personA.id,
    unitId: unitA.id,
    membershipType: "owner",
    status: "active",
    isPrimary: 1,
  });

  const accessA = await storage.createPortalAccess({
    associationId: associationA.id,
    personId: personA.id,
    unitId: unitA.id,
    email: personA.email || `owner-a-${marker}@local`,
    role: "owner",
    status: "active",
  });

  await storage.createPortalAccess({
    associationId: associationB.id,
    personId: personB.id,
    unitId: unitB.id,
    email: personB.email || `owner-b-${marker}@local`,
    role: "owner",
    status: "active",
  });

  const docA = await storage.createDocument({
    associationId: associationA.id,
    title: "Owner Packet A",
    fileUrl: "/api/uploads/a.pdf",
    documentType: "Bylaws",
    isPortalVisible: 1,
    portalAudience: "owner",
    uploadedBy: actor,
  }, actor);
  await storage.createDocument({
    associationId: associationB.id,
    title: "Owner Packet B",
    fileUrl: "/api/uploads/b.pdf",
    documentType: "Bylaws",
    isPortalVisible: 1,
    portalAudience: "owner",
    uploadedBy: actor,
  }, actor);

  const portalDocsA = await storage.getPortalDocuments(accessA.id);
  assertCheck(portalDocsA.some((d) => d.id === docA.id), "portal user should see in-scope owner-safe docs");
  assertCheck(portalDocsA.every((d) => d.associationId === associationA.id), "portal docs must be tenant-isolated");

  await storage.upsertTenantConfig({
    associationId: associationA.id,
    portalName: "A Portal",
    supportEmail: "support@a.local",
    allowContactUpdates: 1,
    ownerDocumentVisibility: "owner-safe",
    gmailIntegrationStatus: "foundation-ready",
    defaultNoticeFooter: "Thank you",
  });
  const tenantConfig = await storage.getTenantConfig(associationA.id);
  assertCheck(tenantConfig?.portalName === "A Portal", "tenant config should persist");

  await storage.sendNotice({
    associationId: associationA.id,
    recipientEmail: personA.email || "",
    recipientPersonId: personA.id,
    subject: "Portal Notice",
    body: "Budget meeting notice",
    sentBy: actor,
  });
  const threads = await storage.getEmailThreads(associationA.id);
  assertCheck(threads.length > 0, "email threads should track communications");

  const req = await storage.createContactUpdateRequest({
    associationId: associationA.id,
    portalAccessId: accessA.id,
    personId: personA.id,
    requestJson: { phone: "555-0101", mailingAddress: "New Address" },
  });
  const reviewed = await storage.reviewContactUpdateRequest(req.id, { reviewStatus: "approved", reviewedBy: actor });
  assertCheck(reviewed?.reviewStatus === "approved", "contact update request should be reviewable");

  const refreshedPerson = await storage.getPersons();
  const updatedPersonA = refreshedPerson.find((p) => p.id === personA.id);
  assertCheck(updatedPersonA?.phone === "555-0101", "approved contact update should apply to person record");
}

async function run() {
  await verifyCodeCoverage();
  await verifyRuntime();
  console.log("Phase 5 gap-closure verification checks passed.");
}

run().catch((error) => {
  console.error(`Verification failed: ${error.message}`);
  process.exit(1);
});
