// founder-os#1616 (Child B) — Step 3 of the day-0-14 onboarding wizard.
//
// Plain English: the treasurer needs to tell YCM who the owners are before
// any payments / messages / autopay can target them. The fastest path is a
// CSV upload — most associations already have one (export from Excel, the
// prior management company, etc.). We accept name + email + unit_number as
// required and phone + opening_balance + ownership_pct as optional. Each
// row creates a unit (if it doesn't exist yet), a person, and an ownership
// link tying them together. Optional opening balance becomes an owner-
// ledger "charge" entry so the new owner shows up on the delinquency list
// from day one.
//
// Backend: POST /api/onboarding/owners/import (added in this dispatch). It
// uses the same idempotency pattern as /api/units/import + /api/persons/
// import — per-row try/catch with a `{ index, name, status, error? }`
// result array surfaced inline.
import { useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowRight,
  Download,
  Upload,
  Users,
  CheckCircle2,
  AlertCircle,
  X,
  FileSpreadsheet,
} from "lucide-react";
import type { OnboardingWizardSnapshot } from "./types";

// Columns the importer accepts. Required ones have a `*` star in the UI.
const COLUMNS = [
  { key: "name", label: "Owner name", required: true },
  { key: "email", label: "Email", required: true },
  { key: "unit_number", label: "Unit #", required: true },
  { key: "phone", label: "Phone", required: false },
  { key: "opening_balance", label: "Opening balance", required: false },
  { key: "ownership_pct", label: "Ownership %", required: false },
] as const;

const SAMPLE_ROWS: string[][] = [
  ["Jane Smith", "jane@example.com", "101", "555-0101", "0", "100"],
  ["Bob Jones", "bob@example.com", "102", "", "150.00", "100"],
  ["Maria Garcia", "maria@example.com", "201", "555-0202", "", ""],
];

type ParsedRow = Record<string, string>;
type ImportResultRow = {
  index: number;
  name: string;
  status: "created" | "skipped";
  error?: string;
};
type ImportResponse = {
  results: ImportResultRow[];
  createdCount: number;
  skippedCount: number;
};

