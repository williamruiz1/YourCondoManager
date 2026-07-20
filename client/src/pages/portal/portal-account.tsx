// zone: Account
// persona: Owner
//
// Owner self-service continuity surface. Keeps contact preferences, occupancy,
// SMS consent, and privacy records reachable from the redesigned portal.

import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Building2, CheckCircle2, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  getCurrentPushSubscription,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-notifications";
import { PortalShell, usePortalContext } from "./portal-shell";
import "@/styles/portal-redesign.css";

type OwnerUnit = {
  unitId: string;
  unitNumber: string | null;
  building: string | null;
  occupants: Array<{
    personId: string;
    firstName: string;
    lastName: string;
    email: string | null;
    occupancyType: string;
  }>;
};

type OccupancyDraft = {
  occupancyType: "OWNER_OCCUPIED" | "TENANT";
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

const emptyOccupancy: OccupancyDraft = {
  occupancyType: "OWNER_OCCUPIED",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
};

function AccountContent() {
  const { session, portalFetch } = usePortalContext();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [profile, setProfile] = useState({
    phone: "",
    mailingAddress: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    contactPreference: "email",
  });
  const [occupancyByUnit, setOccupancyByUnit] = useState<Record<string, OccupancyDraft>>({});
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    setProfile({
      phone: session.phone ?? "",
      mailingAddress: session.mailingAddress ?? "",
      emergencyContactName: session.emergencyContactName ?? "",
      emergencyContactPhone: session.emergencyContactPhone ?? "",
      contactPreference: session.contactPreference ?? "email",
    });
  }, [session]);

  useEffect(() => {
    getCurrentPushSubscription()
      .then((subscription) => setPushEnabled(Boolean(subscription)))
      .catch(() => setPushEnabled(false));
  }, []);

  const { data: units = [], isLoading: unitsLoading } = useQuery<OwnerUnit[]>({
    queryKey: ["portal/my-units", session.id],
    queryFn: async () => {
      const res = await portalFetch("/api/portal/my-units");
      if (!res.ok) throw new Error("Failed to load units");
      return res.json();
    },
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      const res = await portalFetch("/api/portal/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal/me"] });
      toast({ title: "Profile updated", description: "Your current contact details were saved." });
    },
    onError: (error: Error) => toast({ title: "Profile update failed", description: error.message, variant: "destructive" }),
  });

  const setSmsOptIn = useMutation({
    mutationFn: async (smsOptIn: boolean) => {
      const res = await portalFetch("/api/portal/me/sms-opt-in", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ smsOptIn }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ smsOptIn: boolean }>;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["portal/me"] });
      toast({
        title: data.smsOptIn ? "Text notifications enabled" : "Text notifications disabled",
        description: data.smsOptIn ? "You can reply STOP at any time." : "We recorded your opt-out.",
      });
    },
    onError: (error: Error) => toast({ title: "Preference update failed", description: error.message, variant: "destructive" }),
  });

  const saveOccupancy = useMutation({
    mutationFn: async ({ unitId, draft }: { unitId: string; draft: OccupancyDraft }) => {
      const body = draft.occupancyType === "OWNER_OCCUPIED"
        ? { unitId, occupancyType: draft.occupancyType }
        : {
            unitId,
            occupancyType: draft.occupancyType,
            tenant: {
              firstName: draft.firstName,
              lastName: draft.lastName,
              email: draft.email,
              phone: draft.phone,
            },
          };
      const res = await portalFetch("/api/portal/occupancy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal/my-units"] });
      toast({ title: "Occupancy recorded", description: "You and the association manager will receive confirmation." });
    },
    onError: (error: Error) => toast({ title: "Occupancy update failed", description: error.message, variant: "destructive" }),
  });

  const togglePush = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        throw new Error("This browser does not support push notifications.");
      }
      if (enabled) {
        const permitted = await requestNotificationPermission();
        if (!permitted) throw new Error("Browser notification permission was not granted.");
        const keyRes = await portalFetch("/api/portal/push/vapid-public-key");
        const key = await keyRes.json() as { configured: boolean; publicKey: string | null };
        if (!key.configured || !key.publicKey) throw new Error("Push notifications are not configured.");
        await subscribeToPush(key.publicKey, portalFetch);
      } else {
        await unsubscribeFromPush(portalFetch);
      }
      return enabled;
    },
    onSuccess: (enabled) => {
      setPushEnabled(enabled);
      toast({ title: enabled ? "Browser notifications enabled" : "Browser notifications disabled" });
    },
    onError: (error: Error) => toast({ title: "Notification update failed", description: error.message, variant: "destructive" }),
  });

  const draftFor = (unitId: string) => occupancyByUnit[unitId] ?? emptyOccupancy;
  const patchDraft = (unitId: string, patch: Partial<OccupancyDraft>) => {
    setOccupancyByUnit((current) => ({
      ...current,
      [unitId]: { ...draftFor(unitId), ...patch },
    }));
  };

  return (
    <div className="pfx-scope mx-auto flex max-w-5xl flex-col gap-6" data-testid="portal-account">
      <div className="pfx-pagehead">
        <p className="pfx-eyebrow">Your account</p>
        <h1>Profile &amp; preferences</h1>
        <p className="pfx-lede">Keep your contact, occupancy, privacy, and notification settings current.</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="pfx-tabstrip">
          <TabsTrigger className="pfx-tab" value="profile">Profile</TabsTrigger>
          <TabsTrigger className="pfx-tab" value="occupancy">Occupancy</TabsTrigger>
          <TabsTrigger className="pfx-tab" value="notifications">Notifications</TabsTrigger>
          <TabsTrigger className="pfx-tab" value="privacy">Privacy</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><UserRound className="h-5 w-5" /> Contact details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="account-phone">Phone</Label>
                <Input id="account-phone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-preference">Preferred contact method</Label>
                <select
                  id="account-preference"
                  className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                  value={profile.contactPreference}
                  onChange={(e) => setProfile({ ...profile, contactPreference: e.target.value })}
                >
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="sms">Text message</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="account-address">Mailing address</Label>
                <Input id="account-address" value={profile.mailingAddress} onChange={(e) => setProfile({ ...profile, mailingAddress: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-emergency-name">Emergency contact</Label>
                <Input id="account-emergency-name" value={profile.emergencyContactName} onChange={(e) => setProfile({ ...profile, emergencyContactName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-emergency-phone">Emergency phone</Label>
                <Input id="account-emergency-phone" value={profile.emergencyContactPhone} onChange={(e) => setProfile({ ...profile, emergencyContactPhone: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
                  {saveProfile.isPending ? "Saving…" : "Save profile"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="occupancy" className="mt-4 space-y-4">
          {unitsLoading ? <p role="status">Loading units…</p> : null}
          {units.map((unit) => {
            const draft = draftFor(unit.unitId);
            const label = [unit.building, unit.unitNumber].filter(Boolean).join("-") || "Unit";
            return (
              <Card key={unit.unitId}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> {label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {unit.occupants.length > 0 ? (
                    <div className="rounded-lg border bg-white p-3 text-sm">
                      <p className="font-semibold">Current occupants</p>
                      {unit.occupants.map((occupant) => (
                        <p key={occupant.personId} className="mt-1 text-on-surface-variant">
                          {occupant.firstName} {occupant.lastName} · {occupant.occupancyType.replaceAll("_", " ").toLowerCase()}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`occupancy-${unit.unitId}`}>Occupancy</Label>
                      <select
                        id={`occupancy-${unit.unitId}`}
                        className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                        value={draft.occupancyType}
                        onChange={(e) => patchDraft(unit.unitId, { occupancyType: e.target.value as OccupancyDraft["occupancyType"] })}
                      >
                        <option value="OWNER_OCCUPIED">Owner occupied</option>
                        <option value="TENANT">Tenant occupied</option>
                      </select>
                    </div>
                    {draft.occupancyType === "TENANT" ? (
                      <>
                        <div className="space-y-2"><Label>Tenant first name</Label><Input value={draft.firstName} onChange={(e) => patchDraft(unit.unitId, { firstName: e.target.value })} /></div>
                        <div className="space-y-2"><Label>Tenant last name</Label><Input value={draft.lastName} onChange={(e) => patchDraft(unit.unitId, { lastName: e.target.value })} /></div>
                        <div className="space-y-2"><Label>Tenant email</Label><Input type="email" value={draft.email} onChange={(e) => patchDraft(unit.unitId, { email: e.target.value })} /></div>
                        <div className="space-y-2"><Label>Tenant phone</Label><Input value={draft.phone} onChange={(e) => patchDraft(unit.unitId, { phone: e.target.value })} /></div>
                      </>
                    ) : null}
                  </div>
                  <Button onClick={() => saveOccupancy.mutate({ unitId: unit.unitId, draft })} disabled={saveOccupancy.isPending}>
                    Record occupancy
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Text messages</CardTitle></CardHeader>
              <CardContent className="flex items-center justify-between gap-4">
                <div><p className="font-medium">SMS notifications</p><p className="text-sm text-on-surface-variant">Carrier rates may apply. Reply STOP at any time.</p></div>
                <Switch checked={Boolean(session.smsOptIn)} onCheckedChange={(checked) => setSmsOptIn.mutate(checked)} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Browser alerts</CardTitle></CardHeader>
              <CardContent className="flex items-center justify-between gap-4">
                <div><p className="font-medium">Push notifications</p><p className="text-sm text-on-surface-variant">Receive supported portal alerts on this browser.</p></div>
                <Switch checked={pushEnabled} onCheckedChange={(checked) => togglePush.mutate(checked)} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="privacy" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Privacy records</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-on-surface-variant">Review the policy versions and timestamps recorded for your account.</p>
              <Button asChild variant="outline"><Link href="/portal/privacy/my-consents"><CheckCircle2 className="mr-2 h-4 w-4" /> View my consent history</Link></Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function PortalAccountPage() {
  useDocumentTitle("Profile & preferences");
  return <PortalShell><AccountContent /></PortalShell>;
}
