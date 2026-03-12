import { eq } from "drizzle-orm";
import { db } from "../server/db";
import { storage } from "../server/storage";
import { maintenanceRequests } from "../shared/schema";

async function run() {
  const now = Date.now();
  const suffix = String(now).slice(-6);

  const association = await storage.createAssociation({
    name: `QA Communications Foundation ${suffix}`,
    address: "100 Verification Way",
    city: "New Haven",
    state: "CT",
    country: "USA",
  }, "qa@local");

  const unit = await storage.createUnit({
    associationId: association.id,
    unitNumber: `QA-${suffix}`,
    building: "A",
    squareFootage: 900,
  }, "qa@local");

  const onboardingResult = await storage.submitOnboardingIntake({
    associationId: association.id,
    unitId: unit.id,
    occupancyType: "OWNER_OCCUPIED",
    person: {
      firstName: "Quinn",
      lastName: "Owner",
      email: `qa-owner-${suffix}@example.com`,
      phone: "555-0100",
      mailingAddress: "100 Verification Way",
      emergencyContactName: "Emergency Contact",
      emergencyContactPhone: "555-0199",
      contactPreference: "email",
    },
    startDate: new Date(),
    ownershipPercentage: 100,
  });

  const readiness = await storage.getAssociationContactReadiness(association.id);
  if (!readiness.canSendNotices) {
    throw new Error(`Readiness unexpectedly blocked: ${readiness.blockingReasons.join("; ")}`);
  }

  await storage.createPaymentMethodConfig({
    associationId: association.id,
    methodType: "ach",
    displayName: "ACH Transfer",
    instructions: "Use routing 011000015 and account 123456789.",
    supportEmail: "billing@example.com",
    supportPhone: "555-0111",
    isActive: 1,
    displayOrder: 0,
  });

  const paymentSend = await storage.sendPaymentInstructionNotice({
    associationId: association.id,
    audience: "owners",
    requireApproval: true,
    subject: "Payment Setup Instructions",
    body: "Methods:\n{{payment_methods}}\nSupport: {{payment_support_email}}",
    sentBy: "qa@local",
  });
  if (paymentSend.recipientCount < 1) {
    throw new Error("Payment instruction send produced zero recipients");
  }

  const pendingSends = await storage.getNoticeSends(association.id, "pending-approval");
  if (!pendingSends.length) {
    throw new Error("Expected at least one pending approval notice");
  }
  await storage.reviewNoticeSend(pendingSends[0].id, { decision: "approved", actedBy: "qa-approver@local" });

  const maintenance = await storage.createMaintenanceRequest({
    associationId: association.id,
    unitId: unit.id,
    submittedByPersonId: onboardingResult.person.id,
    submittedByPortalAccessId: null,
    submittedByEmail: onboardingResult.person.email,
    title: "Urgent leak",
    description: "Water leak in ceiling near bathroom vent.",
    locationText: `Unit ${unit.unitNumber}`,
    category: "plumbing",
    priority: "urgent",
    status: "submitted",
    attachmentUrlsJson: [],
    assignedTo: null,
    resolutionNotes: null,
  });

  await db
    .update(maintenanceRequests)
    .set({
      responseDueAt: new Date(Date.now() - 60 * 60 * 1000),
      updatedAt: new Date(),
    })
    .where(eq(maintenanceRequests.id, maintenance.id));

  const escalation = await storage.runMaintenanceEscalationSweep({
    associationId: association.id,
    actorEmail: "qa-scheduler@local",
  });
  if (escalation.escalated < 1) {
    throw new Error("Expected at least one escalated maintenance request");
  }

  const overview = await storage.getAssociationOverview(association.id);
  const onboardingState = await storage.getAssociationOnboardingState(association.id);

  console.log(JSON.stringify({
    ok: true,
    associationId: association.id,
    unitId: unit.id,
    ownerPersonId: onboardingResult.person.id,
    readiness: {
      canSendNotices: readiness.canSendNotices,
      contactCoveragePercent: readiness.contactCoveragePercent,
    },
    payment: {
      recipients: paymentSend.recipientCount,
      sentCount: paymentSend.sentCount,
    },
    escalation: {
      processed: escalation.processed,
      escalated: escalation.escalated,
    },
    onboardingState,
    overview,
  }, null, 2));
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Verification failed:", error);
    process.exit(1);
  });
