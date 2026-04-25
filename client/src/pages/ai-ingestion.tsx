// zone: Platform
// persona: Platform Admin
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AiExtractedRecord, AiIngestionImportRun, AiIngestionJob, ClauseRecord, ClauseTag, Document, SuggestedLink, Unit } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAssociationContext } from "@/context/association-context";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

type ImportSummaryView = {
  imported: boolean;
  dryRun: boolean;
  targetModule: string;
  sourceRecordId?: string;
  sourceRecordType?: string;
  sourceJobId?: string;
  destinationPlan?: {
    primaryModule: string;
    entityCounts: {
      units: number;
      persons: number;
      ownerships: number;
      contactPoints: number;
      ownerLedgerEntries: number;
      vendorInvoices: number;
      exceptions: number;
    };
    routeReason: string;
  } | null;
  routeMatched?: boolean;
  unresolvedExceptionCount?: number;
  blockingExceptionCount?: number;
  unresolvedExceptions?: OwnerRosterUnresolvedException[];
  createdPersons: number;
  updatedPersons: number;
  createdUnits: number;
  createdOwnerships: number;
  createdVendorInvoices: number;
  createdOwnerLedgerEntries: number;
  skippedRows: number;
  message: string;
  details: Array<{
    module: string;
    action: "create" | "update" | "skip";
    entityKey: string;
    reason: string;
    beforeJson?: unknown;
    afterJson?: unknown;
    suggestions?: string[];
  }>;
};

type BankResolutionHint = {
  txIndex: number;
  reason: "missing-amount" | "invalid-date" | "unit-unresolved" | "person-unresolved";
  transaction: {
    unitNumber: string | null;
    ownerEmail: string | null;
    ownerName: string | null;
    amount: number | null;
    postedAt: string | null;
    description: string | null;
    entryType: "payment" | "charge" | "credit" | "adjustment";
  };
  unitCandidates: Array<{ unitId: string; unitNumber: string }>;
  personCandidates: Array<{ personId: string; name: string; email: string | null; unitNumbers: string[] }>;
};

type NormalizedOwnerCandidate = {
  displayName: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
};

type NormalizedOwnerEntry = {
  buildingAddress: string | null;
  unitNumber: string;
  ownerText: string;
  ownerCandidates: NormalizedOwnerCandidate[];
  phones: string[];
  emails: string[];
  notes: string[];
};

type OwnerRosterUnresolvedException = {
  kind: "unit-unresolved" | "contact-assignment-needed" | "owner-name-incomplete";
  unitNumber: string;
  message: string;
  blocking: boolean;
};

type OperatorCorrection = {
  timestamp: string;
  correctionKey?: string;
  kind: "unit-remap" | "entry-edit" | "candidate-edit" | "candidate-add" | "candidate-remove" | "bank-transaction-edit";
  entryIndex?: number;
  candidateIndex?: number;
  txIndex?: number;
  field?: string;
  before?: unknown;
  after?: unknown;
};

function updateBankStatementTransactionPayload(basePayload: unknown, txIndex: number, patch: Partial<{
  unitNumber: string | null;
  ownerEmail: string | null;
  ownerName: string | null;
}>): unknown {
  if (!basePayload || typeof basePayload !== "object") return basePayload;
  const payload = basePayload as Record<string, unknown>;
  if (!Array.isArray(payload.transactions)) return basePayload;

  const transactions = payload.transactions.map((row, index) => {
    if (index !== txIndex || !row || typeof row !== "object") return row;
    return { ...(row as Record<string, unknown>), ...patch };
  });

  return { ...payload, transactions };
}

function toPrettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

function getNormalizedOwnerEntries(payloadJson: unknown): NormalizedOwnerEntry[] {
  if (!payloadJson || typeof payloadJson !== "object" || Array.isArray(payloadJson)) return [];
  const entries = (payloadJson as Record<string, unknown>).normalizedEntries;
  if (!Array.isArray(entries)) return [];
  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    const unitNumber = typeof row.unitNumber === "string" ? row.unitNumber : "";
    const ownerText = typeof row.ownerText === "string" ? row.ownerText : "";
    const ownerCandidates = Array.isArray(row.ownerCandidates)
      ? row.ownerCandidates.flatMap((candidate) => {
          if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
          const value = candidate as Record<string, unknown>;
          return [{
            displayName: typeof value.displayName === "string" ? value.displayName : "",
            firstName: typeof value.firstName === "string" ? value.firstName : "",
            lastName: typeof value.lastName === "string" ? value.lastName : "",
            email: typeof value.email === "string" ? value.email : null,
            phone: typeof value.phone === "string" ? value.phone : null,
          }];
        })
      : [];
    return [{
      buildingAddress: typeof row.buildingAddress === "string" ? row.buildingAddress : null,
      unitNumber,
      ownerText,
      ownerCandidates,
      phones: Array.isArray(row.phones) ? row.phones.filter((value): value is string => typeof value === "string") : [],
      emails: Array.isArray(row.emails) ? row.emails.filter((value): value is string => typeof value === "string") : [],
      notes: Array.isArray(row.notes) ? row.notes.filter((value): value is string => typeof value === "string") : [],
    }];
  });
}

function getOwnerRosterUnresolvedExceptions(payloadJson: unknown, associationUnits: Unit[] = []): OwnerRosterUnresolvedException[] {
  if (!payloadJson || typeof payloadJson !== "object" || Array.isArray(payloadJson)) return [];
  const payload = payloadJson as Record<string, unknown>;
  const direct = payload.unresolvedExceptions;
  if (Array.isArray(direct)) {
    return direct.flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const row = item as Record<string, unknown>;
      const kind = row.kind;
      if (kind !== "unit-unresolved" && kind !== "contact-assignment-needed" && kind !== "owner-name-incomplete") return [];
      return [{
        kind,
        unitNumber: typeof row.unitNumber === "string" ? row.unitNumber : "",
        message: typeof row.message === "string" ? row.message : "",
        blocking: Boolean(row.blocking),
      }];
    });
  }

  const entries = getNormalizedOwnerEntries(payloadJson);
  const knownUnits = new Set(associationUnits.map((unit) => unit.unitNumber.toUpperCase()));
  const exceptions: OwnerRosterUnresolvedException[] = [];
  for (const entry of entries) {
    if (knownUnits.size > 0 && !knownUnits.has(entry.unitNumber.toUpperCase())) {
      exceptions.push({
        kind: "unit-unresolved",
        unitNumber: entry.unitNumber,
        message: `Unit ${entry.unitNumber} does not match an existing unit in the selected association.`,
        blocking: false,
      });
    }
    if (entry.ownerCandidates.length > 1) {
      const hasSharedEmails = entry.emails.length > 0 && entry.ownerCandidates.some((candidate) => !candidate.email);
      const hasSharedPhones = entry.phones.length > 0 && entry.ownerCandidates.some((candidate) => !candidate.phone);
      if (hasSharedEmails || hasSharedPhones) {
        exceptions.push({
          kind: "contact-assignment-needed",
          unitNumber: entry.unitNumber,
          message: `Unit ${entry.unitNumber} has multiple owners with shared contact data that should be assigned explicitly.`,
          blocking: true,
        });
      }
    }
    if (entry.ownerCandidates.some((candidate) => !candidate.firstName.trim() || !candidate.lastName.trim())) {
      exceptions.push({
        kind: "owner-name-incomplete",
        unitNumber: entry.unitNumber,
        message: `Unit ${entry.unitNumber} has an owner candidate with incomplete first/last name.`,
        blocking: true,
      });
    }
  }
  return exceptions;
}

function buildOwnerItemsFromNormalizedEntries(entries: NormalizedOwnerEntry[]): unknown[] {
  return entries.flatMap((entry) => {
    const candidateCount = entry.ownerCandidates.length;
    return entry.ownerCandidates.map((candidate, index) => ({
      unitNumber: entry.unitNumber,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email ?? entry.emails[index] ?? (candidateCount === 1 ? entry.emails[0] ?? null : null),
      phone: candidate.phone ?? entry.phones[index] ?? (candidateCount === 1 ? entry.phones[0] ?? null : null),
      mailingAddress: entry.buildingAddress,
      ownershipPercentage: candidateCount > 1 ? Number((100 / candidateCount).toFixed(2)) : null,
      startDate: null,
    }));
  });
}

function getOperatorCorrections(payloadJson: unknown): OperatorCorrection[] {
  if (!payloadJson || typeof payloadJson !== "object" || Array.isArray(payloadJson)) return [];
  const corrections = (payloadJson as Record<string, unknown>).operatorCorrections;
  if (!Array.isArray(corrections)) return [];
  return corrections.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const kind = row.kind;
    if (kind !== "unit-remap" && kind !== "entry-edit" && kind !== "candidate-edit" && kind !== "candidate-add" && kind !== "candidate-remove" && kind !== "bank-transaction-edit") {
      return [];
    }
    return [{
      timestamp: typeof row.timestamp === "string" ? row.timestamp : new Date().toISOString(),
      correctionKey: typeof row.correctionKey === "string" ? row.correctionKey : undefined,
      kind,
      entryIndex: typeof row.entryIndex === "number" ? row.entryIndex : undefined,
      candidateIndex: typeof row.candidateIndex === "number" ? row.candidateIndex : undefined,
      txIndex: typeof row.txIndex === "number" ? row.txIndex : undefined,
      field: typeof row.field === "string" ? row.field : undefined,
      before: row.before,
      after: row.after,
    }];
  });
}

function appendOperatorCorrection(basePayload: unknown, correction: OperatorCorrection): unknown {
  if (!basePayload || typeof basePayload !== "object" || Array.isArray(basePayload)) return basePayload;
  const payload = basePayload as Record<string, unknown>;
  const existing = getOperatorCorrections(basePayload);
  const nextCorrections = correction.correctionKey
    ? [
        ...existing.filter((item) => item.correctionKey !== correction.correctionKey),
        correction,
      ]
    : [...existing, correction];
  return {
    ...payload,
    operatorCorrections: nextCorrections,
  };
}

