import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function main() {
  const result = await db.execute(sql`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'documents'
    ORDER BY ordinal_position
  `);
  console.log('documents table columns:');
  console.log(JSON.stringify(result.rows, null, 2));
  
  const versions = await db.execute(sql`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'document_versions'
    ORDER BY ordinal_position
  `);
  console.log('\ndocument_versions table columns:');
  console.log(JSON.stringify(versions.rows, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