/**
 * Minimal CSV parser. Handles double-quoted cells (with embedded commas)
 * and CRLF line endings. We avoid pulling in a full CSV library because
 * the onboarding wizard is the only place this format is consumed and
 * the worst-case row count is the size of one HOA (~hundreds, not
 * millions).
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        current.push(cell.trim());
        cell = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        current.push(cell.trim());
        if (current.some((x) => x !== "")) rows.push(current);
        current = [];
        cell = "";
      } else cell += c;
    }
  }
  if (cell !== "" || current.length > 0) {
    current.push(cell.trim());
    if (current.some((x) => x !== "")) rows.push(current);
  }
  return rows;
}

function downloadCsvSample() {
  const headerRow = COLUMNS.map((c) => c.key).join(",");
  const body = SAMPLE_ROWS.map((r) => r.join(",")).join("\n");
  const blob = new Blob([`${headerRow}\n${body}\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ycm-owner-roster-sample.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function validateRow(row: ParsedRow): string | null {
  if (!row.name || !row.name.trim()) return "Missing owner name";
  if (!row.email || !row.email.trim()) return "Missing email";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) return "Email looks invalid";
  if (!row.unit_number || !row.unit_number.trim()) return "Missing unit #";
  if (row.opening_balance && row.opening_balance.trim() !== "" && Number.isNaN(Number(row.opening_balance))) {
    return "Opening balance must be a number";
  }
  if (row.ownership_pct && row.ownership_pct.trim() !== "" && Number.isNaN(Number(row.ownership_pct))) {
    return "Ownership % must be a number";
  }
  return null;
}

export function Step3UploadRoster({
  snapshot,
  onComplete,
  onSkip,
  isSaving,
}: {
  snapshot: OnboardingWizardSnapshot;
  onComplete: () => void;
  onSkip: () => void;
  isSaving: boolean;
}) {
  const { toast } = useToast();
  const [csvText, setCsvText] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validRowCount = useMemo(
    () => parsedRows.filter((_, i) => !rowErrors[i]).length,
    [parsedRows, rowErrors],
  );

  function handleParse(text: string) {
    setCsvText(text);
    setParseError(null);
    setImportResult(null);
    if (!text.trim()) {
      setParsedRows([]);
      setRowErrors({});
      return;
    }
    const lines = parseCsv(text);
    if (lines.length < 2) {
      setParseError("CSV must have a header row and at least one data row.");
      setParsedRows([]);
      setRowErrors({});
      return;
    }
    const headers = lines[0].map((h) => h.toLowerCase());
    const missing = COLUMNS.filter((c) => c.required && !headers.includes(c.key)).map((c) => c.key);
    if (missing.length > 0) {
      setParseError(`Missing required columns: ${missing.join(", ")}`);
      setParsedRows([]);
      setRowErrors({});
      return;
    }
    const rows: ParsedRow[] = lines.slice(1).map((row) => {
      const obj: ParsedRow = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] ?? "";
      });
      return obj;
    });
    const errors: Record<number, string> = {};
    rows.forEach((row, i) => {
      const err = validateRow(row);
      if (err) errors[i] = err;
    });
    setParsedRows(rows);
    setRowErrors(errors);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => handleParse(String(evt.target?.result ?? ""));
    reader.readAsText(file);
    e.target.value = "";
  }

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!snapshot.associationId) {
        throw new Error("Finish Step 1 (community details) first so we know which association these owners belong to.");
      }
      const validRows = parsedRows.filter((_, i) => !rowErrors[i]);
      const res = await apiRequest("POST", "/api/onboarding/owners/import", {
        associationId: snapshot.associationId,
        rows: validRows.map((r) => ({
          name: r.name,
          email: r.email,
          unit_number: r.unit_number,
          phone: r.phone || null,
          opening_balance: r.opening_balance ? Number(r.opening_balance) : null,
          ownership_pct: r.ownership_pct ? Number(r.ownership_pct) : null,
        })),
      });
      return (await res.json()) as ImportResponse;
    },
    onSuccess: (result) => {
      setImportResult(result);
      toast({
        title: `${result.createdCount} owner${result.createdCount === 1 ? "" : "s"} imported`,
        description:
          result.skippedCount > 0
            ? `${result.skippedCount} row${result.skippedCount === 1 ? "" : "s"} were skipped. Review and fix them below.`
            : undefined,
      });
    },
    onError: (err: Error) =>
      toast({ title: "Import failed", description: err.message, variant: "destructive" }),
  });

  // ── Result screen ────────────────────────────────────────────────────────
  if (importResult) {
    const skipped = importResult.results.filter((r) => r.status === "skipped");
    return (
      <div className="space-y-6" data-testid="wizard-step-3-result">
        <div className="flex flex-wrap gap-6 rounded-md border bg-muted/30 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden="true" />
            <span className="text-sm">
              <strong>{importResult.createdCount}</strong> owner{importResult.createdCount === 1 ? "" : "s"} created
            </span>
          </div>
          {importResult.skippedCount > 0 && (
            <div className="flex items-center gap-2">
              <X className="h-5 w-5 text-destructive" aria-hidden="true" />
              <span className="text-sm">
                <strong>{importResult.skippedCount}</strong> skipped
              </span>
            </div>
          )}
        </div>

        {skipped.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-destructive">Skipped rows</p>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-xs">Row</TableHead>
                    <TableHead className="text-xs">Owner</TableHead>
                    <TableHead className="text-xs">Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {skipped.map((r) => (
                    <TableRow key={r.index}>
                      <TableCell className="text-xs">{r.index + 2}</TableCell>
                      <TableCell className="text-xs">{r.name}</TableCell>
                      <TableCell className="text-xs text-destructive">{r.error}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              Skipped rows aren't in the database. You can re-upload a corrected CSV with just those rows, or add owners manually from People → Owners.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setImportResult(null);
              setCsvText("");
              setParsedRows([]);
              setRowErrors({});
            }}
            data-testid="wizard-step-3-import-more"
          >
            Import another batch
          </Button>
          <Button
            type="button"
            onClick={onComplete}
            disabled={isSaving || importResult.createdCount === 0}
            data-testid="wizard-step-3-continue"
          >
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // ── Upload / preview screen ──────────────────────────────────────────────
  return (
    <div className="space-y-6" data-testid="wizard-step-3-upload">
      <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-4">
        <Users className="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium">Bring in your owners</p>
          <p className="text-sm text-muted-foreground">
            Upload a CSV with one row per owner. We'll create a unit, person, and ownership record for each row. Required columns are <span className="font-mono text-xs">name</span>, <span className="font-mono text-xs">email</span>, and <span className="font-mono text-xs">unit_number</span>.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={downloadCsvSample}
          data-testid="wizard-step-3-download-sample"
        >
          <Download className="mr-2 h-4 w-4" />
          Download sample CSV
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          data-testid="wizard-step-3-upload-button"
        >
          <Upload className="mr-2 h-4 w-4" />
          Upload CSV file
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFileChange}
        />
        <span className="text-xs text-muted-foreground">or paste below</span>
      </div>

      <div className="rounded-md border bg-muted/40 p-3 font-mono text-xs">
        <div className="mb-2 font-sans text-muted-foreground">Expected format:</div>
        <pre className="overflow-x-auto whitespace-pre">
{COLUMNS.map((c) => c.key).join(",")}
{"\n"}
{SAMPLE_ROWS.map((r) => r.join(",")).join("\n")}
        </pre>
      </div>

      <Textarea
        placeholder="Paste CSV content here…"
        value={csvText}
        onChange={(e) => handleParse(e.target.value)}
        className="min-h-[120px] font-mono text-xs"
        data-testid="wizard-step-3-textarea"
      />

      {parseError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Couldn't parse CSV</AlertTitle>
          <AlertDescription>{parseError}</AlertDescription>
        </Alert>
      )}

      {parsedRows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span>
              <strong>{parsedRows.length}</strong> row{parsedRows.length === 1 ? "" : "s"} parsed
              {Object.keys(rowErrors).length > 0 && (
                <span className="ml-2 text-destructive">
                  ({Object.keys(rowErrors).length} with errors)
                </span>
              )}
            </span>
          </div>
          <div className="max-h-64 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 text-xs">#</TableHead>
                  {COLUMNS.map((c) => (
                    <TableHead key={c.key} className="text-xs">
                      {c.label}
                      {c.required && <span className="ml-0.5 text-destructive">*</span>}
                    </TableHead>
                  ))}
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedRows.slice(0, 50).map((row, i) => (
                  <TableRow key={i} className={rowErrors[i] ? "bg-destructive/5" : undefined}>
                    <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                    {COLUMNS.map((c) => (
                      <TableCell key={c.key} className="text-xs">
                        {row[c.key] || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    ))}
                    <TableCell className="text-xs">
                      {rowErrors[i] ? (
                        <span className="text-destructive">{rowErrors[i]}</span>
                      ) : (
                        <span className="text-muted-foreground">Ready</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {parsedRows.length > 50 && (
                  <TableRow>
                    <TableCell colSpan={COLUMNS.length + 2} className="py-2 text-center text-xs text-muted-foreground">
                      +{parsedRows.length - 50} more rows not shown in preview (all will be imported)
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={onSkip}
          disabled={isSaving || importMutation.isPending}
          data-testid="wizard-step-3-skip"
        >
          Skip for now
        </Button>
        <Button
          type="button"
          onClick={() => importMutation.mutate()}
          disabled={!snapshot.associationId || validRowCount === 0 || importMutation.isPending}
          data-testid="wizard-step-3-import"
        >
          {importMutation.isPending
            ? "Importing…"
            : validRowCount === 0
              ? "Add at least one valid row"
              : `Import ${validRowCount} owner${validRowCount === 1 ? "" : "s"}`}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
