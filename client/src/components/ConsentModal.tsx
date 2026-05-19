// #342 (WS3) — Consent audit modal. Renders after auth but before the
// admin reaches the dashboard if they haven't yet consented to
// CURRENT_POLICY_VERSION. Cannot be dismissed without clicking "I agree":
//   - No close X
//   - ESC bypass is disabled (Radix Dialog `onEscapeKeyDown` preventDefault)
//   - Pointer-outside-content close is disabled (`onPointerDownOutside` preventDefault)
//
// On submit it POSTs /api/consent which records the policyVersion + IP + UA
// and returns 201; on success the modal closes and the consent gate releases
// the rest of the app.
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { reportError } from "@/lib/error-reporting";
import { ShieldCheck } from "lucide-react";

type ConsentResponse = {
  id: string;
  consentedAt: string;
  policyVersion: string;
};

export function ConsentModal({ onConsented }: { onConsented: () => void }) {
  const { toast } = useToast();

  const consentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/consent", {});
      return (await res.json()) as ConsentResponse;
    },
    onSuccess: () => {
      onConsented();
    },
    onError: (err: Error) => {
      reportError(err, { feature: "consent-modal", action: "record-consent" });
      toast({ title: "Couldn't record consent", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open modal>
      <DialogContent
        // No close affordance — the spec requires no X and no ESC bypass.
        className="sm:max-w-md [&>button[aria-label='Close']]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        data-testid="consent-modal"
      >
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <DialogTitle>Before you continue</DialogTitle>
          <DialogDescription>
            By continuing, you agree to our{" "}
            <a href="/privacy" className="font-medium underline" target="_blank" rel="noreferrer">Privacy Policy</a>
            {" "}and{" "}
            <a href="/terms" className="font-medium underline" target="_blank" rel="noreferrer">Terms of Service</a>.
          </DialogDescription>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          We record this agreement (date, time, and a one-way audit reference) so
          you and your community have an evidence trail. You can review the full
          policies at the links above.
        </p>
        <DialogFooter>
          <Button
            type="button"
            className="w-full"
            onClick={() => consentMutation.mutate()}
            disabled={consentMutation.isPending}
            data-testid="consent-modal-agree"
          >
            {consentMutation.isPending ? "Saving…" : "I agree and continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
