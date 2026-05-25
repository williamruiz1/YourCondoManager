// founder-os#1616 (Child B) — Step 2 of the day-0-14 onboarding wizard.
//
// Plain English: a brand-new treasurer just confirmed the community details
// in Step 1. Now they need to give YCM a bank account so we can collect
// assessments, sync transactions, and reconcile payments. The happy path is
// instant: they click "Connect bank with Plaid," log into their bank, and
// we get back a verified ACH PaymentMethod they can autopay from. If their
// bank isn't on Plaid (rare for US retail banks but happens for small
// credit unions) they fall back to a manual-entry form where we keep the
// account in `pending_verification` until microdeposits clear.
//
// Architectural choice — per founder-os#1780 Path B (2026-05-25): the
// Plaid Link launches directly INSIDE YCM, not via Stripe-Checkout-hosted
// Plaid. The flow is:
//   1. POST /api/plaid/create-link-token        → get link_token
//   2. open Plaid Link (react-plaid-link)       → owner authenticates
//   3. POST /api/plaid/exchange-token           → get access_token, persist bank_connection
//   4. POST /api/onboarding/plaid/save-payment-method → write saved_payment_methods row
// Once we have the saved_payment_methods row, autopay enrollments (Step 4
// indirectly, the autopay UI directly) can reference it.
import { useCallback, useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { usePlaidLink, type PlaidLinkOnSuccess, type PlaidLinkOnSuccessMetadata } from "react-plaid-link";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Landmark, ArrowRight, ShieldCheck, CheckCircle2, Loader2, Info } from "lucide-react";
import type { OnboardingWizardSnapshot } from "./types";

const manualSchema = z.object({
  bankName: z.string().min(1, "Bank name is required"),
  accountHolderName: z.string().min(1, "Account holder name is required"),
  routingNumber: z
    .string()
    .min(9, "Routing number must be 9 digits")
    .max(9, "Routing number must be 9 digits")
    .regex(/^\d{9}$/, "Routing number must be 9 digits"),
  accountNumber: z
    .string()
    .min(4, "Account number is required")
    .regex(/^\d+$/, "Account number must be digits only"),
});
type ManualData = z.infer<typeof manualSchema>;

