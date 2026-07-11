// founder-os#9487 — Board mode wizard: Request vendor work.
// Guided: what needs doing → where & how urgent → review → save.
// Submits POST /api/work-orders.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Wrench } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WizardFrame, WizardDone, ReviewRow } from "../WizardFrame";
import { useUnitOptions, unitLabel } from "../use-pickers";

const STEPS = ["What", "Where & urgency", "Review"];
const NONE = "__none__";

const CATEGORIES = ["general", "plumbing", "electrical", "landscaping", "cleaning", "roofing", "hvac"];
const PRIORITIES: { value: string; label: string }[] = [
  { value: "low", label: "Whenever — not urgent" },
  { value: "medium", label: "Soon" },
  { value: "high", label: "This week" },
  { value: "urgent", label: "Emergency — right away" },
];

export function RequestVendorWorkWizard() {
  const { activeAssociationId } = useActiveAssociation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const units = useUnitOptions();

  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("medium");
  const [unitId, setUnitId] = useState(NONE);
  const [location, setLocation] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/work-orders", {
        associationId: activeAssociationId,
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        status: "open",
        unitId: unitId !== NONE ? unitId : null,
        locationText: location.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      setDone(true);
    },
    onError: (err: Error) => toast({ title: "Couldn't create the request", description: err.message, variant: "destructive" }),
  });

  if (done) {
    return (
      <WizardDone
        message={`Your repair request "${title.trim()}" was created. Assign a contractor to it from Repair jobs.`}
        onAgain={() => { setTitle(""); setDescription(""); setCategory("general"); setPriority("medium"); setUnitId(NONE); setLocation(""); setStep(0); setDone(false); }}
        againLabel="Request more work"
      />
    );
  }

  const canAdvance = step === 0 ? title.trim().length > 0 && description.trim().length > 0 : true;
  const isLast = step === STEPS.length - 1;
  const priorityLabel = PRIORITIES.find((p) => p.value === priority)?.label ?? priority;

  return (
    <WizardFrame
      title="Request vendor work"
      icon={Wrench}
      intro="Create a repair job for a contractor — describe what needs fixing and how urgent it is."
      stepTitles={STEPS}
      current={step}
      canAdvance={canAdvance}
      isLastStep={isLast}
      busy={save.isPending}
      finishLabel="Create request"
      testId="wizard-request-work"
      onBack={() => setStep((s) => Math.max(0, s - 1))}
      onNext={() => (isLast ? save.mutate() : setStep((s) => s + 1))}
    >
      {step === 0 && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rw-title">What needs doing?</Label>
            <Input id="rw-title" data-testid="input-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Fix leaking gutter on Building B" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rw-desc">Describe the problem</Label>
            <Textarea id="rw-desc" data-testid="input-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Gutter above the north entrance is overflowing when it rains and staining the brick." rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Kind of work</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger data-testid="select-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (<SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>How urgent?</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger data-testid="select-priority"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (<SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Which home? <span className="text-muted-foreground">(optional)</span></Label>
            <Select value={unitId} onValueChange={setUnitId}>
              <SelectTrigger data-testid="select-unit"><SelectValue placeholder="Common area / not a specific home" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Common area / not a specific home</SelectItem>
                {(units.data ?? []).map((u) => (<SelectItem key={u.id} value={u.id}>{unitLabel(u)}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rw-loc">Where exactly? <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="rw-loc" data-testid="input-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="North entrance, Building B" />
          </div>
        </div>
      )}

      {step === 2 && (
        <dl className="space-y-2 text-sm" data-testid="review-request-work">
          <ReviewRow label="Job" value={title.trim()} />
          <ReviewRow label="Details" value={description.trim()} />
          <ReviewRow label="Kind" value={category} />
          <ReviewRow label="Urgency" value={priorityLabel} />
          <ReviewRow label="Home" value={unitId !== NONE ? (units.data?.find((u) => u.id === unitId) ? unitLabel(units.data.find((u) => u.id === unitId)!) : "Selected home") : "Common area"} />
          {location.trim() && <ReviewRow label="Where" value={location.trim()} />}
        </dl>
      )}
    </WizardFrame>
  );
}