function updateOwnerRosterNormalizedEntryPayload(
  basePayload: unknown,
  entryIndex: number,
  patch: Partial<{
    unitNumber: string;
    buildingAddress: string | null;
    emails: string[];
    phones: string[];
    notes: string[];
  }>,
): unknown {
  if (!basePayload || typeof basePayload !== "object" || Array.isArray(basePayload)) return basePayload;
  const payload = basePayload as Record<string, unknown>;
  const entries = getNormalizedOwnerEntries(basePayload);
  if (!entries[entryIndex]) return basePayload;

  const nextEntries = entries.map((entry, index) => {
    if (index !== entryIndex) return entry;
    return {
      ...entry,
      ...patch,
    };
  });

  return {
    ...payload,
    normalizedEntries: nextEntries,
    items: buildOwnerItemsFromNormalizedEntries(nextEntries),
    itemCount: buildOwnerItemsFromNormalizedEntries(nextEntries).length,
  };
}

function updateOwnerRosterCandidatePayload(
  basePayload: unknown,
  entryIndex: number,
  candidateIndex: number,
  patch: Partial<NormalizedOwnerCandidate>,
): unknown {
  if (!basePayload || typeof basePayload !== "object" || Array.isArray(basePayload)) return basePayload;
  const payload = basePayload as Record<string, unknown>;
  const entries = getNormalizedOwnerEntries(basePayload);
  if (!entries[entryIndex]?.ownerCandidates[candidateIndex]) return basePayload;

  const nextEntries = entries.map((entry, index) => {
    if (index !== entryIndex) return entry;
    return {
      ...entry,
      ownerCandidates: entry.ownerCandidates.map((candidate, innerIndex) => {
        if (innerIndex !== candidateIndex) return candidate;
        return { ...candidate, ...patch };
      }),
    };
  });

  const nextItems = buildOwnerItemsFromNormalizedEntries(nextEntries);
  return {
    ...payload,
    normalizedEntries: nextEntries,
    items: nextItems,
    itemCount: nextItems.length,
  };
}

function addOwnerRosterCandidatePayload(basePayload: unknown, entryIndex: number): unknown {
  if (!basePayload || typeof basePayload !== "object" || Array.isArray(basePayload)) return basePayload;
  const payload = basePayload as Record<string, unknown>;
  const entries = getNormalizedOwnerEntries(basePayload);
  if (!entries[entryIndex]) return basePayload;

  const nextEntries = entries.map((entry, index) => {
    if (index !== entryIndex) return entry;
        return {
          ...entry,
          ownerCandidates: [
            ...entry.ownerCandidates,
        { displayName: "", firstName: "", lastName: "", email: null, phone: null },
      ],
    };
  });
  const nextItems = buildOwnerItemsFromNormalizedEntries(nextEntries);
  return {
    ...payload,
    normalizedEntries: nextEntries,
    items: nextItems,
    itemCount: nextItems.length,
  };
}

function removeOwnerRosterCandidatePayload(basePayload: unknown, entryIndex: number, candidateIndex: number): unknown {
  if (!basePayload || typeof basePayload !== "object" || Array.isArray(basePayload)) return basePayload;
  const payload = basePayload as Record<string, unknown>;
  const entries = getNormalizedOwnerEntries(basePayload);
  if (!entries[entryIndex]?.ownerCandidates[candidateIndex]) return basePayload;

  const nextEntries = entries.map((entry, index) => {
    if (index !== entryIndex) return entry;
    return {
      ...entry,
      ownerCandidates: entry.ownerCandidates.filter((_, innerIndex) => innerIndex !== candidateIndex),
    };
  });
  const nextItems = buildOwnerItemsFromNormalizedEntries(nextEntries);
  return {
    ...payload,
    normalizedEntries: nextEntries,
    items: nextItems,
    itemCount: nextItems.length,
  };
}

function getIngestionTrace(payloadJson: unknown): {
  provider: "openai" | "fallback";
  model: string | null;
  fallbackReason: string | null;
} | null {
  if (!payloadJson || typeof payloadJson !== "object" || Array.isArray(payloadJson)) return null;
  const trace = (payloadJson as Record<string, unknown>)._ingestionTrace;
  if (!trace || typeof trace !== "object" || Array.isArray(trace)) return null;
  const provider = (trace as Record<string, unknown>).provider;
  if (provider !== "openai" && provider !== "fallback") return null;
  return {
    provider,
    model: typeof (trace as Record<string, unknown>).model === "string" ? (trace as Record<string, unknown>).model as string : null,
    fallbackReason: typeof (trace as Record<string, unknown>).fallbackReason === "string" ? (trace as Record<string, unknown>).fallbackReason as string : null,
  };
}

function getExtractionQuality(payloadJson: unknown): {
  score: number;
  warnings: string[];
  format: string;
  strategy?: string;
  destinationModule?: string;
} | null {
  if (!payloadJson || typeof payloadJson !== "object" || Array.isArray(payloadJson)) return null;
  const payload = payloadJson as Record<string, unknown>;
  const quality = payload.extractionQuality;
  if (!quality || typeof quality !== "object" || Array.isArray(quality)) return null;
  const qualityRecord = quality as Record<string, unknown>;
  return {
    score: typeof qualityRecord.score === "number" ? qualityRecord.score : 0,
    warnings: Array.isArray(qualityRecord.warnings)
      ? qualityRecord.warnings.filter((value: unknown): value is string => typeof value === "string")
      : [],
    format: typeof qualityRecord.format === "string" ? qualityRecord.format : "unknown",
    strategy: typeof payload.extractionStrategy === "string" ? payload.extractionStrategy : undefined,
    destinationModule: typeof payload.destinationModule === "string" ? payload.destinationModule : undefined,
  };
}

function getFeedbackSignals(payloadJson: unknown): {
  priorUnitRemaps: number;
  priorOwnerNameFixes: number;
  priorBankTransactionMappings: number;
} | null {
  if (!payloadJson || typeof payloadJson !== "object" || Array.isArray(payloadJson)) return null;
  const signals = (payloadJson as Record<string, unknown>).feedbackSignals;
  if (!signals || typeof signals !== "object" || Array.isArray(signals)) return null;
  const row = signals as Record<string, unknown>;
  return {
    priorUnitRemaps: typeof row.priorUnitRemaps === "number" ? row.priorUnitRemaps : 0,
    priorOwnerNameFixes: typeof row.priorOwnerNameFixes === "number" ? row.priorOwnerNameFixes : 0,
    priorBankTransactionMappings: typeof row.priorBankTransactionMappings === "number" ? row.priorBankTransactionMappings : 0,
  };
}

function getDestinationPlan(payloadJson: unknown): {
  primaryModule: string;
  entityCounts: {
    units: number;
    persons: number;
    ownerships: number;
    contactPoints: number;
    ownerLedgerEntries: number;
    vendorInvoices: number;
    exceptions: number;
  };
  routeReason: string;
} | null {
  if (!payloadJson || typeof payloadJson !== "object" || Array.isArray(payloadJson)) return null;
  const plan = (payloadJson as Record<string, unknown>).destinationPlan;
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return null;
  const row = plan as Record<string, unknown>;
  const entityCounts = row.entityCounts;
  if (!entityCounts || typeof entityCounts !== "object" || Array.isArray(entityCounts)) return null;
  const counts = entityCounts as Record<string, unknown>;
  return {
    primaryModule: typeof row.primaryModule === "string" ? row.primaryModule : "unknown",
    entityCounts: {
      units: typeof counts.units === "number" ? counts.units : 0,
      persons: typeof counts.persons === "number" ? counts.persons : 0,
      ownerships: typeof counts.ownerships === "number" ? counts.ownerships : 0,
      contactPoints: typeof counts.contactPoints === "number" ? counts.contactPoints : 0,
      ownerLedgerEntries: typeof counts.ownerLedgerEntries === "number" ? counts.ownerLedgerEntries : 0,
      vendorInvoices: typeof counts.vendorInvoices === "number" ? counts.vendorInvoices : 0,
      exceptions: typeof counts.exceptions === "number" ? counts.exceptions : 0,
    },
    routeReason: typeof row.routeReason === "string" ? row.routeReason : "",
  };
}


