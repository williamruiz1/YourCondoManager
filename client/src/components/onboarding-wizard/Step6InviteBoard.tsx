// #1327 — Step 6: invite additional board members. Optional step; can be
// skipped. POSTs invites through the existing /api/onboarding/invites
// endpoint (board-officer admin invite is the right primitive for board
// directors at this point in onboarding).
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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, UserPlus, Check } from "lucide-react";
import type { OnboardingWizardSnapshot } from "./types";

const inviteSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email required"),
  role: z.enum(["president", "vice-president", "treasurer", "secretary", "board-member"]).default("treasurer"),
});
type InviteData = z.infer<typeof inviteSchema>;

export function Step6InviteBoard({
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
  const [invitesSent, setInvitesSent] = useState<string[]>([]);

  const form = useForm<InviteData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { firstName: "", lastName: "", email: "", role: "treasurer" },
  });

  const inviteMutation = useMutation({
    mutationFn: async (values: InviteData) => {
      if (!snapshot.associationId) {
        throw new Error("Finish Step 1 (community details) first so we know which board to invite to.");
      }
      // Create the person + board role pair using the same primitives the
      // existing setup-wizard uses for adding board members.
      const personRes = await apiRequest("POST", "/api/persons", {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        associationId: snapshot.associationId,
      });
      const person = (await personRes.json()) as { id: string };
      await apiRequest("POST", "/api/board-roles", {
        personId: person.id,
        associationId: snapshot.associationId,
        role: values.role,
        startDate: new Date().toISOString(),
      });
      return values.email;
    },
    onSuccess: (email) => {
      setInvitesSent((prev) => [...prev, email]);
      form.reset({ firstName: "", lastName: "", email: "", role: "treasurer" });
      toast({ title: "Invite sent", description: `${email} has been added to the board.` });
    },
    onError: (err: Error) => toast({ title: "Couldn't send invite", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Add the rest of your board now so they can log in, see financials, and approve actions.
        You can always invite more from <span className="font-medium">Board → Members</span> later.
      </p>

      <Form {...form}>
        <form
          className="space-y-4 rounded-md border border-dashed bg-muted/30 p-4"
          onSubmit={form.handleSubmit((values) => inviteMutation.mutate(values))}
          data-testid="wizard-step-6-form"
        >
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="firstName" render={({ field }) => (
              <FormItem>
                <FormLabel>First name</FormLabel>
                <FormControl>
                  <Input placeholder="Jane" autoComplete="given-name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="lastName" render={({ field }) => (
              <FormItem>
                <FormLabel>Last name</FormLabel>
                <FormControl>
                  <Input placeholder="Smith" autoComplete="family-name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="jane@example.com" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="role" render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="president">President</SelectItem>
                  <SelectItem value="vice-president">Vice president</SelectItem>
                  <SelectItem value="treasurer">Treasurer</SelectItem>
                  <SelectItem value="secretary">Secretary</SelectItem>
                  <SelectItem value="board-member">At-large board member</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <Button type="submit" variant="secondary" disabled={inviteMutation.isPending} data-testid="wizard-step-6-add-invite">
            <UserPlus className="mr-2 h-4 w-4" />
            {inviteMutation.isPending ? "Sending invite…" : "Add board member"}
          </Button>
        </form>
      </Form>

      {invitesSent.length > 0 && (
        <ul className="space-y-1 text-sm" data-testid="wizard-step-6-sent-list">
          {invitesSent.map((email) => (
            <li key={email} className="flex items-center gap-2 text-muted-foreground">
              <Check className="h-4 w-4 text-primary" />
              <span>{email}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onSkip} disabled={isSaving} data-testid="wizard-step-6-skip">
          Skip for now
        </Button>
        <Button
          type="button"
          onClick={onComplete}
          disabled={isSaving || invitesSent.length === 0}
          data-testid="wizard-step-6-continue"
        >
          {invitesSent.length === 0 ? "Add at least one to continue" : "Continue"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
