/**
 * Client-side Web Push notification helpers.
 *
 * Usage:
 *   const key = await getVapidPublicKey();
 *   if (key) await subscribeToPush(key, portalFetch);
 */

/**
 * Convert a URL-safe base64 string (VAPID public key) to a Uint8Array
 * suitable for use as applicationServerKey.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * Request browser notification permission.
 * Returns true if granted, false otherwise.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

/**
 * Register the service worker (if not already registered), subscribe to push,
 * and POST the subscription to the server.
 *
 * @param vapidPublicKey  URL-safe base64 VAPID public key from /api/portal/push/vapid-public-key
 * @param portalFetch     Authenticated fetch wrapper (includes portal-access-id header)
 */
export async function subscribeToPush(
  vapidPublicKey: string,
  portalFetch: (url: string, opts?: RequestInit) => Promise<Response>,
): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;

  await navigator.serviceWorker.register("/sw.js");
  const reg = await navigator.serviceWorker.ready;

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  const subJson = subscription.toJSON();
  await portalFetch("/api/portal/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subJson.endpoint, keys: subJson.keys }),
  });

  return subscription;
}

/**
 * Unsubscribe from push notifications and notify the server.
 *
 * @param portalFetch  Authenticated fetch wrapper
 */
export async function unsubscribeFromPush(
  portalFetch: (url: string, opts?: RequestInit) => Promise<Response>,
): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

  const reg = await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  await portalFetch("/api/portal/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
}

/**
 * Check whether the browser currently has an active push subscription.
 */
export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/** True if the browser supports push notifications at all. */
export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}
