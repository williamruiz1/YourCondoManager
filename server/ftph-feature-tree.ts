import { readFile } from "fs/promises";
import path from "path";
import { inArray } from "drizzle-orm";
import { db } from "./db";
import {
  ftphFeatureTreeDefinition,
  type FeatureStatus,
  type FtphFeatureSet,
  type FtphFeatureTreeResponse,
  type FtphFunctionalUnit,
  type FtphModule,
} from "@shared/ftph-feature-tree";
import { roadmapProjects } from "@shared/schema";

type MutableUnit = FtphFunctionalUnit;
type MutableFeatureSet = FtphFeatureSet;
type MutableModule = FtphModule;

function getStatusMap() {
  const moduleStatus = new Map<string, FeatureStatus>();
  const featureSetStatus = new Map<string, FeatureStatus>();
  const unitStatus = new Map<string, FeatureStatus>();

  for (const module of ftphFeatureTreeDefinition) {
    moduleStatus.set(module.id, module.defaultStatus ?? "active");
    for (const featureSet of module.featureSets) {
      featureSetStatus.set(`${module.id}:${featureSet.id}`, featureSet.defaultStatus ?? module.defaultStatus ?? "active");
      for (const unit of featureSet.functionalUnits) {
        unitStatus.set(`${module.id}:${featureSet.id}:${unit.id}`, unit.defaultStatus);
      }
    }
  }

  return { moduleStatus, featureSetStatus, unitStatus };
}

function createSeedModules() {
  return ftphFeatureTreeDefinition.map<MutableModule>((module) => ({
    id: module.id,
    title: module.title,
    status: module.defaultStatus ?? "active",
    notes: module.notes,
    featureSets: [],
  }));
}

function ensureModule(modules: MutableModule[], moduleId: string): MutableModule {
  let existing = modules.find((module) => module.id === moduleId);
  if (existing) return existing;

  existing = {
    id: moduleId,
    title: `Module ${moduleId}`,
    status: "inactive",
    featureSets: [],
  };
  modules.push(existing);
  return existing;
}

function ensureFeatureSet(module: MutableModule, featureSet: MutableFeatureSet): MutableFeatureSet {
  const existing = module.featureSets.find((item) => item.id === featureSet.id);
  if (existing) return existing;
  module.featureSets.push(featureSet);
  return featureSet;
}

function parseNestedList(lines: string[], startIndex: number) {
  const items: string[] = [];
  let index = startIndex;
  while (index < lines.length) {
    const line = lines[index];
    const match = line.match(/^\s{2}-\s+(.*)$/);
    if (!match) break;
    items.push(match[1].trim());
    index += 1;
  }
  return { items, nextIndex: index };
}

function normalizeStoryPhrase(value: string) {
  return value.replace(/\s+/g, " ").trim().replace(/[.]+$/, "").toLowerCase();
}

function inferFeatureSetUserStory(title: string, intent?: string, description?: string) {
  if (intent) {
    return `As a property administrator, I want ${normalizeStoryPhrase(intent)} so ${normalizeStoryPhrase(description || title)}.`;
  }
  if (description) {
    return `As a property administrator, I want ${normalizeStoryPhrase(title)} so ${normalizeStoryPhrase(description)}.`;
  }
  return `As a property administrator, I want ${normalizeStoryPhrase(title)} so this feature set is operationally usable.`;
}

function inferFunctionalUnitUserStory(title: string, type: string, summary?: string) {
  const phrase = normalizeStoryPhrase(title);
  const outcome = normalizeStoryPhrase(summary || "this workflow is handled correctly");

  if (type === "Logic") return `As a property administrator, I want the system to handle ${phrase} so ${outcome}.`;
  if (type === "Data") return `As a property administrator, I want to manage ${phrase} so ${outcome}.`;
  if (type === "Integration") return `As a property administrator, I want ${phrase} integrated so ${outcome}.`;
  if (type === "Security") return `As a platform administrator, I want ${phrase} enforced so ${outcome}.`;
  return `As an end user, I want ${phrase} so ${outcome}.`;
}