export default function AiIngestionPage() {
  useDocumentTitle("AI Ingestion");
  const { toast } = useToast();
  const [sourceText, setSourceText] = useState("");
  const [contextNotes, setContextNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sourceDocumentId, setSourceDocumentId] = useState("");
  const [rolloutMode, setRolloutMode] = useState<"disabled" | "canary" | "full">("full");
  const [rolloutCanaryPercent, setRolloutCanaryPercent] = useState("100");
  const [rolloutNotes, setRolloutNotes] = useState("");
  const [cleanupRetentionDays, setCleanupRetentionDays] = useState("30");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [includeSupersededOutputs, setIncludeSupersededOutputs] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [lastImportSummary, setLastImportSummary] = useState<ImportSummaryView | null>(null);
  const [recordPayloadOverrides, setRecordPayloadOverrides] = useState<Record<string, unknown>>({});
  const [recordPayloadEditors, setRecordPayloadEditors] = useState<Record<string, string>>({});
  const [selectedClauseId, setSelectedClauseId] = useState("");
  const [clauseReviewFilter, setClauseReviewFilter] = useState<"all" | "pending-review" | "approved" | "rejected">("all");
  const [clauseSearch, setClauseSearch] = useState("");
  const [editedClauseTitle, setEditedClauseTitle] = useState("");
  const [editedClauseText, setEditedClauseText] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newLinkEntityType, setNewLinkEntityType] = useState("governance-template-item");
  const [newLinkEntityId, setNewLinkEntityId] = useState("");
  const [newLinkConfidence, setNewLinkConfidence] = useState("0.70");
  const fileRef = useRef<HTMLInputElement>(null);
  const { associations, activeAssociationId, setActiveAssociationId } = useAssociationContext();
  const { data: runtimeStatus } = useQuery<{
    aiConfigured: boolean;
    provider: "openai" | "fallback";
    model: string | null;
  }>({ queryKey: ["/api/ai/ingestion/runtime-status"] });
  const { data: monitoring } = useQuery<{
    windowDays: number;
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    processingJobs: number;
    queuedJobs: number;
    providerFailureRecords: number;
    parserFallbackRecords: number;
    qualityWarningRecords: number;
    approvedRecords: number;
    rejectedRecords: number;
    previewRuns: number;
    appliedRuns: number;
    noopRuns: number;
    supersededRecords: number;
    supersededClauses: number;
    jobsWithSupersededOutputs: number;
    oldestSupersededAgeDays: number;
    failureRate: number;
    avgDurationMs: number;
    alerts: string[];
  }>({ queryKey: ["/api/ai/ingestion/monitoring"] });
  const { data: cleanupPreview } = useQuery<{
    retentionDays: number;
    purgeableClauses: number;
    purgeableExtractedRecords: number;
    blockedExtractedRecords: number;
    oldestEligibleSupersededAt: string | null;
    message: string;
  }>({
    queryKey: ["/api/ai/ingestion/superseded-cleanup-preview", cleanupRetentionDays],
    queryFn: async () => {
      const retentionDays = Math.max(1, Math.min(365, Math.round(Number(cleanupRetentionDays) || 30)));
      const res = await apiRequest("GET", `/api/ai/ingestion/superseded-cleanup-preview?retentionDays=${retentionDays}`);
      return res.json();
    },
  });
  const { data: rolloutPolicy } = useQuery<{
    associationId: string;
    mode: "disabled" | "canary" | "full";
    canaryPercent: number;
    notes: string;
  }>({
    queryKey: ["/api/ai/ingestion/rollout-policy", activeAssociationId || "none"],
    queryFn: async () => {
      if (!activeAssociationId) {
        return {
          associationId: "",
          mode: "full" as const,
          canaryPercent: 100,
          notes: "",
        };
      }
      const res = await apiRequest("GET", `/api/ai/ingestion/rollout-policy?associationId=${activeAssociationId}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  const { data: jobs } = useQuery<AiIngestionJob[]>({ queryKey: ["/api/ai/ingestion/jobs"] });
  const { data: selectedJobHistory } = useQuery<{
    activeRecordCount: number;
    supersededRecordCount: number;
    activeClauseCount: number;
    supersededClauseCount: number;
    lastSupersededAt: string | null;
  }>({
    queryKey: ["/api/ai/ingestion/jobs", selectedJobId || "none", "history-summary"],
    queryFn: async () => {
      if (!selectedJobId) return {
        activeRecordCount: 0,
        supersededRecordCount: 0,
        activeClauseCount: 0,
        supersededClauseCount: 0,
        lastSupersededAt: null,
      };
      const res = await apiRequest("GET", `/api/ai/ingestion/jobs/${selectedJobId}/history-summary`);
      return res.json();
    },
    enabled: Boolean(selectedJobId),
  });
  const { data: sourceDocuments = [] } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
    enabled: Boolean(activeAssociationId),
  });
  const { data: associationUnits } = useQuery<Unit[]>({
    queryKey: ["/api/units", activeAssociationId || "none"],
    enabled: Boolean(activeAssociationId),
    queryFn: async () => {
      if (!activeAssociationId) return [];
      const res = await apiRequest("GET", `/api/units?associationId=${activeAssociationId}`);
      return res.json();
    },
  });
  const { data: records } = useQuery<AiExtractedRecord[]>({
    queryKey: ["/api/ai/ingestion/jobs", selectedJobId || "none", "records", includeSupersededOutputs ? "with-superseded" : "active-only"],
    queryFn: async () => {
      if (!selectedJobId) return [];
      const suffix = includeSupersededOutputs ? "?includeSuperseded=1" : "";
      const res = await apiRequest("GET", `/api/ai/ingestion/jobs/${selectedJobId}/records${suffix}`);
      return res.json();
    },
    enabled: Boolean(selectedJobId),
  });
  const { data: importRuns } = useQuery<AiIngestionImportRun[]>({
    queryKey: ["/api/ai/ingestion/records", selectedRecordId || "none", "import-runs"],
    queryFn: async () => {
      if (!selectedRecordId) return [];
      const res = await apiRequest("GET", `/api/ai/ingestion/records/${selectedRecordId}/import-runs`);
      return res.json();
    },
    enabled: Boolean(selectedRecordId),
  });
  const selectedRecord = useMemo(
    () => (records ?? []).find((record) => record.id === selectedRecordId) ?? null,
    [records, selectedRecordId],
  );
  const { data: bankResolutionHints } = useQuery<BankResolutionHint[]>({
    queryKey: ["/api/ai/ingestion/records", selectedRecordId || "none", "bank-resolution"],
    queryFn: async () => {
      if (!selectedRecordId) return [];
      const res = await apiRequest("GET", `/api/ai/ingestion/records/${selectedRecordId}/bank-resolution`);
      return res.json();
    },
    enabled: Boolean(selectedRecordId && selectedRecord?.recordType === "bank-statement"),
  });
  const clauseQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedJobId) params.set("ingestionJobId", selectedJobId);
    if (clauseReviewFilter !== "all") params.set("reviewStatus", clauseReviewFilter);
    if (clauseSearch.trim()) params.set("q", clauseSearch.trim());
    if (includeSupersededOutputs) params.set("includeSuperseded", "1");
    return params.toString();
  }, [clauseReviewFilter, clauseSearch, includeSupersededOutputs, selectedJobId]);
  const { data: clauses } = useQuery<ClauseRecord[]>({
    queryKey: ["/api/ai/ingestion/clauses", clauseQueryString || "none"],
    queryFn: async () => {
      const suffix = clauseQueryString ? `?${clauseQueryString}` : "";
      const res = await apiRequest("GET", `/api/ai/ingestion/clauses${suffix}`);
      return res.json();
    },
  });
  const selectedClause = useMemo(
    () => (clauses ?? []).find((clause) => clause.id === selectedClauseId) ?? null,
    [clauses, selectedClauseId],
  );
  const sourceDocumentById = useMemo(
    () => new Map(sourceDocuments.map((document) => [document.id, document])),
    [sourceDocuments],
  );
  const { data: clauseTags } = useQuery<ClauseTag[]>({
    queryKey: ["/api/ai/ingestion/clauses", selectedClauseId || "none", "tags"],
    queryFn: async () => {
      if (!selectedClauseId) return [];
      const res = await apiRequest("GET", `/api/ai/ingestion/clauses/${selectedClauseId}/tags`);
      return res.json();
    },
    enabled: Boolean(selectedClauseId),
  });
  const { data: suggestedLinks } = useQuery<SuggestedLink[]>({
    queryKey: ["/api/ai/ingestion/clauses", selectedClauseId || "none", "suggested-links"],
    queryFn: async () => {
      if (!selectedClauseId) return [];
      const res = await apiRequest("GET", `/api/ai/ingestion/clauses/${selectedClauseId}/suggested-links`);
      return res.json();
    },
    enabled: Boolean(selectedClauseId),
  });
  const { data: approvedGovernanceLinks } = useQuery<
    Array<{
      clauseRecordId: string;
      clauseTitle: string;
      clauseText: string;
      entityType: string;
      entityId: string;
      confidenceScore: number | null;
      isApproved: number;
    }>
  >({
    queryKey: ["/api/ai/ingestion/governance/approved-links"],
  });

  useEffect(() => {
    if (!records?.length) {
      setSelectedRecordId("");
      return;
    }
    if (!selectedRecordId || !records.some((record) => record.id === selectedRecordId)) {
      setSelectedRecordId(records[0].id);
    }
  }, [records, selectedRecordId]);

  useEffect(() => {
    if (!selectedRecord) return;
    setRecordPayloadOverrides((previous) => {
      if (previous[selectedRecord.id] != null) return previous;
      return { ...previous, [selectedRecord.id]: selectedRecord.payloadJson };
    });
    setRecordPayloadEditors((previous) => {
      if (previous[selectedRecord.id] != null) return previous;
      return { ...previous, [selectedRecord.id]: toPrettyJson(selectedRecord.payloadJson) };
    });
  }, [selectedRecord?.id]);

  useEffect(() => {
    if (!rolloutPolicy) return;
    setRolloutMode(rolloutPolicy.mode);
    setRolloutCanaryPercent(String(rolloutPolicy.canaryPercent));
    setRolloutNotes(rolloutPolicy.notes || "");
  }, [rolloutPolicy?.associationId, rolloutPolicy?.mode, rolloutPolicy?.canaryPercent, rolloutPolicy?.notes]);

  useEffect(() => {
    if (!clauses?.length) {
      setSelectedClauseId("");
      return;
    }
    if (!selectedClauseId || !clauses.some((clause) => clause.id === selectedClauseId)) {
      setSelectedClauseId(clauses[0].id);
    }
  }, [clauses, selectedClauseId]);

  useEffect(() => {
    if (!selectedClause) return;
    setEditedClauseTitle(selectedClause.title);
    setEditedClauseText(selectedClause.clauseText);
  }, [selectedClause?.id]);

  useEffect(() => {
    setIncludeSupersededOutputs(false);
  }, [selectedJobId]);

  useEffect(() => {
    if (!sourceDocumentId) return;
    if (!sourceDocumentById.has(sourceDocumentId)) {
      setSourceDocumentId("");
    }
  }, [sourceDocumentId, sourceDocumentById]);

  const submitJob = useMutation({
    mutationFn: async () => {
      if (!file && !sourceText.trim() && !sourceDocumentId) {
        throw new Error("Upload a file, paste source text, or select a repository document");
      }
      const fd = new FormData();
      if (activeAssociationId) fd.append("associationId", activeAssociationId);
      if (sourceText.trim()) fd.append("sourceText", sourceText.trim());
      if (contextNotes.trim()) fd.append("contextNotes", contextNotes.trim());
      if (sourceDocumentId) fd.append("sourceDocumentId", sourceDocumentId);
      if (file) fd.append("file", file);
      const res = await fetch("/api/ai/ingestion/jobs", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (job: AiIngestionJob) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/ingestion/jobs"] });
      setSelectedJobId(job.id);
      setSourceText("");
      setContextNotes("");
      setFile(null);
      setSourceDocumentId("");
      toast({ title: "Ingestion job created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const saveRolloutPolicy = useMutation({
    mutationFn: async () => {
      if (!activeAssociationId) throw new Error("Select an association first.");
      const percent = Math.max(0, Math.min(100, Math.round(Number(rolloutCanaryPercent) || 0)));
      const res = await apiRequest("POST", "/api/ai/ingestion/rollout-policy", {
        associationId: activeAssociationId,
        mode: rolloutMode,
        canaryPercent: percent,
        notes: rolloutNotes.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/ingestion/rollout-policy"] });
      toast({ title: "Rollout policy updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const runSupersededCleanup = useMutation({
    mutationFn: async () => {
      const retentionDays = Math.max(1, Math.min(365, Math.round(Number(cleanupRetentionDays) || 30)));
      const res = await apiRequest("POST", "/api/ai/ingestion/superseded-cleanup", { retentionDays });
      return res.json() as Promise<{
        retentionDays: number;
        deletedClauses: number;
        deletedClauseTags: number;
        deletedSuggestedLinks: number;
        deletedExtractedRecords: number;
        blockedExtractedRecords: number;
        message: string;
      }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/ingestion/monitoring"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/ingestion/superseded-cleanup-preview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/ingestion/jobs"] });
      if (selectedJobId) {
        queryClient.invalidateQueries({ queryKey: ["/api/ai/ingestion/jobs", selectedJobId, "history-summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/ai/ingestion/jobs", selectedJobId, "records"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/ai/ingestion/clauses"] });
      toast({ title: "Superseded cleanup complete", description: result.message });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const processJob = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiRequest("POST", `/api/ai/ingestion/jobs/${jobId}/process`);
      return res.json();
    },
    onSuccess: (_job, jobId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/ingestion/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/ingestion/jobs", jobId, "records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/ingestion/jobs", jobId, "history-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/ingestion/clauses"] });
      setSelectedJobId(jobId);
      toast({ title: "Extraction completed" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const reviewRecord = useMutation({
    mutationFn: async ({
      id,
      reviewStatus,
      importMode,
      payloadJson,
    }: {
      id: string;
      reviewStatus: "approved" | "rejected";
      importMode?: "preview" | "commit";
      payloadJson?: unknown;
    }) => {
      const res = await apiRequest("PATCH", `/api/ai/ingestion/records/${id}/review`, { reviewStatus, importMode, payloadJson });
      return res.json();
    },
    onSuccess: (result: AiExtractedRecord & {
      importSummary?: ImportSummaryView | null;
    }) => {
      if (selectedJobId) queryClient.invalidateQueries({ queryKey: ["/api/ai/ingestion/jobs", selectedJobId, "records"] });
      if (selectedRecordId) queryClient.invalidateQueries({ queryKey: ["/api/ai/ingestion/records", selectedRecordId, "import-runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ownerships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/persons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/units"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial/owner-ledger/entries"] });
      const summary = result.importSummary;
      if (summary) setLastImportSummary(summary);
      if (summary?.dryRun) {
        toast({
          title: "Preview complete",
          description: summary.message,
        });
        return;
      }
      if (summary?.imported) {
        toast({
          title: "Approved and imported",
          description: summary.message,
        });
        return;
      }
      toast({ title: "Record review updated" });
    },
  });
  const rollbackImportRun = useMutation({
    mutationFn: async (runId: string) => {
      const res = await apiRequest("POST", `/api/ai/ingestion/import-runs/${runId}/rollback`);
      return res.json();
    },
    onSuccess: () => {
      if (selectedRecordId) queryClient.invalidateQueries({ queryKey: ["/api/ai/ingestion/records", selectedRecordId, "import-runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial/owner-ledger/entries"] });
      toast({ title: "Rollback complete" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const previewRollbackImportRun = useMutation({
    mutationFn: async (runId: string) => {
      const res = await apiRequest("GET", `/api/ai/ingestion/import-runs/${runId}/rollback-preview`);
      return res.json() as Promise<{
        canRollback: boolean;
        vendorInvoicesToDelete: number;
        ownerLedgerEntriesToDelete: number;
        missingRefs: number;
        message: string;
      }>;
    },
    onSuccess: (result) => {
      toast({ title: "Rollback preview", description: result.message });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const reprocessImportRun = useMutation({
    mutationFn: async ({ runId, rollbackFirst }: { runId: string; rollbackFirst?: boolean }) => {
      const res = await apiRequest("POST", `/api/ai/ingestion/import-runs/${runId}/reprocess`, { rollbackFirst: Boolean(rollbackFirst) });
      return res.json() as Promise<{
        reprocessed: boolean;
        ingestionJobId: string | null;
        rolledBack: boolean;
        message: string;
      }>;
    },
    onSuccess: (result) => {
      if (selectedJobId) queryClient.invalidateQueries({ queryKey: ["/api/ai/ingestion/jobs", selectedJobId, "records"] });
      if (selectedRecordId) queryClient.invalidateQueries({ queryKey: ["/api/ai/ingestion/records", selectedRecordId, "import-runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/ingestion/jobs"] });
      toast({ title: "Reprocess result", description: result.message });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const applyBankResolutionMapping = (
    recordId: string,
    txIndex: number,
    patch: Partial<{ unitNumber: string | null; ownerEmail: string | null; ownerName: string | null }>,
  ) => {
    setRecordPayloadOverrides((previous) => {
      const basePayload = previous[recordId] ?? selectedRecord?.payloadJson ?? null;
      const nextPayloadBase = updateBankStatementTransactionPayload(basePayload, txIndex, patch);
      const transactionBefore = (() => {
        if (!basePayload || typeof basePayload !== "object" || Array.isArray(basePayload)) return null;
        const payload = basePayload as Record<string, unknown>;
        return Array.isArray(payload.transactions) && payload.transactions[txIndex] && typeof payload.transactions[txIndex] === "object"
          ? payload.transactions[txIndex] as Record<string, unknown>
          : null;
      })();
      const nextPayload = Object.entries(patch).reduce((payload, [field, after]) => {
        const before = transactionBefore?.[field];
        if (JSON.stringify(before) === JSON.stringify(after)) return payload;
        return appendOperatorCorrection(payload, {
          timestamp: new Date().toISOString(),
          correctionKey: `bank:${txIndex}:${field}`,
          kind: "bank-transaction-edit",
          txIndex,
          field,
          before,
          after,
        });
      }, nextPayloadBase);
      setRecordPayloadEditors((textPrev) => ({
        ...textPrev,
        [recordId]: toPrettyJson(nextPayload),
      }));
      return {
        ...previous,
        [recordId]: nextPayload,
      };
    });
  };
  const applyOwnerRosterNormalizedPatch = (
    recordId: string,
    entryIndex: number,
    patch: Partial<{
      unitNumber: string;
      buildingAddress: string | null;
      emails: string[];
      phones: string[];
      notes: string[];
    }>,
  ) => {
    setRecordPayloadOverrides((previous) => {
      const basePayload = previous[recordId] ?? selectedRecord?.payloadJson ?? null;
      const nextPayloadBase = updateOwnerRosterNormalizedEntryPayload(basePayload, entryIndex, patch);
      const nextPayload = Object.entries(patch).reduce((payload, [field, after]) => {
        const before = getNormalizedOwnerEntries(basePayload)[entryIndex]?.[field as keyof NormalizedOwnerEntry];
        if (JSON.stringify(before) === JSON.stringify(after)) return payload;
        return appendOperatorCorrection(payload, {
          timestamp: new Date().toISOString(),
          correctionKey: `entry:${entryIndex}:${field}`,
          kind: field === "unitNumber" ? "unit-remap" : "entry-edit",
          entryIndex,
          field,
          before,
          after,
        });
      }, nextPayloadBase);
      setRecordPayloadEditors((textPrev) => ({
        ...textPrev,
        [recordId]: toPrettyJson(nextPayload),
      }));
      return {
        ...previous,
        [recordId]: nextPayload,
      };
    });
  };
  const applyOwnerRosterCandidatePatch = (
    recordId: string,
    entryIndex: number,
    candidateIndex: number,
    patch: Partial<NormalizedOwnerCandidate>,
  ) => {
    setRecordPayloadOverrides((previous) => {
      const basePayload = previous[recordId] ?? selectedRecord?.payloadJson ?? null;
      const nextPayloadBase = updateOwnerRosterCandidatePayload(basePayload, entryIndex, candidateIndex, patch);
      const nextPayload = Object.entries(patch).reduce((payload, [field, after]) => {
        const before = getNormalizedOwnerEntries(basePayload)[entryIndex]?.ownerCandidates[candidateIndex]?.[field as keyof NormalizedOwnerCandidate];
        if (JSON.stringify(before) === JSON.stringify(after)) return payload;
        return appendOperatorCorrection(payload, {
          timestamp: new Date().toISOString(),
          correctionKey: `candidate:${entryIndex}:${candidateIndex}:${field}`,
          kind: "candidate-edit",
          entryIndex,
          candidateIndex,
          field,
          before,
          after,
        });
      }, nextPayloadBase);
      setRecordPayloadEditors((textPrev) => ({
        ...textPrev,
        [recordId]: toPrettyJson(nextPayload),
      }));
      return {
        ...previous,
        [recordId]: nextPayload,
      };
    });
  };
  const addOwnerRosterCandidate = (recordId: string, entryIndex: number) => {
    setRecordPayloadOverrides((previous) => {
      const basePayload = previous[recordId] ?? selectedRecord?.payloadJson ?? null;
      const nextPayload = appendOperatorCorrection(addOwnerRosterCandidatePayload(basePayload, entryIndex), {
        timestamp: new Date().toISOString(),
        kind: "candidate-add",
        entryIndex,
      });
      setRecordPayloadEditors((textPrev) => ({
        ...textPrev,
        [recordId]: toPrettyJson(nextPayload),
      }));
      return {
        ...previous,
        [recordId]: nextPayload,
      };
    });
  };
  const removeOwnerRosterCandidate = (recordId: string, entryIndex: number, candidateIndex: number) => {
    setRecordPayloadOverrides((previous) => {
      const basePayload = previous[recordId] ?? selectedRecord?.payloadJson ?? null;
      const removedCandidate = getNormalizedOwnerEntries(basePayload)[entryIndex]?.ownerCandidates[candidateIndex] ?? null;
      const nextPayload = appendOperatorCorrection(removeOwnerRosterCandidatePayload(basePayload, entryIndex, candidateIndex), {
        timestamp: new Date().toISOString(),
        kind: "candidate-remove",
        entryIndex,
        candidateIndex,
        before: removedCandidate,
      });
      setRecordPayloadEditors((textPrev) => ({
        ...textPrev,
        [recordId]: toPrettyJson(nextPayload),
      }));
      return {
        ...previous,
        [recordId]: nextPayload,
      };
    });
  };
  const selectedPayloadText = selectedRecord ? (recordPayloadEditors[selectedRecord.id] ?? toPrettyJson(selectedRecord.payloadJson)) : "";
  const selectedPayloadParse = useMemo(() => {
    if (!selectedRecord) {
      return { value: null as unknown, error: null as string | null };
    }
    try {
      return {
        value: JSON.parse(selectedPayloadText),
        error: null as string | null,
      };
    } catch (error: any) {
      return {
        value: null,
        error: error?.message || "Invalid JSON payload",
      };
    }
  }, [selectedPayloadText, selectedRecord?.id]);
  const runSelectedRecordReview = (
    reviewStatus: "approved" | "rejected",
    importMode?: "preview" | "commit",
  ) => {
    if (!selectedRecord) return;
    if (reviewStatus === "approved" && selectedPayloadParse.error) {
      toast({
        title: "Invalid payload JSON",
        description: selectedPayloadParse.error,
        variant: "destructive",
      });
      return;
    }
    const payloadJson = reviewStatus === "approved"
      ? (selectedPayloadParse.value ?? selectedRecord.payloadJson)
      : undefined;
    if (payloadJson != null) {
      setRecordPayloadOverrides((previous) => ({
        ...previous,
        [selectedRecord.id]: payloadJson,
      }));
    }
    reviewRecord.mutate({
      id: selectedRecord.id,
      reviewStatus,
      importMode,
      payloadJson,
    });
  };
  const reviewClause = useMutation({
    mutationFn: async ({
      id,
      reviewStatus,
      title,
      clauseText,
    }: {
      id: string;
      reviewStatus: "approved" | "rejected";
      title: string;
      clauseText: string;
    }) => {
      const res = await apiRequest("PATCH", `/api/ai/ingestion/clauses/${id}/review`, { reviewStatus, title, clauseText });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/ingestion/clauses"] });
      if (selectedClauseId) queryClient.invalidateQueries({ queryKey: ["/api/ai/ingestion/clauses", selectedClauseId, "tags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/ingestion/governance/approved-links"] });
      toast({ title: "Clause review updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const createClauseTag = useMutation({
    mutationFn: async ({ clauseId, tag }: { clauseId: string; tag: string }) => {
      const res = await apiRequest("POST", `/api/ai/ingestion/clauses/${clauseId}/tags`, { tag });
      return res.json();
    },
    onSuccess: () => {
      setNewTag("");
      if (selectedClauseId) queryClient.invalidateQueries({ queryKey: ["/api/ai/ingestion/clauses", selectedClauseId, "tags"] });
    },
  });
  const createSuggestedLink = useMutation({
    mutationFn: async ({
      clauseId,
      entityType,
      entityId,
      confidenceScore,
    }: {
      clauseId: string;
      entityType: string;
      entityId: string;
      confidenceScore: number | null;
    }) => {
      const res = await apiRequest("POST", `/api/ai/ingestion/clauses/${clauseId}/suggested-links`, {
        entityType,
        entityId,
        confidenceScore,
      });
      return res.json();
    },
    onSuccess: () => {
      if (selectedClauseId) queryClient.invalidateQueries({ queryKey: ["/api/ai/ingestion/clauses", selectedClauseId, "suggested-links"] });
      setNewLinkEntityId("");
      toast({ title: "Suggested link created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const updateSuggestedLink = useMutation({
    mutationFn: async ({ id, isApproved }: { id: string; isApproved: boolean }) => {
      const res = await apiRequest("PATCH", `/api/ai/ingestion/suggested-links/${id}`, { isApproved });
      return res.json();
    },
    onSuccess: () => {
      if (selectedClauseId) queryClient.invalidateQueries({ queryKey: ["/api/ai/ingestion/clauses", selectedClauseId, "suggested-links"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/ingestion/governance/approved-links"] });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tight text-on-surface">AI Ingestion</h1>
        <p className="text-sm text-on-surface/60 mt-1">Upload raw files or paste text, then review extracted records before approval.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <Badge variant={runtimeStatus?.aiConfigured ? "default" : "outline"}>
            {runtimeStatus?.aiConfigured ? `AI enabled: ${runtimeStatus.model}` : "Fallback extraction mode"}
          </Badge>
          <span className="text-muted-foreground">
            Owner roster approvals apply rows into owners data for the selected association.
          </span>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Rollout Monitoring</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <div className="border rounded-md p-3">
              <div className="text-xs text-muted-foreground">Jobs ({monitoring?.windowDays ?? 14}d)</div>
              <div className="font-semibold">{monitoring?.totalJobs ?? 0}</div>
            </div>
            <div className="border rounded-md p-3">
              <div className="text-xs text-muted-foreground">Failed</div>
              <div className="font-semibold">{monitoring?.failedJobs ?? 0}</div>
            </div>
            <div className="border rounded-md p-3">
              <div className="text-xs text-muted-foreground">Failure Rate</div>
              <div className="font-semibold">{monitoring ? `${Math.round(monitoring.failureRate * 100)}%` : "0%"}</div>
            </div>
            <div className="border rounded-md p-3">
              <div className="text-xs text-muted-foreground">Avg Duration</div>
              <div className="font-semibold">{monitoring ? `${Math.round(monitoring.avgDurationMs / 1000)}s` : "0s"}</div>
            </div>
            <div className="border rounded-md p-3">
              <div className="text-xs text-muted-foreground">Approvals / Rejections</div>
              <div className="font-semibold">{monitoring?.approvedRecords ?? 0} / {monitoring?.rejectedRecords ?? 0}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div className="border rounded-md p-3">
              <div className="text-xs text-muted-foreground">Preview Runs</div>
              <div className="font-semibold">{monitoring?.previewRuns ?? 0}</div>
            </div>
            <div className="border rounded-md p-3">
              <div className="text-xs text-muted-foreground">Applied Runs</div>
              <div className="font-semibold">{monitoring?.appliedRuns ?? 0}</div>
            </div>
            <div className="border rounded-md p-3">
              <div className="text-xs text-muted-foreground">No-op Runs</div>
              <div className="font-semibold">{monitoring?.noopRuns ?? 0}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div className="border rounded-md p-3">
              <div className="text-xs text-muted-foreground">Provider Failures</div>
              <div className="font-semibold">{monitoring?.providerFailureRecords ?? 0}</div>
            </div>
            <div className="border rounded-md p-3">
              <div className="text-xs text-muted-foreground">Parser Fallback Records</div>
              <div className="font-semibold">{monitoring?.parserFallbackRecords ?? 0}</div>
            </div>
            <div className="border rounded-md p-3">
              <div className="text-xs text-muted-foreground">Quality Warning Records</div>
              <div className="font-semibold">{monitoring?.qualityWarningRecords ?? 0}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="border rounded-md p-3">
              <div className="text-xs text-muted-foreground">Superseded Records</div>
              <div className="font-semibold">{monitoring?.supersededRecords ?? 0}</div>
            </div>
            <div className="border rounded-md p-3">
              <div className="text-xs text-muted-foreground">Superseded Clauses</div>
              <div className="font-semibold">{monitoring?.supersededClauses ?? 0}</div>
            </div>
            <div className="border rounded-md p-3">
              <div className="text-xs text-muted-foreground">Jobs With History</div>
              <div className="font-semibold">{monitoring?.jobsWithSupersededOutputs ?? 0}</div>
            </div>
            <div className="border rounded-md p-3">
              <div className="text-xs text-muted-foreground">Oldest Superseded Age</div>
              <div className="font-semibold">{monitoring?.oldestSupersededAgeDays ?? 0}d</div>
            </div>
          </div>
          <div className="space-y-1">
            {(monitoring?.alerts ?? ["No active ingestion alerts."]).map((alert, index) => (
              <div key={`${alert}:${index}`} className="text-xs text-muted-foreground border rounded-md p-2">{alert}</div>
            ))}
          </div>
          <div className="border rounded-md p-3 space-y-2">
            <div className="text-sm font-medium">Superseded Cleanup</div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <Input
                value={cleanupRetentionDays}
                onChange={(e) => setCleanupRetentionDays(e.target.value)}
                placeholder="retention days"
              />
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground md:col-span-2">
                {cleanupPreview?.message || "Calculating purgeable superseded outputs..."}
              </div>
              <Button onClick={() => runSupersededCleanup.mutate()} disabled={runSupersededCleanup.isPending}>
                Run Cleanup
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="border rounded-md p-3">
                <div className="text-xs text-muted-foreground">Purgeable Clauses</div>
                <div className="font-semibold">{cleanupPreview?.purgeableClauses ?? 0}</div>
              </div>
              <div className="border rounded-md p-3">
                <div className="text-xs text-muted-foreground">Purgeable Records</div>
                <div className="font-semibold">{cleanupPreview?.purgeableExtractedRecords ?? 0}</div>
              </div>
              <div className="border rounded-md p-3">
                <div className="text-xs text-muted-foreground">Blocked Records</div>
                <div className="font-semibold">{cleanupPreview?.blockedExtractedRecords ?? 0}</div>
              </div>
              <div className="border rounded-md p-3">
                <div className="text-xs text-muted-foreground">Oldest Eligible</div>
                <div className="font-semibold">
                  {cleanupPreview?.oldestEligibleSupersededAt ? new Date(cleanupPreview.oldestEligibleSupersededAt).toLocaleDateString() : "-"}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Submit Source</h2>
            <p className="text-sm text-muted-foreground">
              Choose the association, provide the source material, and add brief context so the engine can route the content into the right module.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-2">
              <div className="text-sm font-medium">Association</div>
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <span className="font-medium">{associations.find((association) => association.id === activeAssociationId)?.name || "None selected"}</span>
              </div>
              <div className="text-xs text-muted-foreground">Change the global association context to route ingestion into a different association.</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Upload File</div>
              <div className="border rounded-md p-2 text-sm cursor-pointer" onClick={() => fileRef.current?.click()}>
                {file?.name || "Choose source file"}
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
              <div className="text-xs text-muted-foreground">Use this for PDFs, DOCX minutes, XLSX exports, text files, CSVs, and other raw source documents.</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Repository Document</div>
              <Select value={sourceDocumentId || "none"} onValueChange={(value) => setSourceDocumentId(value === "none" ? "" : value)}>
                <SelectTrigger><SelectValue placeholder="Optional linked document" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No linked document</SelectItem>
                  {sourceDocuments.map((document) => (
                    <SelectItem key={document.id} value={document.id}>{document.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground">Select an existing repository document to keep clause extraction traceable to the source file.</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Create Job</div>
              <Button onClick={() => submitJob.mutate()} disabled={submitJob.isPending} className="w-full">Submit Ingestion Job</Button>
              <div className="text-xs text-muted-foreground">This stages the source so you can process and review extracted records. A repository document can be used with or without a fresh upload.</div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Pasted Source Text</div>
            <Textarea rows={6} placeholder="Paste owner rosters, invoices, bank exports, meeting notes, or other source text here..." value={sourceText} onChange={(e) => setSourceText(e.target.value)} />
            <div className="text-xs text-muted-foreground">Use pasted text when you need to supplement a difficult binary extraction or copied content from an email, report, or spreadsheet.</div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Content Context</div>
            <Textarea
              rows={3}
              placeholder="Describe what this source is and what should happen with it. Example: 'Owner contact roster for Boardwalk Condos. Match unit letters to owners and populate owner contact details.'"
              value={contextNotes}
              onChange={(e) => setContextNotes(e.target.value)}
            />
            <div className="text-xs text-muted-foreground">This is not a rollout setting. It tells the ingestion engine how to interpret the source.</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Platform Rollout</h2>
            <p className="text-sm text-muted-foreground">
              Administrative controls for enabling or limiting AI ingestion for the selected association. These settings are separate from submitting a source document.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <Select value={rolloutMode} onValueChange={(value) => setRolloutMode(value as "disabled" | "canary" | "full")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="disabled">disabled</SelectItem>
                <SelectItem value="canary">canary</SelectItem>
                <SelectItem value="full">full</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={rolloutCanaryPercent}
              onChange={(e) => setRolloutCanaryPercent(e.target.value)}
              placeholder="canary % (0-100)"
              disabled={rolloutMode !== "canary"}
            />
            <Input
              className="md:col-span-2"
              value={rolloutNotes}
              onChange={(e) => setRolloutNotes(e.target.value)}
              placeholder="Platform rollout notes"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => saveRolloutPolicy.mutate()} disabled={saveRolloutPolicy.isPending || !activeAssociationId}>
              Save Rollout Policy
            </Button>
            <span className="text-xs text-muted-foreground">
              Current: {rolloutPolicy ? `${rolloutPolicy.mode} (${rolloutPolicy.canaryPercent}%)` : "n/a"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Job</TableHead><TableHead>Source</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {(jobs ?? []).map((job) => (
                <TableRow key={job.id}>
                  <TableCell>{job.id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <div>{job.sourceFilename || (job.sourceText ? "Pasted text" : "-")}</div>
                    {job.sourceDocumentId ? (
                      <div className="text-xs text-muted-foreground">
                        Document: {sourceDocumentById.get(job.sourceDocumentId)?.title || job.sourceDocumentId}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell><Badge variant="secondary">{job.status}</Badge></TableCell>
                  <TableCell>{new Date(job.createdAt).toLocaleString()}</TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" variant="outline" onClick={() => setSelectedJobId(job.id)}>View Records</Button>
                    <Button size="sm" onClick={() => processJob.mutate(job.id)} disabled={processJob.isPending || job.status === "processing"}>Process</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedJobId ? (
        <Card>
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-sm font-medium">Job History</div>
              <div className="text-xs text-muted-foreground">
                Active records {selectedJobHistory?.activeRecordCount ?? 0} · superseded records {selectedJobHistory?.supersededRecordCount ?? 0} · active clauses {selectedJobHistory?.activeClauseCount ?? 0} · superseded clauses {selectedJobHistory?.supersededClauseCount ?? 0}
              </div>
              {selectedJobHistory?.lastSupersededAt ? (
                <div className="text-xs text-muted-foreground">
                  Last superseded output: {new Date(selectedJobHistory.lastSupersededAt).toLocaleString()}
                </div>
              ) : null}
            </div>
            <Button variant={includeSupersededOutputs ? "default" : "outline"} size="sm" onClick={() => setIncludeSupersededOutputs((current) => !current)}>
              {includeSupersededOutputs ? "Hide Superseded Outputs" : "Show Superseded Outputs"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Record</TableHead><TableHead>Confidence</TableHead><TableHead>Review</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {(records ?? []).map((record) => (
                <TableRow key={record.id}>
                  {(() => {
                    const trace = getIngestionTrace(record.payloadJson);
                    return (
                  <TableCell>
                    <div className="font-medium">{record.recordType}</div>
                    <div className="text-xs text-muted-foreground">{record.id.slice(0, 8)}</div>
                    {record.supersededAt ? (
                      <div className="text-xs text-amber-700">Superseded {new Date(record.supersededAt).toLocaleString()}</div>
                    ) : null}
                    {trace ? (
                      <div className="text-xs text-muted-foreground">
                        {trace.provider === "openai" ? `AI${trace.model ? ` (${trace.model})` : ""}` : "Fallback parser"}
                      </div>
                    ) : null}
                  </TableCell>
                    );
                  })()}
                  <TableCell>{record.confidenceScore ? `${Math.round(record.confidenceScore * 100)}%` : "-"}</TableCell>
                  <TableCell><Badge variant={record.reviewStatus === "approved" ? "default" : record.reviewStatus === "rejected" ? "destructive" : "outline"}>{record.reviewStatus}</Badge></TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" variant={selectedRecordId === record.id ? "default" : "outline"} onClick={() => setSelectedRecordId(record.id)}>Review</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedRecord ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            {(() => {
              const trace = getIngestionTrace(selectedRecord.payloadJson);
              return (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-medium">Record Review Workspace</div>
                <div className="text-xs text-muted-foreground">
                  {selectedRecord.recordType} · record {selectedRecord.id.slice(0, 8)} · job {selectedRecord.jobId.slice(0, 8)}
                </div>
                {trace ? (
                  <div className="text-xs text-muted-foreground">
                    Extraction path: {trace.provider === "openai" ? `AI${trace.model ? ` (${trace.model})` : ""}` : "fallback parser"}
                    {trace.fallbackReason ? ` · ${trace.fallbackReason}` : ""}
                  </div>
                ) : null}
                {(() => {
                  const quality = getExtractionQuality(selectedRecord.payloadJson);
                  if (!quality) return null;
                  return (
                    <div className="text-xs text-muted-foreground">
                      Routed to: {quality.destinationModule || "unknown"} · format: {quality.format} · strategy: {quality.strategy || "unknown"} · quality {Math.round(quality.score * 100)}%
                      {quality.warnings.length ? ` · warnings: ${quality.warnings.join(" | ")}` : ""}
                    </div>
                  );
                })()}
                {(() => {
                  const destinationPlan = getDestinationPlan(selectedRecord.payloadJson);
                  if (!destinationPlan) return null;
                  return (
                    <div className="text-xs text-muted-foreground">
                      Route plan: {destinationPlan.primaryModule} · units {destinationPlan.entityCounts.units} · persons {destinationPlan.entityCounts.persons} · ownerships {destinationPlan.entityCounts.ownerships} · contacts {destinationPlan.entityCounts.contactPoints} · ledger {destinationPlan.entityCounts.ownerLedgerEntries} · invoices {destinationPlan.entityCounts.vendorInvoices} · exceptions {destinationPlan.entityCounts.exceptions}
                      {destinationPlan.routeReason ? ` · ${destinationPlan.routeReason}` : ""}
                    </div>
                  );
                })()}
                {(() => {
                  const feedbackSignals = getFeedbackSignals(selectedRecord.payloadJson);
                  if (!feedbackSignals) return null;
                  return (
                    <div className="text-xs text-muted-foreground">
                      Prior correction signals: {feedbackSignals.priorUnitRemaps} unit remaps · {feedbackSignals.priorOwnerNameFixes} owner-name fixes · {feedbackSignals.priorBankTransactionMappings} bank mappings
                    </div>
                  );
                })()}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={reviewRecord.isPending || Boolean(selectedPayloadParse.error)}
                  onClick={() => runSelectedRecordReview("approved", "preview")}
                >
                  Preview
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={reviewRecord.isPending || Boolean(selectedPayloadParse.error)}
                  onClick={() => runSelectedRecordReview("approved", "commit")}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={reviewRecord.isPending}
                  onClick={() => runSelectedRecordReview("rejected")}
                >
                  Reject
                </Button>
              </div>
            </div>
              );
            })()}
            <div className="text-xs text-muted-foreground">
              Edit payload JSON before preview/approve. Invalid JSON blocks import actions.
            </div>
            <Textarea
              rows={14}
              value={selectedPayloadText}
              onChange={(e) => setRecordPayloadEditors((previous) => ({ ...previous, [selectedRecord.id]: e.target.value }))}
            />
            {selectedPayloadParse.error ? (
              <div className="text-xs text-red-600">JSON error: {selectedPayloadParse.error}</div>
            ) : null}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedRecordId(selectedRecord.id)}>Import Runs</Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRecordPayloadEditors((previous) => ({
                  ...previous,
                  [selectedRecord.id]: toPrettyJson(recordPayloadOverrides[selectedRecord.id] ?? selectedRecord.payloadJson),
                }))}
              >
                Reset Editor
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {selectedRecord?.recordType === "owner-roster" ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="text-sm font-medium">Owner Roster Normalization Workspace</div>
            <div className="text-xs text-muted-foreground">
              Review the normalized building and unit facts that drive owner import. Changes here also update the derived owner roster items in the payload editor.
            </div>
            {(() => {
              const payload = recordPayloadOverrides[selectedRecord.id] ?? selectedPayloadParse.value ?? selectedRecord.payloadJson;
              const entries = getNormalizedOwnerEntries(payload);
              const unresolved = getOwnerRosterUnresolvedExceptions(payload, associationUnits ?? []);
              const corrections = getOperatorCorrections(payload);
              if (entries.length === 0) {
                return <div className="text-xs text-muted-foreground">No normalized owner entries are available for this record.</div>;
              }
              return (
                <div className="space-y-4">
                  <div className="text-xs text-muted-foreground">
                    Operator corrections captured: {corrections.length}
                  </div>
                  {unresolved.length > 0 ? (
                    <div className="border rounded-md p-3 space-y-2">
                      <div className="text-xs font-medium">Unresolved Exceptions</div>
                      {unresolved.map((item, index) => (
                        <div key={`${item.kind}:${item.unitNumber}:${index}`} className="text-xs text-muted-foreground">
                          {item.blocking ? "blocking" : "warning"} · {item.message}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {entries.map((entry, index) => (
                    <div key={`${entry.unitNumber}:${index}`} className="border rounded-md p-3 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <div className="text-xs font-medium">Unit</div>
                          <div className="flex gap-2">
                            <Input
                              value={entry.unitNumber}
                              onChange={(e) => applyOwnerRosterNormalizedPatch(selectedRecord.id, index, { unitNumber: e.target.value.toUpperCase() })}
                            />
                            <Select
                              value={entry.unitNumber}
                              onValueChange={(value) => applyOwnerRosterNormalizedPatch(selectedRecord.id, index, { unitNumber: value })}
                            >
                              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Map unit" /></SelectTrigger>
                              <SelectContent>
                                {(associationUnits ?? []).map((unit) => (
                                  <SelectItem key={unit.id} value={unit.unitNumber}>{unit.unitNumber}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-medium">Building Address</div>
                          <Input
                            value={entry.buildingAddress ?? ""}
                            onChange={(e) => applyOwnerRosterNormalizedPatch(selectedRecord.id, index, { buildingAddress: e.target.value || null })}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs font-medium">Owner Text</div>
                        <div className="text-xs text-muted-foreground">{entry.ownerText}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-medium">Owner Candidates</div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => addOwnerRosterCandidate(selectedRecord.id, index)}
                          >
                            Add Owner
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {entry.ownerCandidates.map((candidate, candidateIndex) => (
                            <div key={`${candidate.displayName}:${candidateIndex}`} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
                              <div className="space-y-1">
                                <div className="text-[11px] text-muted-foreground">Display Name</div>
                                <Input
                                  value={candidate.displayName}
                                  onChange={(e) => applyOwnerRosterCandidatePatch(selectedRecord.id, index, candidateIndex, { displayName: e.target.value })}
                                  placeholder="Full owner label"
                                />
                              </div>
                              <div className="space-y-1">
                                <div className="text-[11px] text-muted-foreground">First Name</div>
                                <Input
                                  value={candidate.firstName}
                                  onChange={(e) => applyOwnerRosterCandidatePatch(selectedRecord.id, index, candidateIndex, { firstName: e.target.value })}
                                  placeholder="First name"
                                />
                              </div>
                              <div className="space-y-1">
                                <div className="text-[11px] text-muted-foreground">Last Name</div>
                                <Input
                                  value={candidate.lastName}
                                  onChange={(e) => applyOwnerRosterCandidatePatch(selectedRecord.id, index, candidateIndex, { lastName: e.target.value })}
                                  placeholder="Last name"
                                />
                              </div>
                              <div className="space-y-1">
                                <div className="text-[11px] text-muted-foreground">Email</div>
                                <Input
                                  value={candidate.email ?? ""}
                                  onChange={(e) => applyOwnerRosterCandidatePatch(selectedRecord.id, index, candidateIndex, { email: e.target.value || null })}
                                  placeholder="owner@example.com"
                                />
                              </div>
                              <div className="space-y-1">
                                <div className="text-[11px] text-muted-foreground">Phone</div>
                                <Input
                                  value={candidate.phone ?? ""}
                                  onChange={(e) => applyOwnerRosterCandidatePatch(selectedRecord.id, index, candidateIndex, { phone: e.target.value || null })}
                                  placeholder="(555) 123-4567"
                                />
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={entry.ownerCandidates.length <= 1}
                                onClick={() => removeOwnerRosterCandidate(selectedRecord.id, index, candidateIndex)}
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <div className="text-xs font-medium">Emails</div>
                          <Textarea
                            rows={2}
                            value={entry.emails.join(", ")}
                            onChange={(e) => applyOwnerRosterNormalizedPatch(selectedRecord.id, index, {
                              emails: e.target.value.split(",").map((value) => value.trim()).filter(Boolean),
                            })}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-medium">Phones</div>
                          <Textarea
                            rows={2}
                            value={entry.phones.join(", ")}
                            onChange={(e) => applyOwnerRosterNormalizedPatch(selectedRecord.id, index, {
                              phones: e.target.value.split(",").map((value) => value.trim()).filter(Boolean),
                            })}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-medium">Notes</div>
                          <Textarea
                            rows={2}
                            value={entry.notes.join(", ")}
                            onChange={(e) => applyOwnerRosterNormalizedPatch(selectedRecord.id, index, {
                              notes: e.target.value.split(",").map((value) => value.trim()).filter(Boolean),
                            })}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      ) : null}

      {selectedRecord?.recordType === "bank-statement" ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="text-sm font-medium">Bank Statement Resolution Queue</div>
            <div className="text-xs text-muted-foreground">
              Resolve unit/person for skipped transactions, then run Preview again.
            </div>
            <div className="text-xs text-muted-foreground">
              Operator corrections captured: {getOperatorCorrections(recordPayloadOverrides[selectedRecord.id] ?? selectedPayloadParse.value ?? selectedRecord.payloadJson).length}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Txn</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Unit Mapping</TableHead>
                  <TableHead>Person Mapping</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(bankResolutionHints ?? []).map((hint) => (
                  <TableRow key={`${hint.txIndex}:${hint.reason}`}>
                    <TableCell>#{hint.txIndex + 1}</TableCell>
                    <TableCell>{hint.reason}</TableCell>
                    <TableCell>
                      <Select
                        value={hint.transaction.unitNumber ?? "__unmapped_unit__"}
                        onValueChange={(value) => applyBankResolutionMapping(selectedRecord.id, hint.txIndex, { unitNumber: value === "__unmapped_unit__" ? null : value })}
                      >
                        <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__unmapped_unit__">Unmapped</SelectItem>
                          {hint.unitCandidates.map((unit) => (
                            <SelectItem key={unit.unitId} value={unit.unitNumber}>{unit.unitNumber}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={(hint.personCandidates.find((row) => row.email === hint.transaction.ownerEmail)?.personId) ?? "__unmapped_person__"}
                        onValueChange={(value) => {
                          if (value === "__unmapped_person__") {
                            applyBankResolutionMapping(selectedRecord.id, hint.txIndex, {
                              ownerEmail: null,
                            });
                            return;
                          }
                          const person = hint.personCandidates.find((row) => row.personId === value);
                          applyBankResolutionMapping(selectedRecord.id, hint.txIndex, {
                            ownerEmail: person?.email ?? hint.transaction.ownerEmail,
                            ownerName: person?.name ?? hint.transaction.ownerName,
                          });
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__unmapped_person__">Unmapped</SelectItem>
                          {hint.personCandidates.map((person) => (
                            <SelectItem key={person.personId} value={person.personId}>
                              {person.name}{person.email ? ` (${person.email})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Import Run</TableHead><TableHead>Mode</TableHead><TableHead>Status</TableHead><TableHead>Source Trace</TableHead><TableHead>Created</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {(importRuns ?? []).map((run) => (
                <TableRow key={run.id}>
                  <TableCell>{run.id.slice(0, 8)}</TableCell>
                  <TableCell>{run.mode}</TableCell>
                  <TableCell>{run.runStatus}</TableCell>
                  <TableCell className="text-xs">
                    <div>job {run.ingestionJobId.slice(0, 8)}</div>
                    <div>record {run.extractedRecordId.slice(0, 8)}</div>
                  </TableCell>
                  <TableCell>{new Date(run.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => previewRollbackImportRun.mutate(run.id)}
                      disabled={previewRollbackImportRun.isPending || run.mode !== "commit" || Boolean(run.rolledBackAt)}
                    >
                      Preview Rollback
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rollbackImportRun.mutate(run.id)}
                      disabled={rollbackImportRun.isPending || run.mode !== "commit" || Boolean(run.rolledBackAt)}
                    >
                      Rollback
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => reprocessImportRun.mutate({ runId: run.id })}
                      disabled={reprocessImportRun.isPending || (run.mode === "commit" && !Boolean(run.rolledBackAt))}
                    >
                      Reprocess
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => reprocessImportRun.mutate({ runId: run.id, rollbackFirst: true })}
                      disabled={reprocessImportRun.isPending || run.mode !== "commit" || Boolean(run.rolledBackAt)}
                    >
                      Rollback + Reprocess
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {lastImportSummary ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="text-sm font-medium">Latest Import Summary</div>
            <div className="text-xs text-muted-foreground">
              {lastImportSummary.dryRun ? "Preview" : "Commit"} · module {lastImportSummary.targetModule} · {lastImportSummary.message}
            </div>
            <div className="text-xs text-muted-foreground">
              Source: {lastImportSummary.sourceRecordType || "-"} / record {lastImportSummary.sourceRecordId ? lastImportSummary.sourceRecordId.slice(0, 8) : "-"} / job {lastImportSummary.sourceJobId ? lastImportSummary.sourceJobId.slice(0, 8) : "-"}
            </div>
            {lastImportSummary.destinationPlan ? (
              <div className="border rounded-md p-3 space-y-1">
                <div className="text-xs font-medium">Route Execution</div>
                <div className="text-xs text-muted-foreground">
                  Planned: {lastImportSummary.destinationPlan.primaryModule} · Executed: {lastImportSummary.targetModule} · {lastImportSummary.routeMatched ? "matched route plan" : "did not match route plan"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Planned entities: units {lastImportSummary.destinationPlan.entityCounts.units} · persons {lastImportSummary.destinationPlan.entityCounts.persons} · ownerships {lastImportSummary.destinationPlan.entityCounts.ownerships} · contacts {lastImportSummary.destinationPlan.entityCounts.contactPoints} · ledger {lastImportSummary.destinationPlan.entityCounts.ownerLedgerEntries} · invoices {lastImportSummary.destinationPlan.entityCounts.vendorInvoices} · exceptions {lastImportSummary.destinationPlan.entityCounts.exceptions}
                </div>
                {lastImportSummary.destinationPlan.routeReason ? (
                  <div className="text-xs text-muted-foreground">{lastImportSummary.destinationPlan.routeReason}</div>
                ) : null}
              </div>
            ) : null}
            {((lastImportSummary.unresolvedExceptionCount ?? 0) > 0 || (lastImportSummary.blockingExceptionCount ?? 0) > 0) ? (
              <div className="border rounded-md p-3 space-y-2">
                <div className="text-xs font-medium">Unresolved Exceptions Summary</div>
                <div className="text-xs text-muted-foreground">
                  Total: {lastImportSummary.unresolvedExceptionCount ?? 0} · Blocking: {lastImportSummary.blockingExceptionCount ?? 0}
                </div>
                {(lastImportSummary.unresolvedExceptions ?? []).map((item, index) => (
                  <div key={`${item.kind}:${item.unitNumber}:${index}`} className="text-xs text-muted-foreground">
                    {item.blocking ? "blocking" : "warning"} · {item.unitNumber} · {item.message}
                  </div>
                ))}
              </div>
            ) : null}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Module</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Before</TableHead>
                  <TableHead>After</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lastImportSummary.details.map((detail, idx) => (
                  <TableRow key={`${detail.module}:${detail.entityKey}:${idx}`}>
                    <TableCell>{detail.module}</TableCell>
                    <TableCell>{detail.action}</TableCell>
                    <TableCell>{detail.entityKey}</TableCell>
                    <TableCell>
                      <div>{detail.reason}</div>
                      {detail.suggestions?.length ? <div className="text-xs text-muted-foreground">Suggestions: {detail.suggestions.join(" | ")}</div> : null}
                    </TableCell>
                    <TableCell className="max-w-[220px]"><pre className="text-xs whitespace-pre-wrap">{detail.beforeJson ? JSON.stringify(detail.beforeJson, null, 2) : "-"}</pre></TableCell>
                    <TableCell className="max-w-[220px]"><pre className="text-xs whitespace-pre-wrap">{detail.afterJson ? JSON.stringify(detail.afterJson, null, 2) : "-"}</pre></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Bylaw Review Queue</h2>
              <p className="text-sm text-muted-foreground">Before/after compare with human approval, tagging, and link suggestions.</p>
            </div>
            <div className="flex gap-2">
              <Select value={clauseReviewFilter} onValueChange={(value) => setClauseReviewFilter(value as "all" | "pending-review" | "approved" | "rejected")}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">all statuses</SelectItem>
                  <SelectItem value="pending-review">pending review</SelectItem>
                  <SelectItem value="approved">approved</SelectItem>
                  <SelectItem value="rejected">rejected</SelectItem>
                </SelectContent>
              </Select>
              <Input value={clauseSearch} onChange={(e) => setClauseSearch(e.target.value)} placeholder="Search title or clause text" className="w-full sm:w-[260px]" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clause</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(clauses ?? []).map((clause) => (
                    <TableRow key={clause.id} className="cursor-pointer" onClick={() => setSelectedClauseId(clause.id)}>
                      <TableCell>
                    <div className="font-medium">{clause.title}</div>
                    <div className="text-xs text-muted-foreground">job {clause.ingestionJobId.slice(0, 8)}</div>
                    {clause.supersededAt ? (
                      <div className="text-xs text-amber-700">Superseded {new Date(clause.supersededAt).toLocaleString()}</div>
                    ) : null}
                      </TableCell>
                      <TableCell>{clause.confidenceScore != null ? `${Math.round(clause.confidenceScore * 100)}%` : "-"}</TableCell>
                      <TableCell>
                        <Badge variant={clause.reviewStatus === "approved" ? "default" : clause.reviewStatus === "rejected" ? "destructive" : "outline"}>
                          {clause.reviewStatus}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-4">
              {!selectedClause ? (
                <div className="text-sm text-muted-foreground border rounded-md p-4">Select a clause to review.</div>
              ) : (
                <>
                  <div className="border rounded-md p-4 space-y-3">
                    <div className="text-sm font-medium">Source Traceability</div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>Ingestion job: {selectedClause.ingestionJobId}</div>
                      <div>Extracted record: {selectedClause.extractedRecordId || "-"}</div>
                      <div>Source document: {selectedClause.sourceDocumentId ? (sourceDocumentById.get(selectedClause.sourceDocumentId)?.title || selectedClause.sourceDocumentId) : "-"}</div>
                      <div>Captured: {new Date(selectedClause.createdAt).toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Before (Extracted)</div>
                      <div className="border rounded-md p-3 text-sm bg-muted/30">
                        <div className="font-medium">{selectedClause.title}</div>
                        <div className="mt-2 whitespace-pre-wrap text-xs">{selectedClause.clauseText}</div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium">After (Editable)</div>
                      <Input value={editedClauseTitle} onChange={(e) => setEditedClauseTitle(e.target.value)} />
                      <Textarea rows={8} value={editedClauseText} onChange={(e) => setEditedClauseText(e.target.value)} />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => reviewClause.mutate({ id: selectedClause.id, reviewStatus: "approved", title: editedClauseTitle.trim(), clauseText: editedClauseText.trim() })}
                    >
                      Approve Clause
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => reviewClause.mutate({ id: selectedClause.id, reviewStatus: "rejected", title: editedClauseTitle.trim(), clauseText: editedClauseText.trim() })}
                    >
                      Reject Clause
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Tags</div>
                    <div className="flex flex-wrap gap-2">
                      {(clauseTags ?? []).map((tag) => (
                        <Badge key={tag.id} variant="secondary">{tag.tag}</Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Add tag (e.g., quorum, elections)" />
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (!selectedClauseId || !newTag.trim()) return;
                          createClauseTag.mutate({ clauseId: selectedClauseId, tag: newTag.trim() });
                        }}
                      >
                        Add Tag
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Suggested Entity Links</div>
                    <div className="space-y-2">
                      {(suggestedLinks ?? []).map((link) => (
                        <div key={link.id} className="border rounded-md p-3 flex items-center justify-between gap-2">
                          <div className="text-xs">
                            <div className="font-medium">{link.entityType} / {link.entityId}</div>
                            <div className="text-muted-foreground">confidence {link.confidenceScore != null ? `${Math.round(link.confidenceScore * 100)}%` : "-"}</div>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant={link.isApproved ? "default" : "outline"}>{link.isApproved ? "approved" : "pending"}</Badge>
                            <Button size="sm" variant="outline" onClick={() => updateSuggestedLink.mutate({ id: link.id, isApproved: true })}>Approve</Button>
                            <Button size="sm" variant="outline" onClick={() => updateSuggestedLink.mutate({ id: link.id, isApproved: false })}>Unapprove</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <Input value={newLinkEntityType} onChange={(e) => setNewLinkEntityType(e.target.value)} placeholder="entity type" />
                      <Input value={newLinkEntityId} onChange={(e) => setNewLinkEntityId(e.target.value)} placeholder="entity id" />
                      <Input value={newLinkConfidence} onChange={(e) => setNewLinkConfidence(e.target.value)} placeholder="confidence 0-1" />
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (!selectedClauseId || !newLinkEntityType.trim() || !newLinkEntityId.trim()) return;
                          const parsed = Number(newLinkConfidence);
                          createSuggestedLink.mutate({
                            clauseId: selectedClauseId,
                            entityType: newLinkEntityType.trim(),
                            entityId: newLinkEntityId.trim(),
                            confidenceScore: Number.isFinite(parsed) ? parsed : null,
                          });
                        }}
                      >
                        Suggest Link
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clause</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Traceability</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(approvedGovernanceLinks ?? []).map((row) => (
                <TableRow key={`${row.clauseRecordId}:${row.entityType}:${row.entityId}`}>
                  <TableCell className="max-w-[320px]">
                    <div className="font-medium">{row.clauseTitle}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{row.clauseText}</div>
                  </TableCell>
                  <TableCell>{row.entityType} / {row.entityId}</TableCell>
                  <TableCell>{row.confidenceScore != null ? `${Math.round(row.confidenceScore * 100)}%` : "-"}</TableCell>
                  <TableCell className="text-xs">{row.clauseRecordId}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
