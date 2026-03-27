/**
 * Test script: send a formatted SMS to William Ruiz via email-to-SMS carrier gateways.
 */
import { db } from "../server/db";
import { portalAccess, persons, associations } from "../shared/schema";
import { eq } from "drizzle-orm";
import { sendPlatformEmail } from "../server/email-provider";

const WILLIAM_PERSON_ID = "f49f0d4b-01fd-4ea3-b8be-2d70229eb549";
const WILLIAM_PHONE = "2036764815";
const WILLIAM_PORTAL_ACCESS_IDS = [
  "9c1069ac-aab3-44a1-8009-24087370d88a",
  "1753faab-04aa-4327-8f64-312c6f8967f8",
  "6bcc9dce-61d7-4fa4-9f59-96eca543f73a",
];
const ASSOCIATION_ID = "f301d073-ed84-4d73-84ce-3ef28af66f7a";

const CARRIER_GATEWAYS = [
  { carrier: "AT&T",     gateway: `${WILLIAM_PHONE}@txt.att.net` },
  { carrier: "Verizon",  gateway: `${WILLIAM_PHONE}@vtext.com` },
  { carrier: "T-Mobile", gateway: `${WILLIAM_PHONE}@tmomail.net` },
  { carrier: "Sprint",   gateway: `${WILLIAM_PHONE}@messaging.sprintpcs.com` },
];

function formatSmsSubject(associationName: string, ownerName: string): string {
  return `Your CondoManager on behalf of ${associationName} to ${ownerName}`;
}

async function run() {
  // Resolve names
  const [person] = await db.select().from(persons).where(eq(persons.id, WILLIAM_PERSON_ID));
  const [association] = await db.select().from(associations).where(eq(associations.id, ASSOCIATION_ID));

  const ownerName = `${person.firstName} ${person.lastName}`;
  const associationName = association.name;

  console.log(`Owner: ${ownerName}`);
  console.log(`Association: ${associationName}\n`);

  // Ensure opted in
  for (const id of WILLIAM_PORTAL_ACCESS_IDS) {
    await db.update(portalAccess)
      .set({ smsOptIn: 1, smsOptInChangedAt: new Date() })
      .where(eq(portalAccess.id, id));
  }

  const smsSubject = formatSmsSubject(associationName, ownerName);
  const smsBody = "This is a test message from your property manager.";

  console.log("Message preview:");
  console.log("─".repeat(50));
  console.log(`[subject] ${smsSubject}`);
  console.log(smsBody);
  console.log("─".repeat(50) + "\n");

  console.log(`Sending to ${WILLIAM_PHONE} via carrier gateways...`);
  for (const { carrier, gateway } of CARRIER_GATEWAYS) {
    console.log(`  → ${carrier}`);
    try {
      const result = await sendPlatformEmail({
        to: gateway,
        subject: smsSubject,
        text: smsBody,
        disableHtml: true,
        associationId: ASSOCIATION_ID,
      });
      console.log(`    ${result.status}${result.messageId ? ` — ${result.messageId}` : ""}`);
    } catch (err: any) {
      console.log(`    Error: ${err.message}`);
    }
  }

  console.log("\nDone.");
}

run().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
