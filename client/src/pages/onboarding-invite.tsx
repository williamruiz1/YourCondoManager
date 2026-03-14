import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type PublicInvite = {
  id: string;
  associationId: string;
  associationName?: string;
  unitId: string;
  unitLabel?: string;
  residentType: "owner" | "tenant";
  status: "active" | "submitted" | "approved" | "rejected" | "expired" | "revoked";
  email?: string | null;
  phone?: string | null;
  expiresAt?: string | null;
};

export default function OnboardingInvitePage() {
  const [, params] = useRoute("/onboarding/:token");
  const token = params?.token || "";
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    mailingAddress: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    contactPreference: "email",
    startDate: "",
    ownershipPercentage: "100",
  });

  const inviteQuery = useQuery<PublicInvite>({
    queryKey: [`/api/public/onboarding/invite/${token}`],
    enabled: Boolean(token),
    queryFn: async () => {
      const res = await fetch(`/api/public/onboarding/invite/${encodeURIComponent(token)}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/public/onboarding/invite/${encodeURIComponent(token)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          mailingAddress: form.mailingAddress.trim() || null,
          emergencyContactName: form.emergencyContactName.trim() || null,
          emergencyContactPhone: form.emergencyContactPhone.trim() || null,
          contactPreference: form.contactPreference,
          startDate: new Date(form.startDate).toISOString(),
          ownershipPercentage: inviteQuery.data?.residentType === "owner" ? Number(form.ownershipPercentage || "100") : null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const invite = inviteQuery.data;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Association Onboarding</h1>
          <p className="text-sm text-muted-foreground">Submit your unit-linked owner or tenant onboarding form.</p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            {inviteQuery.isLoading ? <div className="text-sm text-muted-foreground">Loading invite...</div> : null}
            {inviteQuery.isError ? <div className="text-sm text-destructive">{(inviteQuery.error as Error).message}</div> : null}

            {invite ? (
              <>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-lg font-semibold">{invite.associationName || "Association"}</div>
                    <div className="text-sm text-muted-foreground">
                      {invite.unitLabel ? `Unit ${invite.unitLabel}` : invite.unitId} · <span className="capitalize">{invite.residentType}</span> onboarding
                    </div>
                  </div>
                  <Badge variant={invite.status === "active" ? "secondary" : "outline"}>{invite.status}</Badge>
                </div>

                {invite.status !== "active" ? (
                  <div className="text-sm text-muted-foreground">
                    This invite is no longer accepting submissions.
                  </div>
                ) : submitMutation.isSuccess ? (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    Submission received. The association admin can now review and approve it.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input placeholder="First name" value={form.firstName} onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))} />
                      <Input placeholder="Last name" value={form.lastName} onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))} />
                      <Input placeholder="Email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                      <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
                      <Input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} />
                      {invite.residentType === "owner" ? (
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="Ownership %"
                          value={form.ownershipPercentage}
                          onChange={(e) => setForm((p) => ({ ...p, ownershipPercentage: e.target.value }))}
                        />
                      ) : null}
                    </div>
                    <Textarea placeholder="Mailing address" value={form.mailingAddress} onChange={(e) => setForm((p) => ({ ...p, mailingAddress: e.target.value }))} />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Input placeholder="Emergency contact name" value={form.emergencyContactName} onChange={(e) => setForm((p) => ({ ...p, emergencyContactName: e.target.value }))} />
                      <Input placeholder="Emergency contact phone" value={form.emergencyContactPhone} onChange={(e) => setForm((p) => ({ ...p, emergencyContactPhone: e.target.value }))} />
                      <Select value={form.contactPreference} onValueChange={(value) => setForm((p) => ({ ...p, contactPreference: value }))}>
                        <SelectTrigger><SelectValue placeholder="Contact preference" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="phone">Phone</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {submitMutation.isError ? (
                      <div className="text-sm text-destructive">{(submitMutation.error as Error).message}</div>
                    ) : null}
                    <Button
                      onClick={() => submitMutation.mutate()}
                      disabled={submitMutation.isPending || !form.firstName.trim() || !form.lastName.trim() || !form.startDate}
                    >
                      Submit Onboarding Form
                    </Button>
                  </div>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