async function resolveRuleStatuses() {
  const rules = new Map<string, { projectTitles: string[]; whenMissing: FeatureStatus; whenInProgress: FeatureStatus; whenComplete: FeatureStatus }>();

  for (const module of ftphFeatureTreeDefinition) {
    if (module.roadmapRule) rules.set(`module:${module.id}`, module.roadmapRule);
    for (const featureSet of module.featureSets) {
      if (featureSet.roadmapRule) rules.set(`feature-set:${module.id}:${featureSet.id}`, featureSet.roadmapRule);
      for (const unit of featureSet.functionalUnits) {
        if (unit.roadmapRule) rules.set(`unit:${module.id}:${featureSet.id}:${unit.id}`, unit.roadmapRule);
      }
    }
  }

  const projectTitles = Array.from(new Set(Array.from(rules.values()).flatMap((rule) => rule.projectTitles)));
  const rows = projectTitles.length
    ? await db
        .select({ title: roadmapProjects.title, status: roadmapProjects.status })
        .from(roadmapProjects)
        .where(inArray(roadmapProjects.title, projectTitles))
    : [];

  const rowsByTitle = new Map(rows.map((row) => [row.title, row]));
  const resolved = new Map<string, FeatureStatus>();

  for (const [key, rule] of Array.from(rules.entries())) {
    const matches = rule.projectTitles
      .map((title: string) => rowsByTitle.get(title))
      .filter((value): value is NonNullable<typeof value> => Boolean(value));
    if (matches.length === 0) {
      resolved.set(key, rule.whenMissing);
      continue;
    }

    const allComplete = matches.every((row) => row.status === "complete");
    resolved.set(key, allComplete ? rule.whenComplete : rule.whenInProgress);
  }

  return resolved;
}

function applyInferredStories(modules: MutableModule[]) {
  for (const module of modules) {
    for (const featureSet of module.featureSets) {
      featureSet.userStory = featureSet.userStory || inferFeatureSetUserStory(featureSet.title, featureSet.intentSummary, featureSet.description);
      for (const unit of featureSet.functionalUnits) {
        unit.userStory = unit.userStory || inferFunctionalUnitUserStory(unit.title, unit.type, unit.summary || unit.documentationNotes?.[0]);
      }
    }
  }
}

function applyStatuses(modules: MutableModule[], resolvedRuleStatuses: Map<string, FeatureStatus>) {
  const { moduleStatus, featureSetStatus, unitStatus } = getStatusMap();

  for (const module of modules) {
    module.status = resolvedRuleStatuses.get(`module:${module.id}`) ?? moduleStatus.get(module.id) ?? "inactive";
    for (const featureSet of module.featureSets) {
      featureSet.status =
        resolvedRuleStatuses.get(`feature-set:${module.id}:${featureSet.id}`) ??
        featureSetStatus.get(`${module.id}:${featureSet.id}`) ??
        module.status;
      for (const unit of featureSet.functionalUnits) {
        unit.status =
          resolvedRuleStatuses.get(`unit:${module.id}:${featureSet.id}:${unit.id}`) ??
          unitStatus.get(`${module.id}:${featureSet.id}:${unit.id}`) ??
          featureSet.status;
      }
    }
  }
}

function sortModules(modules: MutableModule[]) {
  modules.sort((a, b) => Number(a.id) - Number(b.id));
}

