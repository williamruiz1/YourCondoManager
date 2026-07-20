// founder-os#9487 — Board mode wizard: Log a violation.
// Guided: what happened → who & where (optional) → fine? (optional) → review → save.
// Submits one atomic workflow request for the violation + optional linked fine.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WizardFrame, WizardDone, ReviewRow } from "../WizardFrame";
import { useUnitOptions, usePersonOptions, unitLabel, personLabel } from "../use-pickers";

const STEPS = ["What happened", "Who & where", "Fine", "Review"];
const NONE = "__none__";

const VIOLATION_TYPES = [
  "Trash / bins",
  "Parking",
  "Noise",
  "Pets",
  "Architectural change",
  "Landscaping",
  "Other",
];

export function LogViolationWizard() {
  const { activeAssociationId } = useActiveAssociation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const units = useUnitOptions();
  const persons = usePersonOptions();

  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [violationType, setViolationType] = useState(VIOLATION_TYPES[0]);
  const [description, setDescription] = useState("");
  const [unitId, setUnitId] = useState(NONE);
  const [personId, setPersonId] = useState(NONE);
  const [addFine, setAddFine] = useState("no");
  const [fineAmount, setFineAmount] = useState("");

  const fineNum = Number(fineAmount);
  const wantsFine = addFine === "yes";
  const fineValid = !wantsFine || (fineAmount.trim() !== "" && Number.isFinite(fineNum) && fineNum > 0);
  // A fine can only be posted against a specific home + owner.
  const fineNeedsTarget = wantsFine && (unitId === NONE || personId === NONE);

  const save = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/board/workflows/log-violation", {
        associationId: activeAssociationId,
        unitId: unitId !== NONE ? unitId : null,
        personId: personId !== NONE ? personId : null,
        violationType,
        description: description.trim(),
        observedAt: new Date().toISOString(),
        fineAmount: wantsFine && fineValid ? fineNum : null,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/violations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial/owner-ledger/entries"] });
      setDone(true);
    },
    onError: (err: Error) => toast({ title: "Couldn't log the violation", description: err.message, variant: "destructive" }),
  });

  if (done) {
    return (
      <WizardDone
        message={wantsFine && fineValid ? `The violation and linked $${fineNum.toFixed(2)} fine were saved together. No violation notice was sent.` : "The violation was logged. No violation notice was sent."}
        onAgain={() => { setViolationType(VIOLATION_TYPES[0]); setDescription(""); setUnitId(NONE); setPersonId(NONE); setAddFine("no"); setFineAmount(""); setStep(0); setDone(false); }}
        againLabel="Log another violation"
      />
    );
  }

  const canAdvance =
    step === 0 ? description.trim().length > 0
    : step === 2 ? fineValid && !fineNeedsTarget
    : true;
  const isLast = step === STEPS.length - 1;
  const unit = units.data?.find((u) => u.id === unitId);
  const person = persons.data?.find((p) => p.id === personId);

  return (
    <WizardFrame
      title="Log a violation"
      icon={AlertTriangle}
      intro="Record that someone broke a community rule. You can add a fine now or later."
      stepTitles={STEPS}
      current={step}
      canAdvance={canAdvance}
      isLastStep={isLast}
      busy={save.isPending}
      finishLabel="Log violation"
      testId="wizard-log-violation"
      onBack={() => setStep((s) => Math.max(0, s - 1))}
      onNext={() => (isLast ? save.mutate() : setStep((s) => s + 1))}
    >
      {step === 0 && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>What kind of rule was broken?</Label>
            <Select value={violationType} onValueChange={setViolationType}>
              <SelectTrigger data-testid="select-violation-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VIOLATION_TYPES.map((v) => (<SelectItem key={v} value={v}>{v}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lv-desc">What happened?</Label>
            <Textarea id="lv-desc" data-testid="input-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Trash bins left at the curb three days after pickup." rows={3} />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Tie this to a home and owner if you know it. You can skip either.</p>
          <div className="space-y-1.5">
            <Label>Home <span className="text-muted-foreground">(optional)</span></Label>
            <Select value={unitId} onValueChange={setUnitId}>
              <SelectTrigger data-testid="select-unit"><SelectValue placeholder="Choose a home" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not sure / skip</SelectItem>
                {(units.data ?? []).map((u) => (<SelectItem key={u.id} value={u.id}>{unitLabel(u)}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Owner <span className="text-muted-foreground">(optional)</span></Label>
            <Select value={personId} onValueChange={setPersonId}>
              <SelectTrigger data-testid="select-person"><SelectValue placeholder="Choose an owner" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not sure / skip</SelectItem>
                {(persons.data ?? []).map((p) => (<SelectItem key={p.id} value={p.id}>{personLabel(p)}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Add a fine?</Label>
            <Select value={addFine} onValueChange={setAddFine}>
              <SelectTrigger data-testid="select-add-fine"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="no">No fine — just a record</SelectItem>
                <SelectItem value="yes">Yes, add a fine</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {wantsFine && (
            <div className="space-y-1.5">
              <Label htmlFor="lv-fine">Fine amount</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input id="lv-fine" data-testid="input-fine" inputMode="decimal" className="pl-7" value={fineAmount} onChange={(e) => setFineAmount(e.target.value)} placeholder="50.00" />
              </div>
              {fineNeedsTarget && (
                <p className="text-xs text-destructive">To add a fine, go back and pick both a home and an owner.</p>
              )}
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <dl className="space-y-2 text-sm" data-testid="review-log-violation">
          <ReviewRow label="Rule" value={violationType} />
          <ReviewRow label="What happened" value={description.trim()} />
          <ReviewRow label="Home" value={unit ? unitLabel(unit) : "Not linked"} />
          <ReviewRow label="Owner" value={person ? personLabel(person) : "Not linked"} />
          <ReviewRow label="Fine" value={wantsFine && fineValid ? `$${fineNum.toFixed(2)}` : "None"} />
        </dl>
      )}
    </WizardFrame>
  );
}
