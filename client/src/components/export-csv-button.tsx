import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExportCsvButtonProps {
  /** Column headers for the CSV */
  headers: string[];
  /** Row data — each inner array corresponds to one row */
  rows: (string | number | null | undefined)[][];
  /** Output filename (without .csv extension) */
  filename: string;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "default" | "lg" | "icon";
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  // Wrap in quotes if it contains commas, quotes, or newlines
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function ExportCsvButton({ headers, rows, filename, disabled, className, size = "sm" }: ExportCsvButtonProps) {
  function handleExport() {
    const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(","));
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <Button
      variant="outline"
      size={size}
      disabled={disabled || rows.length === 0}
      onClick={handleExport}
      className={className}
    >
      <Download className="h-4 w-4 mr-1.5" />
      Export CSV
    </Button>
  );
}
