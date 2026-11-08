import "server-only";
import * as webpush from "web-push";
import { getSupabase } from "./supabase";
import { validateSubscription, type BrowserSubscription } from "./pushValidation";
import { isOffline } from "./status";

export function pushSettings() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject || !/^(mailto:|https:\/\/)/.test(subject)) return null;
  return { publicKey, privateKey, subject };
}

// Durable database claims ensure concurrent serverless requests cannot send twice.
// Failed or uncertain sends are NOT retried automatically.
export async function deliverMachinePush(machineId: string, machineName: string) {
  try {
    const settings = pushSettings();
    if (!settings) {
      console.error("Push delivery unavailable: configure all three VAPID variables", { machineId });
      return;
    }
    const db = getSupabase();
    const machineIsOnline = async () => {
      const { data, error } = await db.from("machine_state").select("last_seen").eq("machine_id", machineId).maybeSingle();
      // Fail closed if freshness cannot be established.
      if (error) console.error("Push freshness check failed; not sending", { machineId, code: error.code });
      return !error && !!data && !isOffline(data.last_seen, Date.now());
    };
    if (!await machineIsOnline()) {
      console.info("Push deferred: machine offline or freshness unavailable", { machineId });
      return;
    }
    // One bounded batch per reading; later readings drain any remaining queued work.
    const { data: jobs, error } = await db.rpc("claim_machine_push", { p_machine_id: machineId });
    if (error) { console.error("Push queue claim failed: check step4.sql", { machineId, code: error.code }); return; }
    await Promise.all((jobs ?? []).map(async (job: { id: string; cycle_id: string; subscription_json: BrowserSubscription }) => {
      // Re-check immediately before sending in case claiming the queue was delayed.
      if (!await machineIsOnline()) {
        const { error: releaseError } = await db.from("push_subscriptions")
          .update({ delivery_status: "queued", claimed_at: null })
          .eq("id", job.id).eq("delivery_status", "sending");
        console.info("Push deferred before send: machine offline or freshness unavailable", { machineId, subscriptionId: job.id });
        if (releaseError) console.error("Unsent push claim could not be released", { subscriptionId: job.id, code: releaseError.code });
        return;
      }
      try {
        const invalid = validateSubscription(job.subscription_json);
        if (invalid) throw new Error(invalid);
        await webpush.sendNotification(job.subscription_json, JSON.stringify({
          title: `${machineName} is done`,
          body: /demo/i.test(machineName) ? "Demo notification: simulated cycle finished. Clothes probably inside." : "Your cycle has finished. Clothes are probably still inside.",
          url: `/m/${encodeURIComponent(machineId)}`, tag: `cycle-${job.cycle_id}-${job.id}`,
        }), { vapidDetails: settings, TTL: 3600, urgency: "high", timeout: 8000 });
      } catch (error) {
        const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : null;
        const message = status ? `Push service rejected delivery (HTTP ${status})` : "Push send failed or timed out; receipt is uncertain. Not retried to prevent duplicates.";
        console.error("Push delivery failed", { machineId, subscriptionId: job.id, status, message });
        const { error: updateError } = await db.from("push_subscriptions").update({ delivery_status: "failed", last_error: message })
          .eq("id", job.id).eq("delivery_status", "sending");
        if (updateError) console.error("Push failure could not be recorded", { subscriptionId: job.id, code: updateError.code });
        return;
      }
      const { error: updateError } = await db.from("push_subscriptions").update({ delivery_status: "sent", notified_at: new Date().toISOString(), last_error: null })
        .eq("id", job.id).eq("delivery_status", "sending");
      if (updateError) console.error("Push accepted but notified_at could not be saved; will not resend", { subscriptionId: job.id, code: updateError.code });
      else console.info("Push accepted by service", { machineId, subscriptionId: job.id });
    }));
  } catch {
    console.error("Push worker failed; inspect queued/sending rows in push_subscriptions", { machineId });
  }
}
