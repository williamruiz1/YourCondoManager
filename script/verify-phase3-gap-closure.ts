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
  const meetings = read("client/src/pages/meetings.tsx");
  const compliance = read("client/src/pages/governance-compliance.tsx");

  assertCheck(schema.includes("export const meetingAgendaItems"), "missing meetingAgendaItems schema");
  assertCheck(schema.includes("export const meetingNotes"), "missing meetingNotes schema");
  assertCheck(schema.includes("export const resolutions"), "missing resolutions schema");
  assertCheck(schema.includes("export const voteRecords"), "missing voteRecords schema");
  assertCheck(schema.includes("export const calendarEvents"), "missing calendarEvents schema");

  assertCheck(routes.includes('"/api/governance/meetings/:id/agenda-items"'), "missing agenda routes");
  assertCheck(routes.includes('"/api/governance/meetings/:id/notes"'), "missing meeting notes routes");
  assertCheck(routes.includes('"/api/governance/resolutions"'), "missing resolution routes");
  assertCheck(routes.includes('"/api/governance/resolutions/:id/votes"'), "missing vote routes");
  assertCheck(routes.includes('"/api/governance/calendar/events"'), "missing calendar routes");

  assertCheck(meetings.includes("Decisions & Starter Vote Tracking"), "missing decision tracking UI");
  assertCheck(meetings.includes("Search by title, meeting, or date"), "missing searchable decision UX");
  assertCheck(meetings.includes("Starter vote capture only"), "missing vote scope boundary notice");

  assertCheck(compliance.includes("Timeline / Calendar View"), "missing timeline/calendar view");
}

async function verifyRuntime() {
  const marker = randomUUID();
  const actor = `m3-verify-${Date.now()}@local`;

  const association = await storage.createAssociation(
    {
      name: `M3 Verify ${marker}`,
      address: "3 Governance Ave",
      city: "New Haven",
      state: "CT",
      country: "USA",
    },
    actor,
  );

  const meeting = await storage.createGovernanceMeeting({
    associationId: association.id,
    meetingType: "board",
    title: `Board Meeting ${marker.slice(0, 5)}`,
    scheduledAt: new Date(),
    location: "Club Room",
    status: "scheduled",
    agenda: null,
    notes: null,
    summaryText: null,
    summaryStatus: "draft",
  });

  const agendaItem = await storage.createMeetingAgendaItem({
    meetingId: meeting.id,
    title: "Adopt annual policy",
    description: "Discuss and vote",
    orderIndex: 1,
  });
  assertCheck(Boolean(agendaItem.id), "agenda item create failed");

  const note = await storage.createMeetingNote({
    meetingId: meeting.id,
    noteType: "minutes",
    content: "Discussion opened with quorum present.",
    createdBy: actor,
  });
  assertCheck(Boolean(note.id), "meeting note create failed");

  const resolution = await storage.createResolution({
    associationId: association.id,
    meetingId: meeting.id,
    title: "Approve reserve allocation",
    description: "Allocate reserve funds",
    status: "open",
  });

  await storage.createVoteRecord({
    resolutionId: resolution.id,
    voterPersonId: null,
    voteChoice: "yes",
    voteWeight: 1,
  });

  await storage.createVoteRecord({
    resolutionId: resolution.id,
    voterPersonId: null,
    voteChoice: "no",
    voteWeight: 0.25,
  });

  const refreshedResolutions = await storage.getResolutions(association.id);
  const refreshed = refreshedResolutions.find((r) => r.id === resolution.id);
  assertCheck(refreshed?.status === "approved", "resolution status should resolve to approved based on vote totals");

  const event = await storage.createCalendarEvent({
    associationId: association.id,
    eventType: "governance",
    title: "Budget deadline",
    startsAt: new Date(),
    endsAt: null,
    relatedType: "resolution",
    relatedId: resolution.id,
  });
  assertCheck(Boolean(event.id), "calendar event create failed");

  const events = await storage.getCalendarEvents(association.id);
  assertCheck(events.some((e) => e.id === event.id), "calendar event should be queryable");
}

async function run() {
  await verifyCodeCoverage();
  await verifyRuntime();
  console.log("Phase 3 gap-closure verification checks passed.");
}

run().catch((error) => {
  console.error(`Verification failed: ${error.message}`);
  process.exit(1);
});