async function parseAdditionalCondoManagerDocs(modules: MutableModule[]) {
  const module = ensureModule(modules, "90");
  module.title = "CondoManager Documentation";
  module.purpose = "Surface implementation-specific plans, standards, project notes, and gap-analysis artifacts outside the FTPH capability documents.";
  module.notes = "This branch represents repo-specific product and delivery documentation in addition to the FTPH model.";

  const docsToParse = [
    { path: "docs/google-oauth-signin-implementation-plan.md", featureSetId: "90.1", fallbackTitle: "Google OAuth Sign-In Implementation Plan" },
    { path: "docs/google-oauth-rollback-plan.md", featureSetId: "90.2", fallbackTitle: "Google OAuth Rollback Plan" },
    { path: "docs/projects/single-association-context.md", featureSetId: "90.3", fallbackTitle: "Single-Association Context Project" },
    { path: "docs/executive-slide-authoring-standard.md", featureSetId: "90.4", fallbackTitle: "Executive Slide Authoring Standard" },
    { path: "docs/roadmap/ftph-gap-analysis-2026-03-14.md", featureSetId: "90.5", fallbackTitle: "FTPH Platform Gap Analysis" },
  ];

  for (const doc of docsToParse) {
    const lines = (await readFile(path.resolve(doc.path), "utf8")).split(/\r?\n/);
    const title = lines.find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, "").trim() || doc.fallbackTitle;
    const featureSet = ensureFeatureSet(module, {
      id: doc.featureSetId,
      title,
      status: "active",
      functionalUnits: [],
    });
    featureSet.status = "active";

    let currentUnit: MutableUnit | null = null;
    let sectionCounter = 1;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const h2 = line.match(/^##\s+(.*)$/);
      if (h2) {
        const previousUnit = currentUnit;
        if (previousUnit && !featureSet.functionalUnits.some((item) => item.id === previousUnit.id)) {
          previousUnit.summary = previousUnit.summary || previousUnit.documentationNotes?.[0];
          featureSet.functionalUnits.push(previousUnit);
        }

        currentUnit = {
          id: `${doc.featureSetId}.${sectionCounter}`,
          title: h2[1].trim(),
          type: "Documentation",
          status: "active",
          documentationNotes: [],
        };
        sectionCounter += 1;
        continue;
      }

      if (!currentUnit) {
        const topField = line.match(/^- (Goal|Objective|Purpose):\s+(.*)$/);
        if (topField) {
          featureSet.userStory = featureSet.userStory || topField[2].trim();
          featureSet.description = featureSet.description || topField[2].trim();
        }
        continue;
      }

      const bulletMatch = line.match(/^- (.*)$/);
      if (bulletMatch) {
        currentUnit.documentationNotes?.push(bulletMatch[1].trim());
        if (!currentUnit.summary) currentUnit.summary = bulletMatch[1].trim();
        continue;
      }

      if (line.trim().length > 0 && !/^###\s+/.test(line)) {
        currentUnit.documentationNotes?.push(line.trim());
        if (!currentUnit.summary) currentUnit.summary = line.trim();
      }
    }

    if (currentUnit && !featureSet.functionalUnits.some((item) => item.id === currentUnit.id)) {
      currentUnit.summary = currentUnit.summary || currentUnit.documentationNotes?.[0];
      featureSet.functionalUnits.push(currentUnit);
    }

    featureSet.userStory =
      featureSet.userStory ||
      `As a product or implementation team member, I want ${normalizeStoryPhrase(title)} documented so the plan, standard, or operating guidance is visible in the feature tree.`;
    featureSet.intentSummary = featureSet.intentSummary || featureSet.description || featureSet.userStory;

    for (const unit of featureSet.functionalUnits) {
      unit.userStory =
        unit.userStory ||
        `As a team member, I want ${normalizeStoryPhrase(unit.title)} documented so I can understand and apply this guidance without opening a separate document.`;
    }
  }
}

