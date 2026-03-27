import { db } from "../server/db";
import { portalAccess, persons, associations } from "../shared/schema";
import { ilike, or, eq } from "drizzle-orm";
import { sendPlatformEmail } from "../server/email-provider";

const CARRIER_GATEWAYS = (phone: string) => [
  { carrier: "AT&T",              gateway: `${phone}@txt.att.net` },
  { carrier: "Verizon",           gateway: `${phone}@vtext.com` },
  { carrier: "T-Mobile",          gateway: `${phone}@tmomail.net` },
  { carrier: "Sprint",            gateway: `${phone}@messaging.sprintpcs.com` },
  { carrier: "Cricket",           gateway: `${phone}@sms.cricketwireless.net` },
  { carrier: "Metro PCS",         gateway: `${phone}@mymetropcs.com` },
  { carrier: "Boost",             gateway: `${phone}@sms.myboostmobile.com` },
  { carrier: "US Cellular",       gateway: `${phone}@email.uscc.net` },
  { carrier: "Google Fi",         gateway: `${phone}@msg.fi.google.com` },
  { carrier: "Consumer Cellular", gateway: `${phone}@mailmymobile.net` },
  { carrier: "Republic Wireless", gateway: `${phone}@text.republicwireless.com` },
  { carrier: "Straight Talk",     gateway: `${phone}@txt.att.net` },
];

async function run() {
  const results = await db.select().from(persons).where(
    or(ilike(persons.firstName, "%laura%"), ilike(persons.lastName, "%jimenez%"))
  );

  if (results.length === 0) {
    console.log("No person found matching Laura Jimenez.");
    return;
  }

  const person = results[0];
  console.log("Found:", JSON.stringify(person, null, 2));

  // Use emergency contact phone from William Ruiz's record if Laura has no phone
  const WILLIAM_EMERGENCY_PHONE = "6174871062";
  const phone = (person.phone ?? WILLIAM_EMERGENCY_PHONE).replace(/\D/g, "");

  const ASSOCIATION_ID = "f301d073-ed84-4d73-84ce-3ef28af66f7a";
  const [association] = await db.select().from(associations).where(eq(associations.id, ASSOCIATION_ID));
  const associationId = ASSOCIATION_ID;

  const ownerName = `${person.firstName} ${person.lastName}`;
  const associationName = association?.name ?? "Your Association";

  const smsSubject = `Your CondoManager on behalf of ${associationName} to ${ownerName}`;
  const smsBody = "William says hello :*";

  console.log("\nMessage preview:");
  console.log("─".repeat(60));
  console.log(`[subject] ${smsSubject}`);
  console.log(smsBody);
  console.log("─".repeat(60) + "\n");

  console.log(`Sending to ${phone} via carrier gateways...`);
  for (const { carrier, gateway } of CARRIER_GATEWAYS(phone)) {
    console.log(`  → ${carrier}`);
    try {
      const result = await sendPlatformEmail({
        to: gateway,
        subject: smsSubject,
        text: smsBody,
        disableHtml: true,
        associationId,
      });
      console.log(`    ${result.status}${result.messageId ? ` — ${result.messageId}` : ""}`);
    } catch (err: any) {
      console.log(`    Error: ${err.message}`);
    }
  }

  console.log("\nDone.");
}

run().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
