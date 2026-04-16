import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  useUserSettings,
  saveUserSettings,
  applyTheme,
  setAdminIdForSettings,
  DEFAULT_SETTINGS,
  NOTIFICATION_PREFERENCE_KEYS,
  type NotificationCategoryKey,
  type UserSettings,
} from "@/hooks/use-user-settings";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AdminNotificationPreferences } from "@shared/admin-notification-preferences";

type AuthSession = {
  authenticated: boolean;
  user?: { email?: string | null };
  admin?: { id: string; email: string; role: string } | null;
};

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Phoenix",
  "America/Puerto_Rico",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const NOTIFICATION_GROUPS: Array<{
  title: string;
  description: string;
  items: Array<{
    key: NotificationCategoryKey;
    label: string;
    description: string;
    tags: string[];
  }>;
}> = [
  {
    title: "Communications",
    description: "Broadcasts and content changes sent across the association.",
    items: [
      {
        key: "announcements",
        label: "Announcements",
        description: "Broadcast announcements, urgent notices, and communication blasts from the admin workspace.",
        tags: ["Email", "Push", "In-app"],
      },
      {
        key: "documents",
        label: "Documents",
        description: "New uploads, version changes, and owner-portal visibility updates for shared documents.",
        tags: ["Email", "In-app"],
      },
      {
        key: "associationContext",
        label: "Association context",
        description: "Onboarding milestones, submission updates, and context changes tied to an association record.",
        tags: ["Email", "In-app"],
      },
    ],
  },
  {
    title: "Governance",
    description: "Board, meeting, and policy-related events that often require follow-up.",
    items: [
      {
        key: "meetings",
        label: "Meetings",
        description: "Meeting scheduling, agenda readiness, and attendance-related alerts.",
        tags: ["Email", "Push", "In-app"],
      },
      {
        key: "boardPackages",
        label: "Board packages",
        description: "Board packet publication, revisions, and distribution readiness notices.",
        tags: ["Email", "In-app"],
      },
      {
        key: "compliance",
        label: "Compliance",
        description: "Governance compliance reminders, filing due dates, and status changes.",
        tags: ["Email", "Push"],
      },
      {
        key: "elections",
        label: "Elections",
        description: "Nomination windows, vote activity, and election status notifications.",
        tags: ["Email", "Push", "In-app"],
      },
    ],
  },
  {
    title: "Financial",
    description: "Billing, collections, and exception handling across the accounting workflows.",
    items: [
      {
        key: "assessments",
        label: "Assessments",
        description: "Assessment publication, due-date reminders, and balance-impacting updates.",
        tags: ["Email", "In-app"],
      },
      {
        key: "invoices",
        label: "Invoices",
        description: "Invoice creation, posting, settlement, and payment follow-up events.",
        tags: ["Email", "Push", "In-app"],
      },
      {
        key: "payments",
        label: "Payments",
        description: "Payment confirmations, failures, retries, and gateway exceptions.",
        tags: ["Email", "Push"],
      },
      {
        key: "lateFees",
        label: "Late fees",
        description: "Late fee assessment, waiver, recovery, and collections-related notices.",
        tags: ["Email", "In-app"],
      },
      {
        key: "reconciliation",
        label: "Reconciliation",
        description: "Ledger mismatches, unreconciled activity, and close-process exception alerts.",
        tags: ["Email", "Push"],
      },
    ],
  },
  {
    title: "Operations",
    description: "Day-to-day property lifecycle activity across service, safety, and residency.",
    items: [
      {
        key: "maintenance",
        label: "Maintenance",
        description: "Work-order updates, request routing, and service completion notifications.",
        tags: ["Email", "Push", "In-app"],
      },
      {
        key: "inspections",
        label: "Inspections",
        description: "Scheduled inspections, findings, due dates, and remediation tracking notices.",
        tags: ["Email", "Push"],
      },
      {
        key: "insurance",
        label: "Insurance",
        description: "Coverage renewals, claims activity, and policy milestone reminders.",
        tags: ["Email", "In-app"],
      },
      {
        key: "occupancy",
        label: "Occupancy",
        description: "Ownership, lease, and resident occupancy record changes requiring review.",
        tags: ["Email", "In-app"],
      },
    ],
  },
  {
    title: "Platform",
    description: "Administrative and environment-level changes inside the workspace.",
    items: [
      {
        key: "adminAccess",
        label: "Admin access",
        description: "Role changes, account activation updates, and administrative permission events.",
        tags: ["Email", "Push"],
      },
      {
        key: "platformOps",
        label: "Platform operations",
        description: "AI ingestion events, feature flag changes, executive updates, and critical system notices.",
        tags: ["Email", "Push", "In-app"],
      },
    ],
  },
];

