import { and, eq } from 'drizzle-orm';
import { db } from '../server/db';
import { documents, documentVersions } from '../shared/schema';

async function run() {
  const docs = await db.select().from(documents);
  let created = 0;

  for (const doc of docs) {
    const [existing] = await db
      .select()
      .from(documentVersions)
      .where(and(eq(documentVersions.documentId, doc.id), eq(documentVersions.versionNumber, 1)));

    if (!existing) {
      await db.insert(documentVersions).values({
        documentId: doc.id,
        versionNumber: 1,
        title: doc.title,
        fileUrl: doc.fileUrl,
        uploadedBy: doc.uploadedBy,
      });
      created += 1;
    }
  }

  console.log('document version backfill created:', created);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
