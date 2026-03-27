import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function run() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS platform_secrets (
      key varchar PRIMARY KEY,
      value text NOT NULL,
      updated_at timestamp NOT NULL DEFAULT now(),
      updated_by text
    )
  `);
  console.log("platform_secrets table ready.");
}

run().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
