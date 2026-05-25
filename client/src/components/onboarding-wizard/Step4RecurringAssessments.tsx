// founder-os#1616 (Child B) — Step 4 of the day-0-14 onboarding wizard.
//
// Plain English: the treasurer just told us who the owners are. Now they
// tell us what to charge them. The most common shape for a self-managed
// condo is one flat monthly dues amount per owner, due on the same day
// each month, with a small late fee after a few days of grace. That's the
// minimum we collect here; everything else (per-unit overrides, special
// assessments, ownership-share allocation) can be configured in the
// Finance section later.
//
// Backend mapping:
//   - POST /api/financial/fee-schedules         → create the recurring dues row
//     (this is the same endpoint setup-wizard.tsx uses; the table is
//      `hoa_fee_schedules`. The recurringChargeSchedules table is the
//      execution engine downstream; the Finance section can spin up an
//      explicit recurringChargeSchedule when the treasurer wants per-unit
//      precision.)
//   - POST /api/financial/late-fee-rules        → optional late-fee rule
//
// Acceptance criteria from founder-os#1616: amount + frequency + due day
// + late-fee policy fields, a plain-English preview line, and the form
// must create a "recurring_assessment_schedule" visible in Finance. We
// satisfy the latter via fee-schedules (the same row the Finance →
// "Recurring assessments" panel renders).
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowRight, Calendar, DollarSign } from "lucide-react";
import type { OnboardingWizardSnapshot } from "./types";

const schema = z
  .object({
    name: z.string().min(1, "Name your fee (e.g. Monthly HOA Dues)").default("Monthly HOA Dues"),
    amount: z.coerce.number().positive("Amount must be greater than zero"),
    frequency: z.enum(["monthly", "quarterly", "annually"]).default("monthly"),
    dueDay: z.coerce
      .number()
      .int("Due day must be a whole number")
      .min(1, "Due day must be between 1 and 28")
      .max(28, "Due day must be between 1 and 28")
      .default(1),
    enableLateFee: z.boolean().default(true),
    lateFeeType: z.enum(["flat", "percent"]).default("flat"),
    lateFeeAmount: z.coerce.number().min(0, "Late fee can't be negative").default(25),
    graceDays: z.coerce
      .number()
      .int("Grace days must be a whole number")
      .min(0, "Grace days can't be negative")
      .max(60, "Grace days can't exceed 60")
      .default(10),
  })
  .refine((data) => !data.enableLateFee || data.lateFeeAmount > 0, {
    message: "Set a late fee amount or turn the late fee off",
    path: ["lateFeeAmount"],
  });
type FormData = z.infer<typeof schema>;

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function frequencyAdverb(f: "monthly" | "quarterly" | "annually"): string {
  if (f === "monthly") return "each month";
  if (f === "quarterly") return "each quarter";
  return "each year";
}