function roleBadgeVariant(role: string) {
  if (role === "platform-admin") return "default" as const;
  if (role === "board-officer") return "secondary" as const;
  if (role === "assisted-board") return "secondary" as const;
  if (role === "pm-assistant") return "secondary" as const;
  return "outline" as const;
}

function roleLabel(role: string) {
  if (role === "platform-admin") return "Platform Admin";
  if (role === "board-officer") return "Board Officer";
  if (role === "assisted-board") return "Assisted Board";
  if (role === "pm-assistant") return "PM Assistant";
  if (role === "manager") return "Manager";
  return "Viewer";
}

export default function UserSettingsPage() {
  const { toast } = useToast();
  const currentSettings = useUserSettings();
  const [activeTab, setActiveTab] = useState("profile");
  const [notificationTab, setNotificationTab] = useState("delivery");

  const { data: authSession } = useQuery<AuthSession | null>({
    queryKey: ["/api/auth/me", "session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: savedNotificationPrefs } = useQuery<AdminNotificationPreferences>({
    queryKey: ["/api/admin/me/preferences"],
    queryFn: async () => {
      const res = await fetch("/api/admin/me/preferences", { credentials: "include" });
      if (res.status === 401) {
        throw new Error("Not authenticated");
      }
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: Boolean(authSession?.admin?.id),
  });

  // Sync admin id so the hook uses the right storage key
  useEffect(() => {
    if (authSession?.admin?.id) {
      setAdminIdForSettings(authSession.admin.id);
    }
  }, [authSession?.admin?.id]);

  // Local draft state for editing
  const [draft, setDraft] = useState<UserSettings>(currentSettings);
  const [dirty, setDirty] = useState(false);

  // Re-sync draft when external settings change (e.g. admin id resolves)
  useEffect(() => {
    if (!dirty) setDraft(currentSettings);
  }, [currentSettings, dirty]);

  useEffect(() => {
    if (!savedNotificationPrefs || dirty) return;
    setDraft((prev) => ({
      ...prev,
      emailNotifications: savedNotificationPrefs.emailNotifications,
      pushNotifications: savedNotificationPrefs.pushNotifications,
      desktopNotifications: savedNotificationPrefs.desktopNotifications,
      alertDigest: savedNotificationPrefs.alertDigest,
      quietHoursEnabled: savedNotificationPrefs.quietHoursEnabled,
      quietHoursStart: savedNotificationPrefs.quietHoursStart,
      quietHoursEnd: savedNotificationPrefs.quietHoursEnd,
      notificationCategoryPreferences: savedNotificationPrefs.notificationCategoryPreferences,
    }));
  }, [savedNotificationPrefs, dirty]);

  const savePrefsMutation = useMutation({
    mutationFn: async (prefs: AdminNotificationPreferences) => {
      const res = await apiRequest("PUT", "/api/admin/me/preferences", prefs);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/me/preferences"] });
    },
  });

  function update<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function updateNotificationPreference(key: NotificationCategoryKey, enabled: boolean) {
    setDraft((prev) => ({
      ...prev,
      notificationCategoryPreferences: {
        ...prev.notificationCategoryPreferences,
        [key]: enabled,
      },
    }));
    setDirty(true);
  }

  async function handleSave() {
    // Persist to localStorage via the shared store
    saveUserSettings(draft);

    // Apply theme immediately
    applyTheme(draft.theme);

    try {
      if (authSession?.admin?.id) {
        await savePrefsMutation.mutateAsync({
          emailNotifications: draft.emailNotifications,
          pushNotifications: draft.pushNotifications,
          desktopNotifications: draft.desktopNotifications,
          alertDigest: draft.alertDigest,
          quietHoursEnabled: draft.quietHoursEnabled,
          quietHoursStart: draft.quietHoursStart,
          quietHoursEnd: draft.quietHoursEnd,
          notificationCategoryPreferences: draft.notificationCategoryPreferences,
        });
      }

      setDirty(false);
      toast({ title: "Settings saved" });
    } catch (error) {
      toast({
        title: "Settings not saved",
        description: error instanceof Error ? error.message : "An error occurred while saving your settings.",
        variant: "destructive",
      });
    }
  }

  function handleReset() {
    setDraft({ ...DEFAULT_SETTINGS });
    setDirty(true);
  }

  function enableAllNotificationCategories(enabled: boolean) {
    setDraft((prev) => ({
      ...prev,
      notificationCategoryPreferences: Object.fromEntries(
        NOTIFICATION_PREFERENCE_KEYS.map((key) => [key, enabled]),
      ) as UserSettings["notificationCategoryPreferences"],
    }));
    setDirty(true);
  }

  const email = authSession?.admin?.email ?? authSession?.user?.email ?? null;
  const role = authSession?.admin?.role ?? null;
  const enabledNotificationCount = Object.values(draft.notificationCategoryPreferences).filter(Boolean).length;
  const totalNotificationCount = NOTIFICATION_PREFERENCE_KEYS.length;

  return (
    <div className="min-h-full bg-surface-container-low">
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="font-headline text-3xl font-bold text-on-surface">Settings</h1>
          <p className="text-sm text-on-surface-variant mt-1">Manage your account preferences, workspace behavior, and notification coverage.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="overflow-x-auto">
            <TabsList className="inline-flex min-w-full sm:min-w-0">
              <TabsTrigger value="profile">Profile & Regional</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="appearance">Appearance</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Account</CardTitle>
                <CardDescription>Your account details. Contact a platform admin to change your role.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <p className="text-sm font-medium">{email ?? "—"}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Role</Label>
                    <div>{role ? <Badge variant={roleBadgeVariant(role)}>{roleLabel(role)}</Badge> : "—"}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Profile</CardTitle>
                <CardDescription>How you appear across the workspace.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    placeholder={email?.split("@")[0] ?? "Your name"}
                    value={draft.displayName}
                    onChange={(e) => update("displayName", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Shown in the header, activity feeds, and audit logs.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Regional</CardTitle>
                <CardDescription>Timezone and date formatting preferences.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Timezone</Label>
                    <Select value={draft.timezone} onValueChange={(v) => update("timezone", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz} value={tz}>{tz.replace(/_/g, " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date Format</Label>
                    <Select value={draft.dateFormat} onValueChange={(v) => update("dateFormat", v as UserSettings["dateFormat"])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card className="border-primary/20 bg-gradient-to-br from-surface to-primary/5">
              <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Notification center</Badge>
                    <Badge variant="outline">{enabledNotificationCount}/{totalNotificationCount} enabled</Badge>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-on-surface">Notification settings</h2>
                    <p className="text-sm text-on-surface-variant">Control delivery channels and review every notification surface currently represented in the platform.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => enableAllNotificationCategories(false)}>Mute All Categories</Button>
                  <Button variant="outline" onClick={() => enableAllNotificationCategories(true)}>Enable All Categories</Button>
                </div>
              </CardContent>
            </Card>

            <Tabs value={notificationTab} onValueChange={setNotificationTab} className="space-y-4">
              <div className="overflow-x-auto">
                <TabsList className="inline-flex min-w-full sm:min-w-0">
                  <TabsTrigger value="delivery">Delivery</TabsTrigger>
                  <TabsTrigger value="attention">Attention</TabsTrigger>
                  <TabsTrigger value="catalog">System Notifications</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="delivery" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Delivery channels</CardTitle>
                    <CardDescription>Set the primary channels used to reach you for admin workspace activity.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">Email notifications</p>
                        <p className="text-xs text-muted-foreground">Receive alerts and summaries via email.</p>
                      </div>
                      <Switch
                        checked={draft.emailNotifications}
                        onCheckedChange={(v) => update("emailNotifications", v)}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">Push notifications</p>
                        <p className="text-xs text-muted-foreground">Browser push notifications for critical alerts and time-sensitive events.</p>
                      </div>
                      <Switch
                        checked={draft.pushNotifications}
                        onCheckedChange={(v) => update("pushNotifications", v)}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">Desktop notification banners</p>
                        <p className="text-xs text-muted-foreground">Prefer on-screen banners when you are actively using the workspace.</p>
                      </div>
                      <Switch
                        checked={draft.desktopNotifications}
                        onCheckedChange={(v) => update("desktopNotifications", v)}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">Alert digest frequency</p>
                        <p className="text-xs text-muted-foreground">How often non-critical updates should be bundled.</p>
                      </div>
                      <Select value={draft.alertDigest} onValueChange={(v) => update("alertDigest", v as UserSettings["alertDigest"])}>
                        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="realtime">Real-time</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="off">Off</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="attention" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Attention management</CardTitle>
                    <CardDescription>Reduce interruption during off-hours while keeping urgent categories visible.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">Quiet hours</p>
                        <p className="text-xs text-muted-foreground">Suppress non-urgent banners and pushes during your preferred off-hours.</p>
                      </div>
                      <Switch
                        checked={draft.quietHoursEnabled}
                        onCheckedChange={(v) => update("quietHoursEnabled", v)}
                      />
                    </div>
                    <Separator />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="quietHoursStart">Quiet hours start</Label>
                        <Input
                          id="quietHoursStart"
                          type="time"
                          value={draft.quietHoursStart}
                          onChange={(e) => update("quietHoursStart", e.target.value)}
                          disabled={!draft.quietHoursEnabled}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="quietHoursEnd">Quiet hours end</Label>
                        <Input
                          id="quietHoursEnd"
                          type="time"
                          value={draft.quietHoursEnd}
                          onChange={(e) => update("quietHoursEnd", e.target.value)}
                          disabled={!draft.quietHoursEnabled}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Quiet hours currently affect local workspace behavior for this browser profile. Delivery-channel defaults still save to your account.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="catalog" className="space-y-6">
                {NOTIFICATION_GROUPS.map((group) => (
                  <Card key={group.title}>
                    <CardHeader>
                      <CardTitle className="text-lg">{group.title}</CardTitle>
                      <CardDescription>{group.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {group.items.map((item, index) => (
                        <div key={item.key}>
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium">{item.label}</p>
                                {item.tags.map((tag) => (
                                  <Badge key={tag} variant="outline">{tag}</Badge>
                                ))}
                              </div>
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground">
                                {draft.notificationCategoryPreferences[item.key] ? "Enabled" : "Muted"}
                              </span>
                              <Switch
                                checked={draft.notificationCategoryPreferences[item.key]}
                                onCheckedChange={(v) => updateNotificationPreference(item.key, v)}
                              />
                            </div>
                          </div>
                          {index < group.items.length - 1 ? <Separator className="mt-4" /> : null}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Appearance</CardTitle>
                <CardDescription>Theme and display preferences.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Theme</p>
                    <p className="text-xs text-muted-foreground">Choose light, dark, or match your system.</p>
                  </div>
                  <Select value={draft.theme} onValueChange={(v) => update("theme", v as UserSettings["theme"])}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system">System</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between pt-2 pb-8">
          <Button variant="outline" onClick={handleReset}>Reset to Defaults</Button>
          <Button onClick={handleSave} disabled={!dirty}>
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
