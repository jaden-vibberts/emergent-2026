export type BrowserSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };
export function validateSubscription(value: unknown): string | null {
  if (!value || typeof value !== "object") return "subscription must be an object";
  const sub = value as Partial<BrowserSubscription>;
  if (typeof sub.endpoint !== "string" || sub.endpoint.length > 1500) return "Invalid push endpoint";
  let url: URL;
  try { url = new URL(sub.endpoint); } catch { return "Invalid push endpoint"; }
  // Never let an anonymous subscription turn the sender into an arbitrary URL fetcher.
  const host = url.hostname;
  const allowed = host === "web.push.apple.com" || host.endsWith(".push.apple.com") ||
    host === "fcm.googleapis.com" || host === "updates.push.services.mozilla.com" ||
    host.endsWith(".notify.windows.com");
  if (url.protocol !== "https:" || url.port || url.username || url.password || url.hash || !allowed) return "Unsupported push service endpoint";
  if (!sub.keys || typeof sub.keys.p256dh !== "string" || !/^[A-Za-z0-9_-]{87}={0,1}$/.test(sub.keys.p256dh) ||
      typeof sub.keys.auth !== "string" || !/^[A-Za-z0-9_-]{22}={0,2}$/.test(sub.keys.auth)) return "Invalid push encryption keys";
  return null;
}
