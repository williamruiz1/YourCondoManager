import { db } from "../server/db";
import { analysisRuns } from "../shared/schema";

const RESOURCE_ID = "admin-roadmap-backbone";
const MODULE = "agent-bootstrap-backbone";

function readArg(name: string) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  return raw ? raw.slice(prefix.length) : "";
}

async function main() {
  const summary = readArg("summary");
  const category = readArg("category") || "general";
  const action = readArg("action") || "friction-observed";
  const repeatable = readArg("repeatable") || "unknown";
  const couldPrecompute = readArg("couldPrecompute") || "unknown";
  const source = readArg("source") || null;
  const impact = readArg("impact") || null;

  if (!summary.trim()) {
    throw new Error("Missing required --summary argument");
  }

  const metadataJson = {
    category,
    summary: summary.trim(),
    repeatable,
    couldPrecompute,
    source,
    impact,
  };

  const [result] = await db
    .insert(analysisRuns)
    .values({
      resourceId: RESOURCE_ID,
      module: MODULE,
      action,
      success: 1,
      durationMs: 0,
      itemCount: 1,
      metadataJson,
    })
    .returning();

  console.log(JSON.stringify({ id: result.id, resourceId: RESOURCE_ID, module: MODULE, metadataJson }, null, 2));
  await db.$client.end();
}

main().catch(async (error) => {
  console.error(error);
  await db.$client.end();
  process.exit(1);
});
