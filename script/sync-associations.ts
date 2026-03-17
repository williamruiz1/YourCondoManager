/**
 * sync-associations.ts
 *
 * One-time migration: inserts all associations from the dev database into
 * the target database (production). Uses ID-based dedup — rows that already
 * exist by primary key are skipped.
 *
 * Run against production by pointing DATABASE_URL at the production DB:
 *   DATABASE_URL=<prod-url> npx tsx script/sync-associations.ts
 *
 * Safe to re-run — existing rows are never modified.
 */

import { db } from "../server/db";
import { associations } from "../shared/schema";
import { sql } from "drizzle-orm";

const DEV_ASSOCIATIONS: (typeof associations.$inferInsert)[] = [
  { id: "e60c349e-b14e-48fa-a72e-8af3c2180c74", name: "Sunset Towers", address: "1200 Ocean Drive", city: "Miami", state: "FL", country: "USA" },
  { id: "f627dc9b-cde0-44c0-a23a-405487cb0add", name: "Pacific Heights Condos", address: "789 Bay Street", city: "San Francisco", state: "CA", country: "USA" },
  { id: "7a1f216a-8ac9-4fe9-a8d2-b62b01565a42", name: "Lakewood Residences", address: "450 Lakeview Blvd", city: "Chicago", state: "IL", country: "USA" },
  { id: "1c63e35c-2ac3-4b0a-b2ab-61f873d0d938", name: "Test Towers", address: "100 Test Ave", city: "Austin", state: "TX", country: "USA" },
  { id: "f301d073-ed84-4d73-84ce-3ef28af66f7a", name: "Cherry Hill Court Condominiums", associationType: "", dateFormed: "1990-07-16", ein: "", address: "1405 Quinnipiac Ave.", city: "New Haven", state: "CT", country: "USA" },
  { id: "628b7d4b-b052-44a5-9bcc-69784581450c", name: "Cherry Hill Court", associationType: "condo", address: "101 Cherry Hill Court", city: "Cherry Hill", state: "NJ", country: "USA" },
  { id: "7c164b67-9e3b-456a-bb49-dd698b0822c4", name: "Verification HOA 1773579706183", associationType: "condo", address: "1 Verification Way", city: "New Haven", state: "CT", country: "USA" },
  { id: "5d4488b7-c229-4412-8762-d822e4f150f3", name: "QA Communications Foundation 364067", address: "100 Verification Way", city: "New Haven", state: "CT", country: "USA" },
  { id: "f61e4b10-01a3-4670-87b3-c2a7749b2958", name: "Building First Verify A 092492", address: "100 Verify Way", city: "Austin", state: "TX", country: "USA" },
  { id: "8c579997-ec38-4389-9e78-dbf34ba80947", name: "Building First Verify B 092492", address: "200 Verify Way", city: "Austin", state: "TX", country: "USA" },
  { id: "2d2c9b21-99cd-4a41-b04b-d52a59c90adf", name: "M1 Verify 03c6c06b-3e4f-40b4-847b-cb9d18b8bedb", address: "1 Audit Way", city: "New Haven", state: "CT", country: "USA" },
  { id: "6b88913f-a682-4885-b965-2227238ca1a7", name: "M2 Verify cfb8fdae-4d21-489d-bbb3-003fa7de6937", address: "2 Budget Lane", city: "New Haven", state: "CT", country: "USA" },
  { id: "8a54bd02-ce91-43e5-9025-9727e51dd81a", name: "M3 Verify 87248c5d-343a-42ec-99d6-cbe04fe32d6f", address: "3 Governance Ave", city: "New Haven", state: "CT", country: "USA" },
  { id: "1487980c-c1fe-4c63-b0af-519c0a6b0df3", name: "M3 Verify fdff42d9-c271-4753-9ce6-29abcffbfe07", address: "3 Governance Ave", city: "New Haven", state: "CT", country: "USA" },
  { id: "824957e1-af38-43ec-af76-328d92556945", name: "M4 Verify 01560bd0", address: "4 Intelligence Way", city: "Cambridge", state: "MA", country: "USA" },
  { id: "1f6dc2f6-8910-48c0-a6c3-16542a2bd72a", name: "M5 A 771782db", address: "500 A Street", city: "Boston", state: "MA", country: "USA" },
  { id: "b6bfa018-b74e-4731-aa57-da96552e2278", name: "M5 B 771782db", address: "501 B Street", city: "Boston", state: "MA", country: "USA" },
  { id: "5f8d45b1-a6f7-4396-8657-1b814d757c72", name: "M5 A 144ac799", address: "500 A Street", city: "Boston", state: "MA", country: "USA" },
  { id: "db729561-9dfc-457e-a4b8-ee75e723f65c", name: "M5 B 144ac799", address: "501 B Street", city: "Boston", state: "MA", country: "USA" },
  { id: "a913c7ae-3f37-441e-9ed5-4d7ef10c3b21", name: "M2 Verify 80b04465-bc8b-4ec8-b65d-42cb833102f2", address: "2 Budget Lane", city: "New Haven", state: "CT", country: "USA" },
  { id: "7f04cf6b-03c3-4ad8-984e-cb5f8c0ec7f2", name: "M3 Verify 1903372c-1ffb-4545-92a0-d00e9f2b11a7", address: "3 Governance Ave", city: "New Haven", state: "CT", country: "USA" },
  { id: "7e2f8aac-bc06-4f94-9cbd-008394f47f9b", name: "M4 Verify a2ccb5de", address: "4 Intelligence Way", city: "Cambridge", state: "MA", country: "USA" },
  { id: "341eef63-da08-45dc-bcd5-b814a22f951d", name: "M5 A 5b429e33", address: "500 A Street", city: "Boston", state: "MA", country: "USA" },
  { id: "ac273593-4859-4d12-a893-fc590759a1e0", name: "M5 B 5b429e33", address: "501 B Street", city: "Boston", state: "MA", country: "USA" },
  { id: "767ae794-3b7c-4c81-aa24-257018e4366c", name: "AI Ingestion Verify 546983", address: "100 Test Way", city: "Austin", state: "TX", country: "USA" },
  { id: "8b3a1209-6a15-4905-ba11-1f2e281e542b", name: "AI Ingestion Benchmark 705630", address: "1 Benchmark Plaza", city: "Austin", state: "TX", country: "USA" },
  { id: "03bf6db8-4f11-46ce-b407-55fb1608bb1a", name: "AI Ingestion Benchmark 724980", address: "1 Benchmark Plaza", city: "Austin", state: "TX", country: "USA" },
  { id: "13437a4d-4e3e-43fd-9f3f-8363795611da", name: "AI Ingestion Benchmark 747307", address: "1 Benchmark Plaza", city: "Austin", state: "TX", country: "USA" },
  { id: "2de5f8cb-cc8b-4869-88a4-2a899202f226", name: "AI Ingestion Benchmark 773059", address: "1 Benchmark Plaza", city: "Austin", state: "TX", country: "USA" },
  { id: "ba806fad-1586-4013-ab62-18cbb360b007", name: "Dbg Assoc", address: "1", city: "x", state: "TX", country: "USA" },
  { id: "698f44b6-785f-412a-8ce9-f66ba590e943", name: "AI Ingestion Verify 831011", address: "100 Test Way", city: "Austin", state: "TX", country: "USA" },
  { id: "acb54c9d-163e-4417-b668-b8e5e96f9341", name: "AI Ingestion Benchmark 831011", address: "1 Benchmark Plaza", city: "Austin", state: "TX", country: "USA" },
  { id: "a6edd39e-1e6d-400f-8a41-18d693b3116f", name: "AI Ingestion Benchmark 377049", address: "1 Benchmark Plaza", city: "Austin", state: "TX", country: "USA" },
  { id: "1aed21af-1a0f-4a88-9876-38ef412e71cd", name: "AI Ingestion Verify 377141", address: "100 Test Way", city: "Austin", state: "TX", country: "USA" },
  { id: "0c191726-f468-4fab-9700-4d9518b283f6", name: "AI Ingestion Benchmark 530772", address: "1 Benchmark Plaza", city: "Austin", state: "TX", country: "USA" },
  { id: "1d80ac65-beb0-4008-84f9-a51ade5702a5", name: "AI Ingestion Benchmark 603122", address: "1 Benchmark Plaza", city: "Austin", state: "TX", country: "USA" },
];

async function main() {
  console.log(`Syncing ${DEV_ASSOCIATIONS.length} associations...`);

  let inserted = 0;
  let skipped = 0;

  for (const assoc of DEV_ASSOCIATIONS) {
    // Insert only if ID doesn't already exist — never overwrites existing rows.
    const result = await db
      .insert(associations)
      .values(assoc)
      .onConflictDoNothing()
      .returning({ id: associations.id, name: associations.name });

    if (result.length > 0) {
      console.log(`  [inserted] ${assoc.name}`);
      inserted++;
    } else {
      console.log(`  [skipped]  ${assoc.name} (already exists)`);
      skipped++;
    }
  }

  console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("sync-associations failed:", e);
  process.exit(1);
});