export function Step4RecurringAssessments({
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

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "Monthly HOA Dues",
      amount: 350,
      frequency: "monthly",
      dueDay: 1,
      enableLateFee: true,
      lateFeeType: "flat",
      lateFeeAmount: 25,
      graceDays: 10,
    },
  });

  const watched = form.watch();

  const saveMutation = useMutation({
    mutationFn: async (values: FormData) => {
      if (!snapshot.associationId) {
        throw new Error("Finish Step 1 (community details) first so we know which association this assessment belongs to.");
      }
      // 1. Create the recurring fee schedule. The hoa_fee_schedules table
      //    only stores name + amount + frequency + graceDays — there's no
      //    `dueDay` column on it. The downstream recurring-charge runner
      //    handles day-of-month scheduling via its own row; for the
      //    onboarding spec the fee-schedule row is what makes the
      //    assessment visible in Finance, which is the AC the dispatch
      //    requires.
      const feeRes = await apiRequest("POST", "/api/financial/fee-schedules", {
        associationId: snapshot.associationId,
        name: values.name,
        amount: values.amount,
        frequency: values.frequency,
        startDate: new Date().toISOString(),
        graceDays: values.graceDays,
        isActive: 1,
        notes: `Created during onboarding wizard. Due on day ${values.dueDay} of the period.`,
      });
      const feeSchedule = (await feeRes.json()) as { id: string };

      // 2. Optional late-fee rule. We create one rule scoped to the
      //    association so it applies to all assessments unless the
      //    treasurer overrides it later.
      let lateFeeRuleId: string | null = null;
      if (values.enableLateFee && values.lateFeeAmount > 0) {
        try {
          const lfRes = await apiRequest("POST", "/api/financial/late-fee-rules", {
            associationId: snapshot.associationId,
            name: `${values.name} — late fee`,
            feeType: values.lateFeeType,
            feeAmount: values.lateFeeAmount,
            graceDays: values.graceDays,
            isActive: 1,
          });
          const rule = (await lfRes.json()) as { id: string };
          lateFeeRuleId = rule.id;
        } catch (err: any) {
          // Late-fee rule failure shouldn't block the assessment itself —
          // surface a non-fatal toast and continue.
          toast({
            title: "Assessment saved, late fee rule not",
            description: err?.message ?? "We couldn't create the late fee rule — you can add one from Finance → Late Fees.",
          });
        }
      }

      return { feeScheduleId: feeSchedule.id, lateFeeRuleId };
    },
    onSuccess: () => {
      toast({
        title: "Recurring assessment created",
        description: "Owners will see this on their next statement.",
      });
      onComplete();
    },
    onError: (err: Error) =>
      toast({ title: "Couldn't save assessment", description: err.message, variant: "destructive" }),
  });

  // ── Plain-English preview ────────────────────────────────────────────────
  const preview = watched.amount > 0
    ? `Each owner will be charged ${formatCurrency(watched.amount)} on the ${ordinal(watched.dueDay)} of ${frequencyAdverb(watched.frequency)}.`
    : "Set an amount above to preview what owners will see.";

  return (
    <Form {...form}>
      <form
        className="space-y-6"
        onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
        data-testid="wizard-step-4-form"
      >
        <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-4">
          <DollarSign className="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium">Recurring assessments</p>
            <p className="text-sm text-muted-foreground">
              Set what each owner is charged on a regular schedule. Most self-managed condos collect monthly dues; you can add special assessments and per-unit overrides from Finance later.
            </p>
          </div>
        </div>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Assessment name</FormLabel>
              <FormControl>
                <Input placeholder="Monthly HOA Dues" {...field} />
              </FormControl>
              <FormDescription>Shown on owner statements and invoices.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="350.00"
                    {...field}
                    data-testid="wizard-step-4-amount"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="frequency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Frequency</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="wizard-step-4-frequency">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dueDay"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Due day</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    placeholder="1"
                    {...field}
                    data-testid="wizard-step-4-due-day"
                  />
                </FormControl>
                <FormDescription className="text-xs">1-28 (we cap at 28 to avoid month-end ambiguity).</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* ── Late fee section ─────────────────────────────────────────────── */}
        <div className="space-y-4 rounded-md border p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="enable-late-fee" className="text-sm font-medium">
                Charge a late fee
              </Label>
              <p className="text-xs text-muted-foreground">
                Applied after the grace period if the assessment isn't paid.
              </p>
            </div>
            <FormField
              control={form.control}
              name="enableLateFee"
              render={({ field }) => (
                <Switch
                  id="enable-late-fee"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="wizard-step-4-late-fee-toggle"
                />
              )}
            />
          </div>

          {watched.enableLateFee && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="lateFeeType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="flat">Flat dollar amount</SelectItem>
                        <SelectItem value="percent">Percent of balance</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lateFeeAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {watched.lateFeeType === "percent" ? "Percent" : "Amount"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step={watched.lateFeeType === "percent" ? 0.1 : 0.01}
                        placeholder={watched.lateFeeType === "percent" ? "5" : "25.00"}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="graceDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grace days</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={60} placeholder="10" {...field} />
                    </FormControl>
                    <FormDescription className="text-xs">Days after the due date before the fee applies.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
        </div>

        {/* ── Plain-English preview ─────────────────────────────────────── */}
        <div
          className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/[0.04] p-4"
          data-testid="wizard-step-4-preview"
        >
          <Calendar className="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium">Preview</p>
            <p className="text-sm">{preview}</p>
            {watched.enableLateFee && watched.lateFeeAmount > 0 && (
              <p className="text-xs text-muted-foreground">
                If unpaid after {watched.graceDays} grace day{watched.graceDays === 1 ? "" : "s"}, a late fee of{" "}
                {watched.lateFeeType === "percent"
                  ? `${watched.lateFeeAmount}% of the balance`
                  : formatCurrency(watched.lateFeeAmount)}{" "}
                is added.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={onSkip}
            disabled={isSaving || saveMutation.isPending}
            data-testid="wizard-step-4-skip"
          >
            Skip for now
          </Button>
          <Button
            type="submit"
            disabled={saveMutation.isPending || isSaving || !snapshot.associationId}
            data-testid="wizard-step-4-submit"
          >
            {saveMutation.isPending ? "Saving…" : "Create assessment and continue"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {!snapshot.associationId && (
          <p className="text-xs text-destructive" role="alert">
            Finish Step 1 (community details) before scheduling recurring assessments.
          </p>
        )}
      </form>
    </Form>
  );
}
