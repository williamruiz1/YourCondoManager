// #1617 — Step 5: announce YCM to your owners. The board edits a
// template, previews it, and sends in one click via Resend bulk-send.
// Step completion is recorded by the parent wizard after the send
// succeeds (server response.sent > 0).
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, Eye, ArrowRight, Users } from "lucide-react";
import type { OnboardingWizardSnapshot } from "./types";

const DEFAULT_BODY = (communityName: string, treasurerName: string) => `Hi neighbor,

The board has started using YourCondoManager (YCM) to handle assessments, payments, and community communications for ${communityName}. From here forward, you'll receive invoices, receipts, and announcements through YCM instead of the patchwork we've been using.

You'll receive a separate email with your owner portal invite — click through to set your password and you'll be able to see your balance, pay online, and view past statements anytime.

If you have questions or need help getting set up, reply to this email or reach out to me directly.

— ${treasurerName}, on behalf of the board`;

type AssociationRow = {
  id: string;
  name: string;
};

export function Step5MassCommunication({
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
  const [previewing, setPreviewing] = useState(false);

  const associationQuery = useQuery<AssociationRow | null>({
    queryKey: ["/api/onboarding/wizard/step5-assoc", snapshot.associationId],
    enabled: Boolean(snapshot.associationId),
    queryFn: async () => {
      const res = await fetch(`/api/associations`, { credentials: "include" });
      if (!res.ok) return null;
      const list = (await res.json()) as AssociationRow[];
      return list.find((a) => a.id === snapshot.associationId) ?? null;
    },
  });

  const communityName = associationQuery.data?.name ?? "your community";
  const defaultBody = useMemo(
    () => DEFAULT_BODY(communityName, "{{board_president_name}}"),
    [communityName],
  );

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(defaultBody);

  // When the association name resolves, refresh the default body unless
  // the user has already edited it (heuristic: still contains the merge tag).
  if (body === DEFAULT_BODY("your community", "{{board_president_name}}") && communityName !== "your community") {
    setBody(defaultBody);
  }

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!snapshot.associationId) throw new Error("Finish Step 1 first.");
      const res = await apiRequest("POST", "/api/onboarding/wizard/announce", {
        associationId: snapshot.associationId,
        communityName,
        bodyText: body,
        subjectOverride: subject.trim() || undefined,
      });
      return (await res.json()) as { recipients: number; sent: number; failed: number; message?: string };
    },
    onSuccess: (result) => {
      if (result.message) {
        toast({ title: "Heads up", description: result.message });
        return;
      }
      toast({
        title: "Announcement sent",
        description: `Sent to ${result.sent} owner${result.sent === 1 ? "" : "s"}${result.failed > 0 ? ` (${result.failed} failed)` : ""}.`,
      });
      onComplete();
    },
    onError: (err: Error) => toast({ title: "Couldn't send announcement", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Tell owners you're using YCM now. We've drafted a starter message —
        edit it however you'd like, then send it to everyone with an email
        on file for {communityName}.
      </p>

      <div className="space-y-2">
        <Label htmlFor="wizard-step-5-subject">Subject (optional)</Label>
        <Input
          id="wizard-step-5-subject"
          placeholder={`${communityName} is now using YourCondoManager`}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          data-testid="wizard-step-5-subject"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="wizard-step-5-body">Message</Label>
        <Textarea
          id="wizard-step-5-body"
          rows={12}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          data-testid="wizard-step-5-body"
        />
        <p className="text-xs text-muted-foreground">
          Plain text only — links auto-format. Paragraph breaks (blank lines) carry through.
        </p>
      </div>

      {previewing && (
        <div className="rounded-md border bg-muted/30 p-4" data-testid="wizard-step-5-preview">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview</p>
          <p className="mb-3 text-sm font-semibold">{subject.trim() || `${communityName} is now using YourCondoManager`}</p>
          <div className="space-y-2 text-sm">
            {body.split(/\n\s*\n/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={() => setPreviewing((v) => !v)} data-testid="wizard-step-5-toggle-preview">
          <Eye className="mr-2 h-4 w-4" />
          {previewing ? "Hide preview" : "Preview"}
        </Button>
        <Button type="button" variant="outline" onClick={onSkip} disabled={isSaving || sendMutation.isPending} data-testid="wizard-step-5-skip">
          Skip for now
        </Button>
        <Button
          type="button"
          onClick={() => sendMutation.mutate()}
          disabled={sendMutation.isPending || body.trim().length < 20}
          data-testid="wizard-step-5-send"
        >
          <Send className="mr-2 h-4 w-4" />
          {sendMutation.isPending ? "Sending…" : "Send to all owners"}
        </Button>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Sends to owners with an email on file. Need to add owners? Skip and finish Step 3 (Upload roster) first.</span>
      </div>
    </div>
  );
}
