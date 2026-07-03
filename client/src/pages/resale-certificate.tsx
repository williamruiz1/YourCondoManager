// zone: Financials / Governance
// persona: Manager, Board Officer, Assisted Board, PM Assistant
//
// CT resale / "6(d)" certificate generator — CGS §47-270 (founder-os#8013).
// Pick the selling owner + unit, supply the board-declared inputs (periodic
// assessment, §47-270(a)(5) reserves + basis, judgments/suits, etc.), then
// generate the statutory disclosure document. A purchaser cannot close without
// it; §47-270(b)(1) requires it within 10 business days for a $185 fee.
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Person, Unit } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

// Structured §47-270 document returned by the server (mirrors
// ResaleCertificateDocument in server/services/resale-certificate-service.ts).
interface ResaleCertificateDocument {
  statuteCitation: string;
  state: string;
  generatedAt: string;
  association: { name: string; isIncorporated: boolean; isCooperative: boolean };
  unit: { unitNumber: string; building: string | null };
  sellingOwnerName: string;
  purchaserName: string | null;
  disclosures: {
    a1_rightOfFirstRefusal: { applies: boolean; statement: string };
    a2_amountsDue: {
      periodicCommonExpenseAssessment: number;
      unpaidCommonExpense: number;
      unpaidSpecialAssessment: number;
      otherFees: { description: string; amount: number }[];
      totalCurrentlyDue: number;
    };
    a3_otherFees: { description: string; amount: number }[];
    a4_approvedCapitalExpenditures: { description: string; amount: number; fiscalYear: number }[];
    a5_reservesForCapitalExpenditures: { amountUsd: number; basis: string | null };
    a6_currentOperatingBudget:
      | { fiscalYear: number; totalPlanned: number; lineCount: number; ratified: boolean }
      | null;
    a7_judgmentsAndSuits: { unsatisfiedJudgments: string[]; pendingSuits: string[] };
    a8_insurance: {
      policyType: string;
      carrier: string;
      policyNumber: string | null;
      coverageAmount: number | null;
      expirationDate: string | null;
    }[];
    a9_alienationProceedsRestrictions: string[];
    a10_cooperativeTaxDeductibility: string | null;
    a11_statutoryAgent: { applies: boolean; name: string | null };
    a12_pendingCommonElementSalesOrEncumbrances: string[];
    a13_useOrOccupancyRestrictions: string[];
    a14_unitsSixtyPlusDaysDelinquent: number;
    a15_foreclosuresPastTwelveMonths: number;
  };
  request: {
    requestedAt: string;
    expedited: boolean;
    slaBusinessDays: number;
    dueAt: string;
    feeUsd: number;
  };
  accuracyNote: string;
  attestation: { boardMemberName: string; attestedAt: string; validUntil: string | null };
}

interface ResaleCertificateResponse {
  recorded: boolean;
  feeUsd: number;
  certificate: ResaleCertificateDocument;
}

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const fmtDate = (iso: string) => (iso ? iso.slice(0, 10) : "—");

