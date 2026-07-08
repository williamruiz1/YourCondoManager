// founder-os#9487 — Board mode wizard: Add an owner.
// Guided: owner details → (optional) link to a home → review → save.
// Submits POST /api/persons, then optionally POST /api/ownerships.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WizardFrame, WizardDone, ReviewRow } from "../WizardFrame";
import { useUnitOptions, unitLabel } from "../use-pickers";

const STEPS = ["Owner", "Home", "Review"];
const NONE = "__none__";

export function AddOwnerWizard() {
  const { activeAssociationId } = useActiveAssociation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const units = useUnitOptions();

  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [unitId, setUnitId] = useState<string>(NONE);

  const save = useMutation({
    mutationFn: async () => {
      const personRes = await apiRequest("POST", "/api/persons", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        associationId: activeAssociationId || null,
      });
      const person = (await personRes.json()) as { id: string };
      if (unitId && unitId !== NONE) {
        await apiRequest("POST", "/api/ownerships", {
          unitId,
          personId: person.id,
          ownershipPercentage: 100,
          startDate: new Date().toISOString(),
        });
      }
      return person;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/persons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ownerships"] });
      setDone(true);
    },
    onError: (err: Error) => toast({ title: "Couldn't add owner", description: err.message, variant: "destructive" }),
  });

  if (done) {
    return (
      <WizardDone
        message={`${firstName} ${lastName} was added to your community.`}
        onAgain={() => {
          setFirstName(""); setLastName(""); setEmail(""); setPhone(""); setUnitId(NONE); setStep(0); setDone(false);
        }}
        againLabel="Add another owner"
      />
    );
  }

  const canAdvance =
    step === 0 ? firstName.trim().length > 0 && lastName.trim().length > 0 : true;
  const isLast = step === STEPS.length - 1;

  return (
    <WizardFrame
      title="Add an owner"
      icon={UserPlus}
      intro="Add a new owner or resident to your community. Only a name is required — the rest is optional."
      stepTitles={STEPS}
      current={step}
      canAdvance={canAdvance}
      isLastStep={isLast}
      busy={save.isPending}
      finishLabel="Add owner"
      testId="wizard-add-owner"
      onBack={() => setStep((s) => Math.max(0, s - 1))}
      onNext={() => (isLast ? save.mutate() : setStep((s) => s + 1))}
    >
      {step === 0 && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ao-first">First name</Label>
              <Input id="ao-first" data-testid="input-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ao-last">Last name</Label>
              <Input id="ao-last" data-testid="input-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ao-email">Email <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="ao-email" data-testid="input-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ao-phone">Phone <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="ao-phone" data-testid="input-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(302) 555-0142" />
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-2">
          <Label>Which home do they own? <span className="text-muted-foreground">(optional)</span></Label>
          <p className="text-sm text-muted-foreground">Link this owner to a home now, or skip and do it later.</p>
          <Select value={unitId} onValueChange={setUnitId}>
            <SelectTrigger data-testid="select-unit"><SelectValue placeholder="Choose a home" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Skip for now</SelectItem>
              {(units.data ?? []).map((u) => (
                <SelectItem key={u.id} value={u.id}>{unitLabel(u)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {step === 2 && (
        <dl className="space-y-2 text-sm" data-testid="review-add-owner">
          <ReviewRow label="Name" value={`${firstName} ${lastName}`.trim()} />
          {email.trim() && <ReviewRow label="Email" value={email.trim()} />}
          {phone.trim() && <ReviewRow label="Phone" value={phone.trim()} />}
          <ReviewRow
            label="Home"
            value={unitId && unitId !== NONE ? (units.data?.find((u) => u.id === unitId) ? unitLabel(units.data.find((u) => u.id === unitId)!) : "Selected home") : "Not linked yet"}
          />
        </dl>
      )}
    </WizardFrame>
  );
}