async function parseFtphV21(modules: MutableModule[]) {
  const filePath = path.resolve("docs/roadmap/ftph-v2.1.md");
  const lines = (await readFile(filePath, "utf8")).split(/\r?\n/);

  let currentModule: MutableModule | null = null;
  let currentFeatureSet: MutableFeatureSet | null = null;
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const moduleMatch = line.match(/^##\s+(\d+)\.\s+(.*)$/);
    if (moduleMatch) {
      currentModule = ensureModule(modules, moduleMatch[1]);
      currentModule.title = moduleMatch[2].trim();
      currentFeatureSet = null;
      index += 1;
      continue;
    }

    if (currentModule) {
      const purposeMatch = line.match(/^- Purpose:\s+(.*)$/);
      if (purposeMatch) {
        currentModule.purpose = purposeMatch[1].trim();
        index += 1;
        continue;
      }
    }

    const featureSetMatch = line.match(/^###\s+(\d+\.\d+)\s+Feature Set:\s+(.*)$/);
    if (featureSetMatch && currentModule) {
      currentFeatureSet = ensureFeatureSet(currentModule, {
        id: featureSetMatch[1],
        title: featureSetMatch[2].trim(),
        status: currentModule.status,
        functionalUnits: [],
      });
      index += 1;
      continue;
    }

    if (currentFeatureSet) {
      const fieldMatch = line.match(/^- (Intent Summary|Description|User Story|Scope Boundary|Feature Set-Level Functional Unit Summary|Implementation Notes):\s+(.*)$/);
      if (fieldMatch) {
        const [, field, value] = fieldMatch;
        if (field === "Intent Summary") currentFeatureSet.intentSummary = value.trim();
        if (field === "Description") currentFeatureSet.description = value.trim();
        if (field === "User Story") currentFeatureSet.userStory = value.trim();
        if (field === "Scope Boundary") currentFeatureSet.scopeBoundary = value.trim();
        if (field === "Feature Set-Level Functional Unit Summary") currentFeatureSet.functionalUnitSummary = value.trim();
        if (field === "Implementation Notes") currentFeatureSet.implementationNotes = value.trim();
        index += 1;
        continue;
      }

      const listFieldMatch = line.match(/^- (Dependencies|Risks|Open Questions):\s*$/);
      if (listFieldMatch) {
        const { items, nextIndex } = parseNestedList(lines, index + 1);
        const field = listFieldMatch[1];
        if (field === "Dependencies") currentFeatureSet.dependencies = items;
        if (field === "Risks") currentFeatureSet.risks = items;
        if (field === "Open Questions") currentFeatureSet.openQuestions = items;
        index = nextIndex;
        continue;
      }

      if (/^####\s+Functional Units/.test(line)) {
        index += 1;
        while (index < lines.length) {
          const fuLine = lines[index];
          const fuMatch = fuLine.match(/^- (\d+\.\d+\.\d+)\s+(.*?)\s+\[([^\]]+)\]\s*$/);
          if (!fuMatch) {
            if (/^###\s+/.test(fuLine) || /^##\s+/.test(fuLine)) break;
            index += 1;
            continue;
          }

          const unit: MutableUnit = {
            id: fuMatch[1],
            title: fuMatch[2].trim(),
            type: fuMatch[3].trim(),
            status: currentFeatureSet.status,
            acceptanceCriteria: [],
          };
          index += 1;

          while (index < lines.length) {
            const detailLine = lines[index];
            if (/^- \d+\.\d+\.\d+\s+/.test(detailLine) || /^###\s+/.test(detailLine) || /^##\s+/.test(detailLine)) break;

            const storyMatch = detailLine.match(/^\s{2}- User Story:\s+(.*)$/);
            if (storyMatch) {
              unit.userStory = storyMatch[1].trim();
              index += 1;
              continue;
            }

            if (/^\s{2}- Acceptance Criteria:\s*$/.test(detailLine)) {
              const criteria: string[] = [];
              index += 1;
              while (index < lines.length) {
                const criterionLine = lines[index];
                const criterionMatch = criterionLine.match(/^\s{4}-\s+(.*)$/);
                if (!criterionMatch) break;
                criteria.push(criterionMatch[1].trim());
                index += 1;
              }
              unit.acceptanceCriteria = criteria;
              continue;
            }

            index += 1;
          }

          currentFeatureSet.functionalUnits.push(unit);
        }
        continue;
      }
    }

    index += 1;
  }
}

const workstreamModuleMap: Record<string, string> = {
  "6.1": "3",
  "6.2": "3",
  "6.3": "3",
  "6.4": "3",
  "6.5": "3",
  "7.1": "9",
  "7.2": "9",
  "7.3": "9",
  "7.4": "9",
  "7.5": "9",
  "8.1": "6",
  "8.2": "10",
  "8.3": "4",
  "8.4": "6",
  "8.5": "10",
  "9.1": "11",
  "9.2": "11",
  "9.3": "11",
  "9.4": "11",
  "9.5": "7",
  "10.1": "12",
  "10.2": "8",
  "10.3": "12",
  "10.4": "13",
  "10.5": "13",
  "10.6": "6",
};

async function parseLaterPhases(modules: MutableModule[]) {
  const filePath = path.resolve("docs/roadmap/phases-6-10.md");
  const lines = (await readFile(filePath, "utf8")).split(/\r?\n/);

  let currentFeatureSet: MutableFeatureSet | null = null;
  let currentModule: MutableModule | null = null;
  let index = 0;

  while (index < lines.length) {
    const workstreamMatch = lines[index].match(/^###\s+Workstream\s+(\d+\.\d+)\s+—\s+(.*)$/);
    if (workstreamMatch) {
      const featureSetId = workstreamMatch[1];
      const moduleId = workstreamModuleMap[featureSetId];
      if (!moduleId) {
        index += 1;
        continue;
      }

      currentModule = ensureModule(modules, moduleId);
      currentFeatureSet = ensureFeatureSet(currentModule, {
        id: featureSetId,
        title: workstreamMatch[2].trim(),
        status: currentModule.status,
        functionalUnits: [],
      });
      index += 1;
      continue;
    }

    if (currentFeatureSet) {
      const intentMatch = lines[index].match(/^\*\*Intent:\*\*\s+(.*)$/);
      if (intentMatch) {
        currentFeatureSet.intentSummary = intentMatch[1].trim();
        index += 1;
        continue;
      }

      if (/^\*\*Functional Units:\*\*\s*$/.test(lines[index])) {
        index += 1;
        while (index < lines.length) {
          const fuMatch = lines[index].match(/^- (\d+\.\d+\.\d+)\s+(.*?)\s+\[([^\]]+)\]\s*$/);
          if (!fuMatch) {
            if (/^###\s+Workstream/.test(lines[index]) || /^##\s+/.test(lines[index])) break;
            index += 1;
            continue;
          }

          const unit: MutableUnit = {
            id: fuMatch[1],
            title: fuMatch[2].trim(),
            type: fuMatch[3].trim(),
            status: currentFeatureSet.status,
            documentationNotes: [],
          };
          index += 1;

          while (index < lines.length) {
            const noteMatch = lines[index].match(/^\s{2}-\s+(.*)$/);
            if (!noteMatch) break;
            unit.documentationNotes?.push(noteMatch[1].trim());
            index += 1;
          }

          unit.summary = unit.documentationNotes?.[0] ?? undefined;
          if (!currentFeatureSet.functionalUnits.some((existing) => existing.id === unit.id)) {
            currentFeatureSet.functionalUnits.push(unit);
          }
        }
        continue;
      }
    }

    index += 1;
  }
}

export async function buildFtphDocumentationFeatureTree(): Promise<FtphFeatureTreeResponse> {
  const modules = createSeedModules();
  const resolvedRuleStatuses = await resolveRuleStatuses();
  await parseFtphV21(modules);
  await parseLaterPhases(modules);
  await parseAdditionalCondoManagerDocs(modules);
  applyInferredStories(modules);
  applyStatuses(modules, resolvedRuleStatuses);
  sortModules(modules);

  return {
    modules,
    generatedAt: new Date().toISOString(),
  };
}
