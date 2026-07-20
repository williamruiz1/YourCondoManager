// founder-os#9487 — Board mode wizard: Post a charge (bill an owner).
// Guided: pick home & owner → charge amount + reason → review → save.
// Submits the Board charge workflow, which validates the owner/home relationship.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DollarSign } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WizardFrame, WizardDone, ReviewRow } from "../WizardFrame";
import { useUnitOptions, usePersonOptions, unitLabel, personLabel } from "../use-pickers";

const STEPS = ["Who", "Charge", "Review"];

export function PostChargeWizard() {
  const { activeAssociationId } = useActiveAssociation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const units = useUnitOptions();
  const persons = usePersonOptions();

  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [unitId, setUnitId] = useState("");
  const [personId, setPersonId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const amountNum = Number(amount);
  const amountValid = amount.trim() !== "" && Number.isFinite(amountNum) && amountNum > 0;

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/board/workflows/post-charge", {
        associationId: activeAssociationId,
        unitId,
        personId,
        entryType: "charge",
        amount: amountNum,
        postedAt: new Date().toISOString(),
        description: description.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial/owner-ledger/entries"] });
      setDone(true);
    },
    onError: (err: Error) => toast({ title: "Couldn't post the charge", description: err.message, variant: "destructive" }),
  });

  if (done) {
    return (
      <WizardDone
        message={`A charge of $${amountNum.toFixed(2)} was added to the owner's account. No owner notice was sent.`}
        onAgain={() => { setUnitId(""); setPersonId(""); setAmount(""); setDescription(""); setStep(0); setDone(false); }}
        againLabel="Post another charge"
      />
    );
  }

  const canAdvance = step === 0 ? unitId !== "" && personId !== "" : step === 1 ? amountValid : true;
  const isLast = step === STEPS.length - 1;
  const unit = units.data?.find((u) => u.id === unitId);
  const person = persons.data?.find((p) => p.id === personId);

  return (
    <WizardFrame
      title="Bill an owner"
      icon={DollarSign}
      intro="Add a one-time charge to an owner's account — a fine, a fee, or anything they owe."
      stepTitles={STEPS}
      current={step}
      canAdvance={canAdvance}
      isLastStep={isLast}
      busy={save.isPending}
      finishLabel="Post charge"
      testId="wizard-post-charge"
      onBack={() => setStep((s) => Math.max(0, s - 1))}
      onNext={() => (isLast ? save.mutate() : setStep((s) => s + 1))}
    >
      {step === 0 && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Home</Label>
            <Select value={unitId} onValueChange={setUnitId}>
              <SelectTrigger data-testid="select-unit"><SelectValue placeholder="Choose a home" /></SelectTrigger>
              <SelectContent>
                {(units.data ?? []).map((u) => (<SelectItem key={u.id} value={u.id}>{unitLabel(u)}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Owner</Label>
            <Select value={personId} onValueChange={setPersonId}>
              <SelectTrigger data-testid="select-person"><SelectValue placeholder="Choose an owner" /></SelectTrigger>
              <SelectContent>
                {(persons.data ?? []).map((p) => (<SelectItem key={p.id} value={p.id}>{personLabel(p)}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pc-amount">Amount owed</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input id="pc-amount" data-testid="input-amount" inputMode="decimal" className="pl-7" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="150.00" />
            </div>
            {!amountValid && amount.trim() !== "" && (
              <p className="text-xs text-destructive">Enter an amount greater than zero.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pc-desc">What's this for? <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea id="pc-desc" data-testid="input-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Late-payment fee for June dues" rows={3} />
          </div>
        </div>
      )}

      {step === 2 && (
        <dl className="space-y-2 text-sm" data-testid="review-post-charge">
          <ReviewRow label="Home" value={unit ? unitLabel(unit) : "—"} />
          <ReviewRow label="Owner" value={person ? personLabel(person) : "—"} />
          <ReviewRow label="Amount" value={`$${amountNum.toFixed(2)}`} />
          {description.trim() && <ReviewRow label="For" value={description.trim()} />}
        </dl>
      )}
    </WizardFrame>
  );
}