export default function ResaleCertificatePage() {
  useDocumentTitle("Resale Certificate (§47-270)");
  const { activeAssociationId } = useActiveAssociation();

  const [personId, setPersonId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [periodicAssessment, setPeriodicAssessment] = useState("350");
  const [reserveAmount, setReserveAmount] = useState("0");
  const [reserveBasis, setReserveBasis] = useState("");
  const [boardMember, setBoardMember] = useState("");
  const [purchaserName, setPurchaserName] = useState("");
  const [expedited, setExpedited] = useState(false);

  const { data: persons = [] } = useQuery<Person[]>({ queryKey: ["/api/persons"] });
  const { data: units = [] } = useQuery<Unit[]>({ queryKey: ["/api/units"] });

  const assocUnits = useMemo(
    () => units.filter((u) => u.associationId === activeAssociationId),
    [units, activeAssociationId],
  );
  const assocPersons = useMemo(
    () => persons.filter((p) => p.associationId === activeAssociationId),
    [persons, activeAssociationId],
  );

  const generate = useMutation<ResaleCertificateResponse, Error, boolean>({
    mutationFn: async (record: boolean) => {
      const url = record
        ? "/api/financial/resale-certificate/requests"
        : "/api/financial/resale-certificate/preview";
      const res = await apiRequest("POST", url, {
        associationId: activeAssociationId,
        unitId,
        personId,
        expedited,
        purchaserName: purchaserName || null,
        periodicCommonExpenseAssessment: Number(periodicAssessment),
        reserveForCapitalExpendituresUsd: Number(reserveAmount),
        reserveBasis: reserveBasis || null,
        attestation: { boardMemberName: boardMember, validityDays: 30 },
      });
      return res.json();
    },
  });

  const canGenerate = Boolean(
    activeAssociationId &&
      personId &&
      unitId &&
      boardMember &&
      periodicAssessment !== "" &&
      reserveAmount !== "",
  );

  const cert = generate.data?.certificate;
  const d = cert?.disclosures;

  return (
    <div className="flex flex-col min-h-0">
      <div className="p-6 space-y-6">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Finance / Governance
          </p>
          <h1 className="text-2xl font-semibold">Resale Certificate — CGS §47-270</h1>
          <p className="text-sm text-muted-foreground">
            Connecticut "6(d)" resale certificate. Must be furnished within 10 business days of a
            unit owner's request for a $185 statutory fee. A unit cannot close without it.
          </p>
        </div>

        <Card className="no-print">
          <CardContent className="grid grid-cols-1 gap-4 py-5 sm:grid-cols-2 lg:grid-cols-3 lg:items-end">
            <div className="flex flex-col gap-1">
              <Label htmlFor="rc-owner">Selling owner</Label>
              <Select value={personId} onValueChange={setPersonId}>
                <SelectTrigger id="rc-owner" data-testid="resale-owner-select">
                  <SelectValue placeholder="Select an owner" />
                </SelectTrigger>
                <SelectContent>
                  {assocPersons.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.firstName} {p.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="rc-unit">Unit</Label>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger id="rc-unit" data-testid="resale-unit-select">
                  <SelectValue placeholder="Select a unit" />
                </SelectTrigger>
                <SelectContent>
                  {assocUnits.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      Unit {u.unitNumber}
                      {u.building ? ` · ${u.building}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="rc-purchaser">Purchaser (optional)</Label>
              <Input
                id="rc-purchaser"
                value={purchaserName}
                onChange={(e) => setPurchaserName(e.target.value)}
                placeholder="Buyer name"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="rc-periodic">Periodic common charge ($) — §47-270(a)(2)</Label>
              <Input
                id="rc-periodic"
                type="number"
                value={periodicAssessment}
                onChange={(e) => setPeriodicAssessment(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="rc-reserve">Reserves ($) — §47-270(a)(5)</Label>
              <Input
                id="rc-reserve"
                type="number"
                value={reserveAmount}
                onChange={(e) => setReserveAmount(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="rc-reserve-basis">Reserve basis</Label>
              <Input
                id="rc-reserve-basis"
                value={reserveBasis}
                onChange={(e) => setReserveBasis(e.target.value)}
                placeholder="e.g. 2026 reserve study"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="rc-board">Attesting board member</Label>
              <Input
                id="rc-board"
                value={boardMember}
                onChange={(e) => setBoardMember(e.target.value)}
                placeholder="Board officer name"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="rc-expedite"
                type="checkbox"
                checked={expedited}
                onChange={(e) => setExpedited(e.target.checked)}
              />
              <Label htmlFor="rc-expedite">Expedited (3 biz days, +$10)</Label>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={!canGenerate || generate.isPending}
                onClick={() => generate.mutate(false)}
                data-testid="resale-preview-button"
              >
                Preview
              </Button>
              <Button
                disabled={!canGenerate || generate.isPending}
                onClick={() => generate.mutate(true)}
                data-testid="resale-generate-button"
              >
                Generate certificate
              </Button>
            </div>
          </CardContent>
        </Card>

        {generate.isError && (
          <p className="text-sm text-destructive">{generate.error.message}</p>
        )}

        {cert && d && (
          <Card data-testid="resale-certificate-view">
            <CardContent className="space-y-4 py-6 text-sm">
              <div className="border-b pb-3">
                <h2 className="text-lg font-semibold">
                  Resale Certificate — {cert.statuteCitation}
                </h2>
                <p className="text-muted-foreground">
                  {cert.association.name} · Unit {cert.unit.unitNumber}
                  {cert.unit.building ? ` (${cert.unit.building})` : ""} · Owner{" "}
                  {cert.sellingOwnerName}
                  {cert.purchaserName ? ` → ${cert.purchaserName}` : ""}
                </p>
                <p className="text-muted-foreground">
                  Generated {fmtDate(cert.generatedAt)} · Fee {usd(cert.request.feeUsd)} · Due{" "}
                  {fmtDate(cert.request.dueAt)} ({cert.request.slaBusinessDays} business days
                  {cert.request.expedited ? ", expedited" : ""})
                </p>
              </div>

              <dl className="grid grid-cols-1 gap-2">
                <Row label="(1) Right of first refusal / restraint">
                  {d.a1_rightOfFirstRefusal.statement}
                </Row>
                <Row label="(2) Amounts currently due">
                  Periodic {usd(d.a2_amountsDue.periodicCommonExpenseAssessment)} · Unpaid common{" "}
                  {usd(d.a2_amountsDue.unpaidCommonExpense)} · Unpaid special{" "}
                  {usd(d.a2_amountsDue.unpaidSpecialAssessment)} · Total{" "}
                  {usd(d.a2_amountsDue.totalCurrentlyDue)}
                </Row>
                <Row label="(3) Other fees">
                  {d.a3_otherFees.length
                    ? d.a3_otherFees.map((f) => `${f.description}: ${usd(f.amount)}`).join("; ")
                    : "None"}
                </Row>
                <Row label="(4) Approved capex > $1,000">
                  {d.a4_approvedCapitalExpenditures.length
                    ? d.a4_approvedCapitalExpenditures
                        .map((c) => `${c.description} (${usd(c.amount)}, FY${c.fiscalYear})`)
                        .join("; ")
                    : "None"}
                </Row>
                <Row label="(5) Reserves for capital expenditures">
                  {usd(d.a5_reservesForCapitalExpenditures.amountUsd)}
                  {d.a5_reservesForCapitalExpenditures.basis
                    ? ` — ${d.a5_reservesForCapitalExpenditures.basis}`
                    : ""}
                </Row>
                <Row label="(6) Current operating budget">
                  {d.a6_currentOperatingBudget
                    ? `FY${d.a6_currentOperatingBudget.fiscalYear} · ${usd(
                        d.a6_currentOperatingBudget.totalPlanned,
                      )} across ${d.a6_currentOperatingBudget.lineCount} lines (${
                        d.a6_currentOperatingBudget.ratified ? "ratified" : "draft"
                      })`
                    : "No budget on file"}
                </Row>
                <Row label="(7) Judgments & pending suits">
                  Judgments: {d.a7_judgmentsAndSuits.unsatisfiedJudgments.join("; ") || "None"} ·
                  Suits: {d.a7_judgmentsAndSuits.pendingSuits.join("; ") || "None"}
                </Row>
                <Row label="(8) Insurance">
                  {d.a8_insurance.length
                    ? d.a8_insurance
                        .map(
                          (p) =>
                            `${p.policyType} — ${p.carrier}${
                              p.coverageAmount ? ` (${usd(p.coverageAmount)})` : ""
                            }`,
                        )
                        .join("; ")
                    : "None on file"}
                </Row>
                <Row label="(9) Proceeds restrictions (sale/condemnation/casualty)">
                  {d.a9_alienationProceedsRestrictions.join("; ") || "None"}
                </Row>
                <Row label="(10) Cooperative tax deductibility">
                  {d.a10_cooperativeTaxDeductibility ?? "N/A (not a cooperative)"}
                </Row>
                <Row label="(11) Statutory agent">
                  {d.a11_statutoryAgent.applies
                    ? d.a11_statutoryAgent.name ?? "Required (unincorporated) — not on file"
                    : "N/A (incorporated association)"}
                </Row>
                <Row label="(12) Pending common-element sale/encumbrance">
                  {d.a12_pendingCommonElementSalesOrEncumbrances.join("; ") || "None"}
                </Row>
                <Row label="(13) Use/occupancy restrictions">
                  {d.a13_useOrOccupancyRestrictions.join("; ") || "None"}
                </Row>
                <Row label="(14) Units 60+ days delinquent">
                  {d.a14_unitsSixtyPlusDaysDelinquent}
                </Row>
                <Row label="(15) Foreclosure actions (past 12 months)">
                  {d.a15_foreclosuresPastTwelveMonths}
                </Row>
              </dl>

              <div className="border-t pt-3 text-muted-foreground">
                <p className="italic">{cert.accuracyNote}</p>
                <p className="mt-2">
                  Attested by <strong>{cert.attestation.boardMemberName}</strong> on{" "}
                  {fmtDate(cert.attestation.attestedAt)}
                  {cert.attestation.validUntil
                    ? ` · valid until ${fmtDate(cert.attestation.validUntil)}`
                    : ""}
                  .
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 border-b py-1.5 last:border-b-0 sm:grid-cols-[18rem_1fr]">
      <dt className="font-medium text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