export function Step2ConnectBank({
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
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [connected, setConnected] = useState<{ displayName: string; mode: "plaid" | "manual" } | null>(null);
  const [showManual, setShowManual] = useState(false);

  // ── Plaid Link flow ────────────────────────────────────────────────────────
  const createLinkToken = useMutation({
    mutationFn: async () => {
      if (!snapshot.associationId) {
        throw new Error("Finish Step 1 (community details) first so we know which association to link the bank to.");
      }
      const res = await apiRequest("POST", "/api/plaid/create-link-token", {
        associationId: snapshot.associationId,
      });
      return (await res.json()) as { linkToken: string };
    },
    onSuccess: (data) => setLinkToken(data.linkToken),
    onError: (err: Error) => {
      toast({ title: "Could not start Plaid Link", description: err.message, variant: "destructive" });
    },
  });

  const exchangeToken = useMutation({
    mutationFn: async (input: { publicToken: string; metadata: PlaidLinkOnSuccessMetadata }) => {
      if (!snapshot.associationId) throw new Error("Association not bound to wizard");
      const exRes = await apiRequest("POST", "/api/plaid/exchange-token", {
        associationId: snapshot.associationId,
        publicToken: input.publicToken,
        institutionName: input.metadata.institution?.name ?? null,
      });
      const exchange = (await exRes.json()) as { connectionId: string; accountCount: number };

      // Persist a saved_payment_methods row so autopay can reference it. We
      // use the first linked account as the display name; multi-account
      // institutions get a generic label and the owner can rename later.
      const acct = input.metadata.accounts?.[0];
      const displayName = acct
        ? `${input.metadata.institution?.name ?? "Bank"} ${acct.name}${acct.mask ? ` ••••${acct.mask}` : ""}`
        : (input.metadata.institution?.name ?? "Linked bank account");
      const saveRes = await apiRequest("POST", "/api/onboarding/plaid/save-payment-method", {
        associationId: snapshot.associationId,
        displayName,
        bankName: input.metadata.institution?.name ?? null,
        last4: acct?.mask ?? null,
        accountId: acct?.id ?? null,
        bankConnectionId: exchange.connectionId,
      });
      const saved = (await saveRes.json()) as { id: string; displayName: string };
      return saved;
    },
    onSuccess: (saved) => {
      setLinkToken(null);
      setConnected({ displayName: saved.displayName, mode: "plaid" });
      toast({ title: "Bank connected", description: "We'll automatically sync transactions from now on." });
    },
    onError: (err: Error) => {
      setLinkToken(null);
      toast({ title: "Connection failed", description: err.message, variant: "destructive" });
    },
  });

  const onPlaidSuccess = useCallback<PlaidLinkOnSuccess>(
    (publicToken, metadata) => exchangeToken.mutate({ publicToken, metadata }),
    [exchangeToken],
  );

  const { open: openPlaid, ready: plaidReady } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: () => setLinkToken(null),
  });

  // Auto-open Plaid Link as soon as the SDK is ready with a fresh token.
  useEffect(() => {
    if (linkToken && plaidReady) openPlaid();
  }, [linkToken, plaidReady, openPlaid]);

  // ── Manual entry fallback ──────────────────────────────────────────────────
  const manualForm = useForm<ManualData>({
    resolver: zodResolver(manualSchema),
    defaultValues: { bankName: "", accountHolderName: "", routingNumber: "", accountNumber: "" },
  });

  const saveManual = useMutation({
    mutationFn: async (values: ManualData) => {
      if (!snapshot.associationId) throw new Error("Association not bound to wizard");
      const last4 = values.accountNumber.slice(-4);
      const res = await apiRequest("POST", "/api/onboarding/payment-methods/manual", {
        associationId: snapshot.associationId,
        bankName: values.bankName,
        accountLast4: last4,
        accountHolderName: values.accountHolderName,
      });
      return (await res.json()) as { id: string; displayName: string };
    },
    onSuccess: (saved) => {
      setConnected({ displayName: saved.displayName, mode: "manual" });
      toast({
        title: "Manual bank entry saved",
        description: "We'll send two small deposits in 1-3 business days for verification.",
      });
      setShowManual(false);
    },
    onError: (err: Error) =>
      toast({ title: "Couldn't save bank details", description: err.message, variant: "destructive" }),
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  if (connected) {
    return (
      <div className="space-y-6" data-testid="wizard-step-2-connected">
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>{connected.mode === "plaid" ? "Bank connected via Plaid" : "Bank details saved"}</AlertTitle>
          <AlertDescription>
            <span className="font-medium">{connected.displayName}</span>
            {connected.mode === "manual" && (
              <span className="mt-1 block text-xs">
                Verification deposits will arrive in 1-3 business days. We'll mark this account active automatically once you confirm them in the Finance section.
              </span>
            )}
          </AlertDescription>
        </Alert>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" onClick={onComplete} disabled={isSaving} data-testid="wizard-step-2-continue">
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (showManual) {
    return (
      <Form {...manualForm}>
        <form
          className="space-y-4"
          onSubmit={manualForm.handleSubmit((values) => saveManual.mutate(values))}
          data-testid="wizard-step-2-manual-form"
        >
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Manual bank entry</AlertTitle>
            <AlertDescription>
              Use this if your bank isn't supported by Plaid. We'll verify the account with two small deposits over the next 1-3 business days.
            </AlertDescription>
          </Alert>

          <FormField
            control={manualForm.control}
            name="bankName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bank name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. First National Bank" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={manualForm.control}
            name="accountHolderName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account holder name</FormLabel>
                <FormControl>
                  <Input placeholder="Maple Heights Condo Association" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={manualForm.control}
              name="routingNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Routing number</FormLabel>
                  <FormControl>
                    <Input placeholder="9 digits" maxLength={9} inputMode="numeric" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={manualForm.control}
              name="accountNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account number</FormLabel>
                  <FormControl>
                    <Input placeholder="Account #" inputMode="numeric" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <p className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
            We only store the last 4 digits of your account number for display. The full number is used to initiate microdeposit verification and is not retained.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => setShowManual(false)} disabled={saveManual.isPending}>
              Back to Plaid
            </Button>
            <Button type="submit" disabled={saveManual.isPending} data-testid="wizard-step-2-manual-submit">
              {saveManual.isPending ? "Saving…" : "Save bank details"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
      </Form>
    );
  }

  const plaidBusy = createLinkToken.isPending || exchangeToken.isPending || (linkToken !== null && !plaidReady);

  return (
    <div className="space-y-6" data-testid="wizard-step-2-connect">
      <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-4">
        <Landmark className="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium">Why connect a bank?</p>
          <p className="text-sm text-muted-foreground">
            YCM uses your operating account to record assessment payments, reconcile owner ledgers, and pull recent transactions so the board always sees an accurate balance. We use Plaid for read-only bank access — your credentials never touch our servers.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-md border border-dashed bg-background p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" />
        <div className="flex-1 text-xs text-muted-foreground">
          Plaid is the same bank-link provider used by Venmo, Robinhood, and most fintech apps. Your credentials are encrypted in transit and never visible to YCM staff.
        </div>
      </div>

      <Button
        type="button"
        className="w-full"
        size="lg"
        onClick={() => createLinkToken.mutate()}
        disabled={plaidBusy || !snapshot.associationId}
        data-testid="wizard-step-2-plaid-button"
      >
        {plaidBusy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Opening Plaid…
          </>
        ) : (
          <>
            <Landmark className="mr-2 h-4 w-4" />
            Connect bank with Plaid
          </>
        )}
      </Button>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setShowManual(true)}
          disabled={plaidBusy}
          data-testid="wizard-step-2-manual-toggle"
        >
          Enter bank details manually
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onSkip}
          disabled={isSaving || plaidBusy}
          data-testid="wizard-step-2-skip"
        >
          Skip for now
        </Button>
      </div>

      {!snapshot.associationId && (
        <p className="text-xs text-destructive" role="alert">
          Finish Step 1 (community details) before linking a bank account.
        </p>
      )}
    </div>
  );
}
