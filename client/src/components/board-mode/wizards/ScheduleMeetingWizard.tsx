// founder-os#9487 — Board mode wizard: Schedule a meeting.
// Guided: what kind + title → when & where → review → save.
// Submits POST /api/governance/meetings.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WizardFrame, WizardDone, ReviewRow } from "../WizardFrame";

const STEPS = ["Basics", "When & where", "Review"];

const MEETING_TYPES: { value: string; label: string }[] = [
  { value: "board", label: "Board meeting" },
  { value: "annual", label: "Annual meeting" },
  { value: "special", label: "Special meeting" },
  { value: "committee", label: "Committee meeting" },
];

export function ScheduleMeetingWizard() {
  const { activeAssociationId } = useActiveAssociation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [meetingType, setMeetingType] = useState("board");
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState(""); // datetime-local string
  const [location, setLocation] = useState("");
  const [agenda, setAgenda] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/governance/meetings", {
        associationId: activeAssociationId,
        meetingType,
        title: title.trim(),
        scheduledAt: new Date(when).toISOString(),
        location: location.trim() || null,
        agenda: agenda.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/meetings"] });
      setDone(true);
    },
    onError: (err: Error) => toast({ title: "Couldn't schedule the meeting", description: err.message, variant: "destructive" }),
  });

  if (done) {
    return (
      <WizardDone
        message={`"${title.trim()}" is on the calendar.`}
        onAgain={() => { setMeetingType("board"); setTitle(""); setWhen(""); setLocation(""); setAgenda(""); setStep(0); setDone(false); }}
        againLabel="Schedule another meeting"
      />
    );
  }

  const whenValid = when.trim() !== "" && !Number.isNaN(new Date(when).getTime());
  const canAdvance = step === 0 ? title.trim().length > 0 : step === 1 ? whenValid : true;
  const isLast = step === STEPS.length - 1;
  const typeLabel = MEETING_TYPES.find((t) => t.value === meetingType)?.label ?? meetingType;

  return (
    <WizardFrame
      title="Schedule a meeting"
      icon={CalendarDays}
      intro="Put a board or community meeting on the calendar. Owners can be notified afterward."
      stepTitles={STEPS}
      current={step}
      canAdvance={canAdvance}
      isLastStep={isLast}
      busy={save.isPending}
      finishLabel="Schedule meeting"
      testId="wizard-schedule-meeting"
      onBack={() => setStep((s) => Math.max(0, s - 1))}
      onNext={() => (isLast ? save.mutate() : setStep((s) => s + 1))}
    >
      {step === 0 && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>What kind of meeting?</Label>
            <Select value={meetingType} onValueChange={setMeetingType}>
              <SelectTrigger data-testid="select-meeting-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MEETING_TYPES.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sm-title">Meeting name</Label>
            <Input id="sm-title" data-testid="input-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="July board meeting" />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sm-when">Date & time</Label>
            <Input id="sm-when" data-testid="input-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sm-loc">Where <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="sm-loc" data-testid="input-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Clubhouse / Zoom link" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sm-agenda">Agenda <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea id="sm-agenda" data-testid="input-agenda" value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder="1. Review budget 2. Landscaping bids 3. Open floor" rows={3} />
          </div>
        </div>
      )}

      {step === 2 && (
        <dl className="space-y-2 text-sm" data-testid="review-schedule-meeting">
          <ReviewRow label="Type" value={typeLabel} />
          <ReviewRow label="Name" value={title.trim()} />
          <ReviewRow label="When" value={whenValid ? new Date(when).toLocaleString() : "—"} />
          {location.trim() && <ReviewRow label="Where" value={location.trim()} />}
          {agenda.trim() && <ReviewRow label="Agenda" value={agenda.trim()} />}
        </dl>
      )}
    </WizardFrame>
  );
}
