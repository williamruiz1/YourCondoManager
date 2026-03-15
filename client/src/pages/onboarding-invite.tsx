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
  latestSubmissionStatus?: "pending" | "approved" | "rejected" | null;
  latestSubmissionRejectionReason?: string | null;
};

export default function OnboardingInvitePage() {
  const [, params] = useRoute("/onboarding/:token");
  const token = params?.token || "";
  const createEmptyResident = () => ({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    ownershipPercentage: "",
  });
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
    occupancyIntent: "owner-occupied",
  });
  const [includeSecondOwner, setIncludeSecondOwner] = useState(false);
  const [secondOwner, setSecondOwner] = useState(createEmptyResident());
  const [tenantResidents, setTenantResidents] = useState([createEmptyResident()]);

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
          occupancyIntent: inviteQuery.data?.residentType === "owner" ? form.occupancyIntent : null,
          ownershipPercentage: inviteQuery.data?.residentType === "owner" ? Number(form.ownershipPercentage || "100") : null,
          additionalOwners: inviteQuery.data?.residentType === "owner" && includeSecondOwner && secondOwner.firstName.trim() && secondOwner.lastName.trim() && (secondOwner.email.trim() || secondOwner.phone.trim())
            ? [{
              firstName: secondOwner.firstName.trim(),
              lastName: secondOwner.lastName.trim(),
              email: secondOwner.email.trim() || null,
              phone: secondOwner.phone.trim() || null,
              ownershipPercentage: secondOwner.ownershipPercentage.trim() ? Number(secondOwner.ownershipPercentage) : null,
            }]
            : [],
          tenantResidents: inviteQuery.data?.residentType === "owner" && form.occupancyIntent === "rental"
            ? tenantResidents
              .filter((resident) => resident.firstName.trim() && resident.lastName.trim() && (resident.email.trim() || resident.phone.trim()))
              .map((resident) => ({
                firstName: resident.firstName.trim(),
                lastName: resident.lastName.trim(),
                email: resident.email.trim() || null,
                phone: resident.phone.trim() || null,
              }))
            : [],
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const invite = inviteQuery.data;
  const validTenantCount = tenantResidents.filter((resident) =>
    resident.firstName.trim() && resident.lastName.trim() && (resident.email.trim() || resident.phone.trim()),
  ).length;
  const ownerFormInvalid = invite?.residentType === "owner" && form.occupancyIntent === "rental" && validTenantCount === 0;

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
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">
                      This invite is no longer accepting submissions.
                    </div>
                    {invite.latestSubmissionStatus === "rejected" && invite.latestSubmissionRejectionReason ? (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        Change requested: {invite.latestSubmissionRejectionReason}
                      </div>
                    ) : null}
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
                    {invite.residentType === "owner" ? (
                      <div className="space-y-4 rounded-lg border bg-slate-50 p-4">
                        <div className="space-y-2">
                          <div className="text-sm font-medium">Occupancy</div>
                          <Select value={form.occupancyIntent} onValueChange={(value) => setForm((p) => ({ ...p, occupancyIntent: value }))}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select occupancy" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="owner-occupied">Owner occupied</SelectItem>
                              <SelectItem value="rental">Rental occupied</SelectItem>
                              <SelectItem value="vacant">Vacant</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="text-xs text-muted-foreground">
                            Choose whether the owner lives in the unit, tenants occupy it, or it is currently vacant.
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium">Second owner</div>
                              <div className="text-xs text-muted-foreground">Add a second owner if title is shared.</div>
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={() => setIncludeSecondOwner((current) => !current)}>
                              {includeSecondOwner ? "Remove second owner" : "Add second owner"}
                            </Button>
                          </div>
                          {includeSecondOwner ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-md border bg-white p-3">
                              <Input placeholder="Second owner first name" value={secondOwner.firstName} onChange={(e) => setSecondOwner((p) => ({ ...p, firstName: e.target.value }))} />
                              <Input placeholder="Second owner last name" value={secondOwner.lastName} onChange={(e) => setSecondOwner((p) => ({ ...p, lastName: e.target.value }))} />
                              <Input placeholder="Second owner email" value={secondOwner.email} onChange={(e) => setSecondOwner((p) => ({ ...p, email: e.target.value }))} />
                              <Input placeholder="Second owner phone" value={secondOwner.phone} onChange={(e) => setSecondOwner((p) => ({ ...p, phone: e.target.value }))} />
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                placeholder="Second owner ownership %"
                                value={secondOwner.ownershipPercentage}
                                onChange={(e) => setSecondOwner((p) => ({ ...p, ownershipPercentage: e.target.value }))}
                              />
                            </div>
                          ) : null}
                        </div>

                        {form.occupancyIntent === "rental" ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium">Tenant residents</div>
                                <div className="text-xs text-muted-foreground">Add each current tenant. Leave no partial rows.</div>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setTenantResidents((rows) => [...rows, createEmptyResident()])}
                              >
                                Add Tenant
                              </Button>
                            </div>
                            {tenantResidents.map((resident, index) => (
                              <div key={index} className="space-y-3 rounded-md border bg-white p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-sm font-medium">Tenant {index + 1}</div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setTenantResidents((rows) => rows.length === 1 ? [createEmptyResident()] : rows.filter((_, rowIndex) => rowIndex !== index))}
                                  >
                                    Remove Tenant
                                  </Button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <Input placeholder="Tenant first name" value={resident.firstName} onChange={(e) => setTenantResidents((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, firstName: e.target.value } : row))} />
                                  <Input placeholder="Tenant last name" value={resident.lastName} onChange={(e) => setTenantResidents((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, lastName: e.target.value } : row))} />
                                  <Input placeholder="Tenant email" value={resident.email} onChange={(e) => setTenantResidents((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, email: e.target.value } : row))} />
                                  <Input placeholder="Tenant phone" value={resident.phone} onChange={(e) => setTenantResidents((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, phone: e.target.value } : row))} />
                                </div>
                              </div>
                            ))}
                            <div className="text-xs text-muted-foreground">
                              At least one complete tenant entry is required for a rental submission.
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
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
                    {ownerFormInvalid ? (
                      <div className="text-sm text-destructive">Add at least one complete tenant entry for a rental submission.</div>
                    ) : null}
                    <Button
                      onClick={() => submitMutation.mutate()}
                      disabled={submitMutation.isPending || !form.firstName.trim() || !form.lastName.trim() || !form.startDate || ownerFormInvalid}
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
