// 4.1 Tier 3 (Wave 32) — Critical alert delivery preferences.
//
// Two switches (email + push) gating out-of-band fan-out for
// severity:'critical' alerts. The push toggle wraps the browser
// permission + service-worker subscription flow; the email toggle is a
// pure boolean.
//
// Defaults: email ON, push OFF (push requires explicit subscription
// enrollment via Notification.requestPermission()).
//
// Spec: docs/projects/platform-overhaul/decisions/4.1-tier-3-notifications.md

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

type CriticalAlertPrefs = { email: boolean; push: boolean };

const PREFS_KEY = ["/api/admin/notification-preferences"] as const;
const VAPID_KEY = ["/api/admin/push/vapid-public-key"] as const;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function CriticalAlertDeliveryCard() {
  const { toast } = useToast();
  const [pushBusy, setPushBusy] = useState(false);

  const { data: prefs, isLoading } = useQuery<CriticalAlertPrefs>({
    queryKey: PREFS_KEY,
    queryFn: async () => {
      const res = await fetch("/api/admin/notification-preferences", {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`prefs ${res.status}`);
      return res.json();
    },
  });

  const { data: vapid } = useQuery<{ configured: boolean; publicKey: string | null }>({
    queryKey: VAPID_KEY,
    queryFn: async () => {
      const res = await fetch("/api/admin/push/vapid-public-key", {
        credentials: "include",
      });
      if (!res.ok) return { configured: false, publicKey: null };
      return res.json();
    },
  });

  const patchPrefs = useMutation({
    mutationFn: async (patch: Partial<CriticalAlertPrefs>) => {
      const res = await apiRequest(
        "PATCH",
        "/api/admin/notification-preferences",
        patch,
      );
      return res.json() as Promise<CriticalAlertPrefs>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PREFS_KEY });
    },
    onError: (err) => {
      toast({
        title: "Could not update preferences",
        description: err instanceof Error ? err.message : "unknown",
        variant: "destructive",
      });
    },
  });

  async function enrollPush(): Promise<boolean> {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      toast({
        title: "Push not supported",
        description: "Your browser does not support web push.",
        variant: "destructive",
      });
      return false;
    }
    if (!vapid?.configured || !vapid.publicKey) {
      toast({
        title: "Push not configured",
        description: "VAPID keys are not configured on the server.",
        variant: "destructive",
      });
      return false;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      toast({
        title: "Push permission denied",
        description: "Browser permission was not granted.",
        variant: "destructive",
      });
      return false;
    }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
    });
    const json = sub.toJSON() as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      toast({
        title: "Push enrollment failed",
        description: "Browser returned an incomplete subscription.",
        variant: "destructive",
      });
      return false;
    }
    const r = await apiRequest("POST", "/api/admin/push/subscribe", {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    });
    if (!r.ok) {
      toast({
        title: "Push enrollment failed",
        description: `Server returned ${r.status}`,
        variant: "destructive",
      });
      return false;
    }
    return true;
  }

  async function unenrollPush(): Promise<void> {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await apiRequest("DELETE", "/api/admin/push/subscribe", {
        endpoint: sub.endpoint,
      });
      // Best-effort browser-side unsubscribe.
      try {
        await sub.unsubscribe();
      } catch {
        // ignore
      }
    }
  }

  async function onTogglePush(next: boolean) {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (next) {
        const ok = await enrollPush();
        if (!ok) return;
        await patchPrefs.mutateAsync({ push: true });
        toast({ title: "Push notifications enabled" });
      } else {
        await unenrollPush();
        await patchPrefs.mutateAsync({ push: false });
        toast({ title: "Push notifications disabled" });
      }
    } catch (err) {
      toast({
        title: "Push toggle failed",
        description: err instanceof Error ? err.message : "unknown",
        variant: "destructive",
      });
    } finally {
      setPushBusy(false);
    }
  }

  function onToggleEmail(next: boolean) {
    patchPrefs.mutate(
      { email: next },
      {
        onSuccess: () => {
          toast({
            title: next
              ? "Email alerts enabled"
              : "Email alerts disabled",
          });
        },
      },
    );
  }

  const emailChecked = prefs?.email ?? true;
  const pushChecked = prefs?.push ?? false;

  return (
    <Card data-testid="critical-alert-delivery-card">
      <CardHeader>
        <CardTitle className="text-lg">Critical alert delivery</CardTitle>
        <CardDescription>
          Out-of-band channels for severity {`"`}critical{`"`} alerts. These
          fire even when you{`'`}re not actively using YCM. Email is enabled by
          default; push requires browser permission.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Email for critical alerts</p>
            <p className="text-xs text-muted-foreground">
              Receive an email at your admin address whenever a critical
              alert is generated.
            </p>
          </div>
          <Switch
            checked={emailChecked}
            disabled={isLoading || patchPrefs.isPending}
            onCheckedChange={onToggleEmail}
            data-testid="toggle-critical-email"
          />
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Push for critical alerts</p>
            <p className="text-xs text-muted-foreground">
              Browser push notifications. Requires browser permission and a
              configured VAPID key on the server.
            </p>
          </div>
          <Switch
            checked={pushChecked}
            disabled={isLoading || pushBusy || patchPrefs.isPending}
            onCheckedChange={onTogglePush}
            data-testid="toggle-critical-push"
          />
        </div>
      </CardContent>
    </Card>
  );
}
