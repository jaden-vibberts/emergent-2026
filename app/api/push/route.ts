import { createHash } from "node:crypto";
import { getSupabase } from "@/lib/supabase";
import { pushSettings } from "@/lib/push";
import { validateSubscription, type BrowserSubscription } from "@/lib/pushValidation";
export const runtime = "nodejs";
export async function POST(request: Request) {
  // Browsers call this on the same origin. No device key belongs in browser code.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Use this website to enable notifications." }, { status: 403 });
  if (!pushSettings()) return Response.json({ error: "Notifications are not configured yet. Add the three VAPID variables and redeploy." }, { status: 503 });
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 8192) return Response.json({ error: "Subscription is too large." }, { status: 413 });
    body = JSON.parse(raw);
  } catch { return Response.json({ error: "Send valid JSON." }, { status: 400 }); }
  if (!body || typeof body.device !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(body.device)) return Response.json({ error: "Invalid device ID." }, { status: 400 });
  const invalid = validateSubscription(body.subscription);
  if (invalid) return Response.json({ error: invalid }, { status: 400 });
  const sub = body.subscription as BrowserSubscription;
  try {
    const { data, error } = await getSupabase().rpc("register_machine_push", {
      p_machine_id: body.device, p_endpoint_hash: createHash("sha256").update(sub.endpoint).digest("hex"),
      p_subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
    });
    if (error) throw error;
    if (data === "unknown_device") return Response.json({ error: `Unknown machine: ${body.device}` }, { status: 404 });
    return Response.json({ status: data, message: data === "pending" ? "You’ll be notified the next time this machine finishes. Tap again for a later load." : "A notification for this machine is already being delivered." });
  } catch {
    console.error("Push subscription save failed: check database settings and step4.sql");
    return Response.json({ error: "Could not save notification. Check step4.sql and try again." }, { status: 503 });
  }
}
