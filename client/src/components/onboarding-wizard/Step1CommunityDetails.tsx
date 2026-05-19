// #1327 — Step 1: confirm/edit the community's legal name and address.
// On first load the form is empty (no association yet); on submit it
// creates the association via POST /api/associations and binds it to the
// wizard via POST /api/onboarding/wizard/association. Once the association
// exists the form pre-populates and submits a PATCH-via-POST update.
import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight } from "lucide-react";
import type { OnboardingWizardSnapshot } from "./types";

const schema = z.object({
  name: z.string().min(1, "Community name is required"),
  associationType: z.enum(["condo", "hoa", "co-op", "townhome"]).default("condo"),
  address: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(2, "State is required").max(2, "Use the 2-letter state code"),
});
type FormData = z.infer<typeof schema>;

type AssociationRow = {
  id: string;
  name: string;
  associationType: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
};

export function Step1CommunityDetails({
  snapshot,
  onComplete,
  isSaving,
  onSnapshotUpdate,
}: {
  snapshot: OnboardingWizardSnapshot;
  onComplete: () => void;
  isSaving: boolean;
  onSnapshotUpdate: (snapshot: OnboardingWizardSnapshot) => void;
}) {
  const { toast } = useToast();
  const associationId = snapshot.associationId;

  const associationQuery = useQuery<AssociationRow | null>({
    queryKey: ["/api/onboarding/wizard/association-row", associationId],
    enabled: Boolean(associationId),
    queryFn: async () => {
      if (!associationId) return null;
      const res = await fetch(`/api/associations`, { credentials: "include" });
      if (!res.ok) return null;
      const list = (await res.json()) as AssociationRow[];
      return list.find((a) => a.id === associationId) ?? null;
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", associationType: "condo", address: "", city: "", state: "" },
  });

  // Hydrate the form once the association row resolves (resume-on-login).
  useEffect(() => {
    const row = associationQuery.data;
    if (!row) return;
    form.reset({
      name: row.name,
      associationType: (row.associationType as FormData["associationType"]) ?? "condo",
      address: row.address ?? "",
      city: row.city ?? "",
      state: row.state ?? "",
    });
  }, [associationQuery.data, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: FormData) => {
      let resolvedAssociationId = associationId;
      if (!resolvedAssociationId) {
        const createRes = await apiRequest("POST", "/api/associations", {
          name: values.name,
          associationType: values.associationType,
          address: values.address,
          city: values.city,
          state: values.state,
          country: "United States",
        });
        const created = (await createRes.json()) as { id: string };
        resolvedAssociationId = created.id;
        if (typeof window !== "undefined") {
          window.localStorage.setItem("activeAssociationId", resolvedAssociationId);
        }
      } else {
        // Update the existing row. /api/associations/:id PATCH or POST per
        // server conventions; routes.ts exposes POST handlers for update.
        await apiRequest("POST", `/api/associations/${resolvedAssociationId}`, {
          name: values.name,
          associationType: values.associationType,
          address: values.address,
          city: values.city,
          state: values.state,
        });
      }
      const bindRes = await apiRequest("POST", "/api/onboarding/wizard/association", {
        associationId: resolvedAssociationId,
      });
      return (await bindRes.json()) as OnboardingWizardSnapshot;
    },
    onSuccess: (next) => {
      onSnapshotUpdate(next);
      onComplete();
    },
    onError: (err: Error) => toast({ title: "Couldn't save community details", description: err.message, variant: "destructive" }),
  });

  return (
    <Form {...form}>
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
        data-testid="wizard-step-1-form"
      >
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Community name</FormLabel>
            <FormControl>
              <Input placeholder="Maple Heights Condo Association" autoComplete="organization" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="associationType" render={({ field }) => (
          <FormItem>
            <FormLabel>Community type</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="condo">Condominium</SelectItem>
                <SelectItem value="hoa">HOA</SelectItem>
                <SelectItem value="co-op">Co-op</SelectItem>
                <SelectItem value="townhome">Townhome community</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="address" render={({ field }) => (
          <FormItem>
            <FormLabel>Street address</FormLabel>
            <FormControl>
              <Input placeholder="123 Main Street" autoComplete="street-address" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="city" render={({ field }) => (
            <FormItem>
              <FormLabel>City</FormLabel>
              <FormControl>
                <Input placeholder="Springfield" autoComplete="address-level2" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="state" render={({ field }) => (
            <FormItem>
              <FormLabel>State</FormLabel>
              <FormControl>
                <Input placeholder="IL" maxLength={2} autoComplete="address-level1" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <Button type="submit" className="w-full" disabled={saveMutation.isPending || isSaving} data-testid="wizard-step-1-submit">
          {saveMutation.isPending ? "Saving…" : "Save and continue"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </form>
    </Form>
  );
}
