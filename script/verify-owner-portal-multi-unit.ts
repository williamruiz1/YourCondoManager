import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "../server/db";
import { storage } from "../server/storage";
import {
  associations,
  associationMemberships,
  auditLogs,
  boardRoles,
  communicationHistory,
  contactUpdateRequests,
  documentVersions,
  documents,
  maintenanceRequests,
  noticeSends,
  onboardingInvites,
  onboardingSubmissions,
  occupancies,
  ownerships,
  persons,
  personContactPoints,
  portalAccess,
  units,
} from "../shared/schema";

type ScenarioScope = {
  associationId: string;
  personIds: string[];
  unitIds: string[];
  boardRoleIds: string[];
  portalAccessIds: string[];
};

function assertCheck(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function read(path: string) {
  return fs.readFileSync(path, "utf8");
}

function uniqueEmail(prefix: string, marker: string) {
  return `${prefix}.${marker}@local`;
}

async function cleanup(scopes: ScenarioScope[], actorEmail: string) {
  const associationIds = Array.from(new Set(scopes.map((scope) => scope.associationId)));
  const personIds = Array.from(new Set(scopes.flatMap((scope) => scope.personIds)));
  const unitIds = Array.from(new Set(scopes.flatMap((scope) => scope.unitIds)));
  const boardRoleIds = Array.from(new Set(scopes.flatMap((scope) => scope.boardRoleIds)));
  const portalAccessIds = Array.from(new Set(scopes.flatMap((scope) => scope.portalAccessIds)));
  const documentIds = associationIds.length > 0
    ? (await db.select({ id: documents.id }).from(documents).where(inArray(documents.associationId, associationIds))).map((row) => row.id)
    : [];

  if (associationIds.length > 0) {
    await db.delete(communicationHistory).where(inArray(communicationHistory.associationId, associationIds));
    await db.delete(noticeSends).where(inArray(noticeSends.associationId, associationIds));
    await db.delete(contactUpdateRequests).where(inArray(contactUpdateRequests.associationId, associationIds));
    await db.delete(maintenanceRequests).where(inArray(maintenanceRequests.associationId, associationIds));
    await db.delete(onboardingSubmissions).where(inArray(onboardingSubmissions.associationId, associationIds));
    await db.delete(onboardingInvites).where(inArray(onboardingInvites.associationId, associationIds));
    if (documentIds.length > 0) {
      await db.delete(documentVersions).where(inArray(documentVersions.documentId, documentIds));
    }
    await db.delete(documents).where(inArray(documents.associationId, associationIds));
    await db.delete(associationMemberships).where(inArray(associationMemberships.associationId, associationIds));
    await db.delete(auditLogs).where(inArray(auditLogs.associationId, associationIds));
  }

  if (portalAccessIds.length > 0) {
    await db.delete(portalAccess).where(inArray(portalAccess.id, portalAccessIds));
  }

  if (boardRoleIds.length > 0) {
    await db.delete(boardRoles).where(inArray(boardRoles.id, boardRoleIds));
  }

  if (unitIds.length > 0) {
    await db.delete(ownerships).where(inArray(ownerships.unitId, unitIds));
    await db.delete(occupancies).where(inArray(occupancies.unitId, unitIds));
    await db.delete(units).where(inArray(units.id, unitIds));
  }

  if (personIds.length > 0) {
    await db.delete(personContactPoints).where(inArray(personContactPoints.personId, personIds));
    await db.delete(persons).where(inArray(persons.id, personIds));
  }

  if (associationIds.length > 0) {
    await db.delete(associations).where(inArray(associations.id, associationIds));
  }

  await db.delete(auditLogs).where(eq(auditLogs.actorEmail, actorEmail));
}

async function verifyCodeCoverage() {
  const portal = read("client/src/pages/owner-portal.tsx");
  const routes = read("server/routes.ts");

  // Multi-unit overview and unit focus
  assertCheck(portal.includes('queryKey: ["portal/my-units"]'), "missing owner-unit query wiring");
  assertCheck(portal.includes('queryKey: ["portal/units-balance"]'), "missing per-unit balance query wiring");
  assertCheck(portal.includes('queryKey: ["portal/board-dashboard"]'), "missing board dashboard query wiring");
  assertCheck(portal.includes("/api/portal/my-units"), "missing owner-unit endpoint usage");
  assertCheck(portal.includes("/api/portal/units-balance"), "missing units-balance endpoint usage");
  assertCheck(portal.includes("/api/portal/board/dashboard"), "missing board dashboard endpoint usage");
  assertCheck(portal.includes("Total Units"), "missing multi-unit overview summary");
  assertCheck(portal.includes("Select Unit"), "missing multi-unit financial unit selector");
  assertCheck(portal.includes("Current Statement"), "missing per-unit financial statement");
  assertCheck(portal.includes("Ledger Summary"), "missing owner ledger summary");
  assertCheck(portal.includes("Manage Payments"), "missing owner financial workspace");

  // Financial surfaces — ledger, financial dashboard, payment history
  assertCheck(portal.includes('queryKey: ["portal/ledger"]'), "missing ledger query wiring");
  assertCheck(portal.includes('queryKey: ["portal/financial-dashboard"]'), "missing financial-dashboard query wiring");
  assertCheck(portal.includes("/api/portal/ledger"), "missing ledger endpoint usage");
  assertCheck(portal.includes("/api/portal/financial-dashboard"), "missing financial-dashboard endpoint usage");
  assertCheck(portal.includes("Payment History"), "missing payment history section in financials tab");

  // Elections surface
  assertCheck(portal.includes('queryKey: ["portal/elections"]'), "missing elections query wiring");
  assertCheck(portal.includes("/api/portal/elections"), "missing elections endpoint usage");

  // Maintenance request surface
  assertCheck(portal.includes('queryKey: ["portal/maintenance-requests"]'), "missing maintenance-requests query wiring");
  assertCheck(portal.includes("/api/portal/maintenance-requests"), "missing maintenance-requests endpoint usage");

  assertCheck(routes.includes('"/api/portal/my-units"'), "missing portal multi-unit route");
  assertCheck(routes.includes('"/api/portal/units-balance"'), "missing portal balance route");
  assertCheck(routes.includes('"/api/portal/board/dashboard"'), "missing portal board dashboard route");
  assertCheck(routes.includes('"/api/portal/ledger"'), "missing portal ledger route");
  assertCheck(routes.includes('"/api/portal/financial-dashboard"'), "missing portal financial-dashboard route");
  assertCheck(routes.includes('"/api/portal/elections"'), "missing portal elections route");
  assertCheck(routes.includes('"/api/portal/maintenance-requests"'), "missing portal maintenance-requests route");
  assertCheck(routes.includes("requirePortalBoard"), "missing board route guard");
  assertCheck(routes.includes("resolvePortalAccessContext"), "missing portal access resolution");
  assertCheck(routes.includes("getOwnedPortalUnitsForAssociation"), "missing owned-unit resolver");
}

async function createSingleUnitScenario(actorEmail: string, marker: string): Promise<ScenarioScope> {
  const association = await storage.createAssociation({
    name: `Owner Journey Single ${marker}`,
    associationType: "condo",
    address: "100 Single Way",
    city: "Hartford",
    state: "CT",
    country: "USA",
  }, actorEmail);
  const person = await storage.createPerson({
    firstName: "Single",
    lastName: `Owner${marker}`,
    email: uniqueEmail("single.owner", marker),
    phone: "555-0101",
    mailingAddress: "100 Single Way",
  }, actorEmail);
  const unit = await storage.createUnit({
    associationId: association.id,
    unitNumber: "101",
    building: "A",
    squareFootage: 1200,
  }, actorEmail);
  await storage.createOwnership({
    unitId: unit.id,
    personId: person.id,
    ownershipPercentage: 100,
    startDate: new Date("2024-01-01"),
    endDate: null,
  }, actorEmail);

  const portal = await storage.createPortalAccess({
    associationId: association.id,
    personId: person.id,
    unitId: unit.id,
    email: person.email || uniqueEmail("single.owner", marker),
    role: "owner",
    status: "active",
  }, actorEmail);

  const visibleDoc = await storage.createDocument({
    associationId: association.id,
    title: `Single Visible ${marker}`,
    fileUrl: `/fixtures/single-visible-${marker}.pdf`,
    documentType: "notice",
    isPortalVisible: 1,
    portalAudience: "owner",
    uploadedBy: actorEmail,
  }, actorEmail);
  await storage.createDocument({
    associationId: association.id,
    title: `Single Internal ${marker}`,
    fileUrl: `/fixtures/single-internal-${marker}.pdf`,
    documentType: "board",
    isPortalVisible: 0,
    portalAudience: "board",
    uploadedBy: actorEmail,
  }, actorEmail);

  const notice = await storage.sendNotice({
    associationId: association.id,
    recipientEmail: person.email || uniqueEmail("single.owner", marker),
    recipientPersonId: person.id,
    recipientRole: "owner",
    subject: `Single-unit notice ${marker}`,
    body: "Single-unit owner journey verification notice.",
    requireApproval: true,
    bypassReadinessGate: true,
    sentBy: actorEmail,
  });

  const maintenanceRequest = await storage.createMaintenanceRequest({
    associationId: association.id,
    unitId: unit.id,
    submittedByPersonId: person.id,
    submittedByPortalAccessId: portal.id,
    submittedByEmail: person.email || uniqueEmail("single.owner", marker),
    title: `Single-unit maintenance ${marker}`,
    description: "Verify the portal can submit and recall an owner maintenance request.",
    locationText: "Unit 101",
    category: "general",
    priority: "medium",
    status: "submitted",
    attachmentUrlsJson: [],
  });

  const resolved = await storage.resolvePortalAccessContext(portal.id);
  assertCheck(Boolean(resolved), "single-unit owner access did not resolve");
  assertCheck(resolved?.effectiveRole === "owner", "single-unit owner should resolve to owner role");
  assertCheck(resolved?.hasBoardAccess === false, "single-unit owner should not have board access");

  const activeAccesses = await storage.getPortalAccessesByEmail(person.email || uniqueEmail("single.owner", marker));
  assertCheck(activeAccesses.filter((row) => row.status === "active").length === 1, "single-unit owner should have one active portal access");

  const docs = await storage.getPortalDocuments(portal.id);
  assertCheck(docs.length === 1, "single-unit owner should only see portal-visible documents");
  assertCheck(docs[0].id === visibleDoc.id, "single-unit owner should see the visible document");

  const histories = await storage.getPortalCommunicationHistory(portal.id);
  assertCheck(histories.length === 2, "single-unit owner should see notice and maintenance history");
  assertCheck(histories.some((item) => item.subject.includes("Single-unit notice")), "single-unit owner should see the expected notice");
  assertCheck(histories.some((item) => item.subject.includes("Maintenance request")), "single-unit owner should see the maintenance history");

  const maintenance = await storage.getMaintenanceRequests({ portalAccessId: portal.id });
  assertCheck(maintenance.length === 1, "single-unit owner should see one maintenance request");
  assertCheck(maintenance[0].id === maintenanceRequest.id, "single-unit maintenance request should round-trip by portal access");

  return {
    associationId: association.id,
    personIds: [person.id],
    unitIds: [unit.id],
    boardRoleIds: [],
    portalAccessIds: [portal.id],
  };
}

async function createMultiUnitScenario(actorEmail: string, marker: string): Promise<ScenarioScope> {
  const association = await storage.createAssociation({
    name: `Owner Journey Multi ${marker}`,
    associationType: "condo",
    address: "200 Multi Way",
    city: "New Haven",
    state: "CT",
    country: "USA",
  }, actorEmail);
  const person = await storage.createPerson({
    firstName: "Multi",
    lastName: `Owner${marker}`,
    email: uniqueEmail("multi.owner", marker),
    phone: "555-0202",
    mailingAddress: "200 Multi Way",
  }, actorEmail);
  const unitOne = await storage.createUnit({
    associationId: association.id,
    unitNumber: "201",
    building: "B",
    squareFootage: 900,
  }, actorEmail);
  const unitTwo = await storage.createUnit({
    associationId: association.id,
    unitNumber: "202",
    building: "B",
    squareFootage: 1100,
  }, actorEmail);

  await storage.createOwnership({
    unitId: unitOne.id,
    personId: person.id,
    ownershipPercentage: 50,
    startDate: new Date("2024-01-01"),
    endDate: null,
  }, actorEmail);
  await storage.createOwnership({
    unitId: unitTwo.id,
    personId: person.id,
    ownershipPercentage: 50,
    startDate: new Date("2024-01-01"),
    endDate: null,
  }, actorEmail);

  const portalOne = await storage.createPortalAccess({
    associationId: association.id,
    personId: person.id,
    unitId: unitOne.id,
    email: person.email || uniqueEmail("multi.owner", marker),
    role: "owner",
    status: "active",
  }, actorEmail);
  const portalTwo = await storage.createPortalAccess({
    associationId: association.id,
    personId: person.id,
    unitId: unitTwo.id,
    email: person.email || uniqueEmail("multi.owner", marker),
    role: "owner",
    status: "active",
  }, actorEmail);

  await storage.createDocument({
    associationId: association.id,
    title: `Multi Visible ${marker}`,
    fileUrl: `/fixtures/multi-visible-${marker}.pdf`,
    documentType: "notice",
    isPortalVisible: 1,
    portalAudience: "owner",
    uploadedBy: actorEmail,
  }, actorEmail);
  await storage.createDocument({
    associationId: association.id,
    title: `Multi Internal ${marker}`,
    fileUrl: `/fixtures/multi-internal-${marker}.pdf`,
    documentType: "board",
    isPortalVisible: 0,
    portalAudience: "board",
    uploadedBy: actorEmail,
  }, actorEmail);

  const maintenanceOne = await storage.createMaintenanceRequest({
    associationId: association.id,
    unitId: unitOne.id,
    submittedByPersonId: person.id,
    submittedByPortalAccessId: portalOne.id,
    submittedByEmail: person.email || uniqueEmail("multi.owner", marker),
    title: `Multi-unit maintenance 1 ${marker}`,
    description: "First multi-unit maintenance request.",
    locationText: "Unit 201",
    category: "general",
    priority: "medium",
    status: "submitted",
    attachmentUrlsJson: [],
  });
  const maintenanceTwo = await storage.createMaintenanceRequest({
    associationId: association.id,
    unitId: unitTwo.id,
    submittedByPersonId: person.id,
    submittedByPortalAccessId: portalTwo.id,
    submittedByEmail: person.email || uniqueEmail("multi.owner", marker),
    title: `Multi-unit maintenance 2 ${marker}`,
    description: "Second multi-unit maintenance request.",
    locationText: "Unit 202",
    category: "general",
    priority: "high",
    status: "submitted",
    attachmentUrlsJson: [],
  });

  const resolvedOne = await storage.resolvePortalAccessContext(portalOne.id);
  const resolvedTwo = await storage.resolvePortalAccessContext(portalTwo.id);
  assertCheck(resolvedOne?.effectiveRole === "owner", "first multi-unit access should resolve to owner");
  assertCheck(resolvedTwo?.effectiveRole === "owner", "second multi-unit access should resolve to owner");

  const activeAccesses = await storage.getPortalAccessesByEmail(person.email || uniqueEmail("multi.owner", marker));
  assertCheck(activeAccesses.filter((row) => row.status === "active").length === 2, "multi-unit owner should have two active portal accesses");
  assertCheck(new Set(activeAccesses.map((row) => row.unitId).filter(Boolean)).size === 2, "multi-unit owner should have two distinct units");

  const docsOne = await storage.getPortalDocuments(portalOne.id);
  const docsTwo = await storage.getPortalDocuments(portalTwo.id);
  assertCheck(docsOne.length === 1 && docsTwo.length === 1, "multi-unit owner should only see portal-visible docs on both unit sessions");

  const historiesOne = await storage.getPortalCommunicationHistory(portalOne.id);
  const historiesTwo = await storage.getPortalCommunicationHistory(portalTwo.id);
  assertCheck(historiesOne.length === 2 && historiesTwo.length === 2, "multi-unit owner should see both maintenance-history entries through each access");
  assertCheck(historiesOne.every((item) => item.subject.includes("Maintenance request")), "multi-unit owner should see maintenance histories");

  const maintenanceForOne = await storage.getMaintenanceRequests({ portalAccessId: portalOne.id });
  const maintenanceForTwo = await storage.getMaintenanceRequests({ portalAccessId: portalTwo.id });
  assertCheck(maintenanceForOne.length === 1, "first multi-unit portal access should map to one maintenance request");
  assertCheck(maintenanceForTwo.length === 1, "second multi-unit portal access should map to one maintenance request");
  assertCheck(maintenanceForOne[0].id === maintenanceOne.id, "first multi-unit maintenance request should round-trip");
  assertCheck(maintenanceForTwo[0].id === maintenanceTwo.id, "second multi-unit maintenance request should round-trip");

  const maintenanceAll = await storage.getMaintenanceRequests({ associationId: association.id });
  assertCheck(maintenanceAll.length === 2, "multi-unit association should surface both maintenance requests");

  return {
    associationId: association.id,
    personIds: [person.id],
    unitIds: [unitOne.id, unitTwo.id],
    boardRoleIds: [],
    portalAccessIds: [portalOne.id, portalTwo.id],
  };
}

async function createOwnerBoardScenario(actorEmail: string, marker: string): Promise<ScenarioScope> {
  const association = await storage.createAssociation({
    name: `Owner Journey Board ${marker}`,
    associationType: "condo",
    address: "300 Board Way",
    city: "Stamford",
    state: "CT",
    country: "USA",
  }, actorEmail);
  const owner = await storage.createPerson({
    firstName: "Board",
    lastName: `Owner${marker}`,
    email: uniqueEmail("board.owner", marker),
    phone: "555-0303",
    mailingAddress: "300 Board Way",
  }, actorEmail);
  const observer = await storage.createPerson({
    firstName: "Board",
    lastName: `Observer${marker}`,
    email: uniqueEmail("board.observer", marker),
    phone: "555-0304",
    mailingAddress: "300 Board Way",
  }, actorEmail);
  const unit = await storage.createUnit({
    associationId: association.id,
    unitNumber: "301",
    building: "C",
    squareFootage: 1500,
  }, actorEmail);
  await storage.createOwnership({
    unitId: unit.id,
    personId: owner.id,
    ownershipPercentage: 100,
    startDate: new Date("2024-01-01"),
    endDate: null,
  }, actorEmail);

  const boardRole = await storage.createBoardRole({
    associationId: association.id,
    personId: owner.id,
    role: "Secretary",
    startDate: new Date("2024-01-01"),
    endDate: null,
  }, actorEmail);

  const ownerAccess = await storage.createPortalAccess({
    associationId: association.id,
    personId: owner.id,
    unitId: unit.id,
    email: owner.email || uniqueEmail("board.owner", marker),
    role: "owner",
    status: "active",
  }, actorEmail);
  const boardAccess = await storage.createPortalAccess({
    associationId: association.id,
    personId: owner.id,
    unitId: null,
    email: owner.email || uniqueEmail("board.owner", marker),
    role: "board-member",
    status: "active",
    boardRoleId: boardRole.id,
  }, actorEmail);

  const visibleDoc = await storage.createDocument({
    associationId: association.id,
    title: `Board Visible ${marker}`,
    fileUrl: `/fixtures/board-visible-${marker}.pdf`,
    documentType: "notice",
    isPortalVisible: 1,
    portalAudience: "owner",
    uploadedBy: actorEmail,
  }, actorEmail);
  const hiddenDoc = await storage.createDocument({
    associationId: association.id,
    title: `Board Internal ${marker}`,
    fileUrl: `/fixtures/board-internal-${marker}.pdf`,
    documentType: "board-package",
    isPortalVisible: 0,
    portalAudience: "board",
    uploadedBy: actorEmail,
  }, actorEmail);

  const ownerNotice = await storage.sendNotice({
    associationId: association.id,
    recipientEmail: owner.email || uniqueEmail("board.owner", marker),
    recipientPersonId: owner.id,
    recipientRole: "owner",
    subject: `Owner-board notice ${marker}`,
    body: "Owner-board member notice for the owner journey verification.",
    requireApproval: true,
    bypassReadinessGate: true,
    sentBy: actorEmail,
  });
  const observerNotice = await storage.sendNotice({
    associationId: association.id,
    recipientEmail: observer.email || uniqueEmail("board.observer", marker),
    recipientPersonId: observer.id,
    subject: `Board-only notice ${marker}`,
    body: "Board-mode communication that should only be visible through the board access surface.",
    requireApproval: true,
    bypassReadinessGate: true,
    sentBy: actorEmail,
  });

  const ownerMaintenance = await storage.createMaintenanceRequest({
    associationId: association.id,
    unitId: unit.id,
    submittedByPersonId: owner.id,
    submittedByPortalAccessId: ownerAccess.id,
    submittedByEmail: owner.email || uniqueEmail("board.owner", marker),
    title: `Board owner maintenance ${marker}`,
    description: "Board owner maintenance request for the owner-board member journey.",
    locationText: "Unit 301",
    category: "general",
    priority: "medium",
    status: "submitted",
    attachmentUrlsJson: [],
  });

  const resolvedOwner = await storage.resolvePortalAccessContext(ownerAccess.id);
  const resolvedBoard = await storage.resolvePortalAccessContext(boardAccess.id);
  assertCheck(resolvedOwner?.effectiveRole === "owner", "owner access should resolve to owner");
  assertCheck(resolvedOwner?.hasBoardAccess === false, "owner access should not have board access");
  assertCheck(resolvedBoard?.effectiveRole === "owner-board-member", "board access should resolve to owner-board-member");
  assertCheck(resolvedBoard?.hasBoardAccess === true, "board access should have board access");

  const ownerDocs = await storage.getPortalDocuments(ownerAccess.id);
  const boardDocs = await storage.getPortalDocuments(boardAccess.id);
  assertCheck(ownerDocs.length === 1 && ownerDocs[0].id === visibleDoc.id, "owner access should only see visible docs");
  assertCheck(boardDocs.length === 2, "board access should see visible and internal docs");
  assertCheck(boardDocs.some((doc) => doc.id === hiddenDoc.id), "board access should see internal docs");

  const ownerHistory = await storage.getPortalCommunicationHistory(ownerAccess.id);
  const boardHistory = await storage.getPortalCommunicationHistory(boardAccess.id);
  assertCheck(ownerHistory.length === 2, "owner access should only see owner-relevant communication");
  assertCheck(boardHistory.length === 3, "board access should see all association communication");
  assertCheck(ownerHistory.some((item) => item.id === ownerNotice.history.id), "owner access should include its own notice");
  assertCheck(ownerHistory.some((item) => item.subject.includes("Maintenance request")), "owner access should include its maintenance history");
  assertCheck(boardHistory.some((item) => item.id === observerNotice.history.id), "board access should include the board-only notice");

  const maintenance = await storage.getMaintenanceRequests({ portalAccessId: ownerAccess.id });
  assertCheck(maintenance.length === 1, "board owner should see their maintenance request through owner access");
  assertCheck(maintenance[0].id === ownerMaintenance.id, "board owner maintenance should round-trip");

  const activeAccesses = await storage.getPortalAccessesByEmail(owner.email || uniqueEmail("board.owner", marker));
  assertCheck(activeAccesses.filter((row) => row.status === "active").length === 2, "board owner should have both owner and board access");
  assertCheck(activeAccesses.some((row) => row.boardRoleId === boardRole.id), "board owner should have a board-role-linked portal access");

  return {
    associationId: association.id,
    personIds: [owner.id, observer.id],
    unitIds: [unit.id],
    boardRoleIds: [boardRole.id],
    portalAccessIds: [ownerAccess.id, boardAccess.id],
  };
}

async function run() {
  const marker = randomUUID().slice(0, 8);
  const actorEmail = `owner-portal-verify-${marker}@local`;
  const scopes: ScenarioScope[] = [];

  try {
    await verifyCodeCoverage();
    scopes.push(await createSingleUnitScenario(actorEmail, marker));
    scopes.push(await createMultiUnitScenario(actorEmail, marker));
    scopes.push(await createOwnerBoardScenario(actorEmail, marker));

    console.log(JSON.stringify({
      status: "passed",
      marker,
      scenarios: [
        "single-unit owner",
        "multi-unit owner",
        "owner-board-member",
      ],
      checks: [
        "owner portal shell exposes the live multi-unit summary, unit focus, and financial surfaces",
        "single-unit owner resolves to owner-only access with portal-visible docs and maintenance history",
        "multi-unit owner resolves to two active portal access rows and per-unit maintenance context",
        "owner-board-member resolves to combined access, sees board-only docs, and keeps board-only routes behind board access",
      ],
    }, null, 2));
  } finally {
    await cleanup(scopes, actorEmail);
  }
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Owner portal multi-unit verification failed:", error);
    process.exit(1);
  });
