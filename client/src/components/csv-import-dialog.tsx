import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Upload, X } from "lucide-react";

export type CsvColumnDef = {
  key: string;
  label: string;
  required?: boolean;
};

export type ImportResult = {
  createdCount: number;
  skippedCount: number;
  results: Array<{
    index: number;
    name: string;
    status: "created" | "skipped";
    error?: string;
  }>;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  columns: CsvColumnDef[];
  sampleRows: string[][];
  onImport: (rows: Record<string, string>[]) => Promise<ImportResult>;
};

function parseCsv(text: string): string[][] {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) =>
      line
        .split(",")
        .map((cell) => cell.trim().replace(/^"(.*)"$/, "$1"))
    );
}

export function CsvImportDialog({
  open,
  onOpenChange,
  title,
  description,
  columns,
  sampleRows,
  onImport,
}: Props) {
  const [csvText, setCsvText] = useState("");
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const headerRow = columns.map((c) => c.key).join(",");
  const sampleCsv = [headerRow, ...sampleRows.map((r) => r.join(","))].join("\n");

  function handleParse(text: string) {
    setCsvText(text);
    setParseError(null);
    setImportResult(null);
    if (!text.trim()) {
      setParsedRows([]);
      return;
    }
    const lines = parseCsv(text);
    if (lines.length < 2) {
      setParseError("CSV must have a header row and at least one data row.");
      setParsedRows([]);
      return;
    }
    const headers = lines[0];
    const missing = columns
      .filter((c) => c.required && !headers.includes(c.key))
      .map((c) => c.key);
    if (missing.length > 0) {
      setParseError(`Missing required columns: ${missing.join(", ")}`);
      setParsedRows([]);
      return;
    }
    const rows = lines
      .slice(1)
      .filter((row) => row.some((cell) => cell.trim()))
      .map((row) => {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => {
          obj[h] = row[i] ?? "";
        });
        return obj;
      });
    if (rows.length === 0) {
      setParseError("No data rows found.");
      setParsedRows([]);
      return;
    }
    setParsedRows(rows);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => handleParse(evt.target?.result as string);
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleImport() {
    if (!parsedRows.length) return;
    setImporting(true);
    try {
      const result = await onImport(parsedRows);
      setImportResult(result);
      setParsedRows([]);
      setCsvText("");
    } finally {
      setImporting(false);
    }
  }

  function handleClose() {
    setCsvText("");
    setParsedRows([]);
    setParseError(null);
    setImportResult(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {!importResult ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{description}</p>

            <div className="rounded-md bg-muted/40 p-3 text-xs font-mono whitespace-pre overflow-x-auto">
              <div className="text-muted-foreground mb-1 font-sans">
                Expected format:
              </div>
              {sampleCsv}
            </div>

            <div className="flex gap-2 items-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-1" />
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

            <Textarea
              placeholder="Paste CSV content here..."
              value={csvText}
              onChange={(e) => handleParse(e.target.value)}
              className="font-mono text-xs min-h-[120px]"
            />

            {parseError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}

            {parsedRows.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm font-medium">
                  Preview — {parsedRows.length} row
                  {parsedRows.length !== 1 ? "s" : ""} ready to import
                </div>
                <div className="rounded-md border overflow-auto max-h-52">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {columns.map((c) => (
                          <TableHead key={c.key} className="text-xs">
                            {c.label}
                            {c.required && (
                              <span className="text-destructive ml-0.5">*</span>
                            )}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedRows.slice(0, 10).map((row, i) => (
                        <TableRow key={i}>
                          {columns.map((c) => (
                            <TableCell key={c.key} className="text-xs">
                              {row[c.key] || (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                      {parsedRows.length > 10 && (
                        <TableRow>
                          <TableCell
                            colSpan={columns.length}
                            className="text-xs text-muted-foreground text-center py-2"
                          >
                            +{parsedRows.length - 10} more rows not shown
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                <Button onClick={handleImport} disabled={importing}>
                  {importing
                    ? "Importing..."
                    : `Import ${parsedRows.length} Row${parsedRows.length !== 1 ? "s" : ""}`}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-6">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>
                  <strong>{importResult.createdCount}</strong> created
                </span>
              </div>
              {importResult.skippedCount > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <X className="h-4 w-4 text-destructive" />
                  <span>
                    <strong>{importResult.skippedCount}</strong> skipped
                  </span>
                </div>
              )}
            </div>

            {importResult.results.filter((r) => r.status === "skipped").length >
              0 && (
              <div className="space-y-1">
                <div className="text-sm font-medium text-destructive">
                  Skipped rows
                </div>
                <div className="rounded-md border overflow-auto max-h-52">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-16">Row</TableHead>
                        <TableHead className="text-xs">Name / ID</TableHead>
                        <TableHead className="text-xs">Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult.results
                        .filter((r) => r.status === "skipped")
                        .map((r) => (
                          <TableRow key={r.index}>
                            <TableCell className="text-xs">{r.index + 2}</TableCell>
                            <TableCell className="text-xs">{r.name}</TableCell>
                            <TableCell className="text-xs text-destructive">
                              {r.error}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <Button onClick={handleClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
