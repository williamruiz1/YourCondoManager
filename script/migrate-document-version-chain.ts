import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function main() {
  // Add parentDocumentId, versionNumber, isCurrentVersion to documents table
  await db.execute(sql`
    ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS parent_document_id varchar,
    ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS is_current_version integer NOT NULL DEFAULT 1
  `);
  console.log('Migration complete: added parent_document_id, version_number, is_current_version to documents');
}

main().catch(console.error).finally(() => process.exit(0));
