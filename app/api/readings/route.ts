import { createHash, timingSafeEqual } from "node:crypto";
import { getSupabase } from "@/lib/supabase";
import { nextState, type MachineState } from "@/lib/stateMachine";
import { MACHINE_CONFIG } from "@/lib/machine-config";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.DEVICE_INGEST_KEY;
  if (!secret) return Response.json({ error: "Server is missing DEVICE_INGEST_KEY." }, { status: 503 });
  const supplied = request.headers.get("x-device-key") ?? "";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!supplied || !timingSafeEqual(digest(secret), digest(supplied))) {
    return Response.json({ error: "Invalid device key." }, { status: 401 });
  }
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Send valid JSON." }, { status: 400 }); }
  if (!body || typeof body.device !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(body.device) ||
      typeof body.rms !== "number" || !Number.isFinite(body.rms) || body.rms < 0 ||
      typeof body.door_open !== "boolean") {
    return Response.json({ error: "Expected device, nonnegative finite rms, and boolean door_open." }, { status: 400 });
  }
  try {
    const db = getSupabase();
    if (request.headers.get("x-demo-data") === "true") {
      const { data: machine, error } = await db.from("machines").select("name, location").eq("id", body.device).maybeSingle();
      if (error) throw error;
      if (!machine || !machine.name.includes("(demo)") || !machine.location.toLowerCase().includes("demo")) {
        return Response.json({ error: "Simulator requires a machine with demo labels in its name and location." }, { status: 400 });
      }
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await db.from("machine_state").select("*").eq("machine_id", body.device).maybeSingle();
      if (error) throw error;
      if (!data) return Response.json({ error: "Unknown machine or missing machine_state row." }, { status: 404 });
      const current = data as MachineState;
      if (!Number.isInteger(current.revision)) throw new Error("Run step2.sql");
      // Timestamp on the server, after reading the current row. Preserve monotonic order.
      const at = new Date(Math.max(Date.now(), current.last_seen ? Date.parse(current.last_seen) + 1 : 0)).toISOString();
      const next = nextState(current, { rms: body.rms, door_open: body.door_open, at });
      const { data: saved, error: saveError } = await db.rpc("save_machine_reading", {
        p_machine_id: body.device, p_expected_revision: current.revision, p_next: next,
      });
      if (saveError) throw saveError;
      if (saved) return Response.json({ machine: body.device, state: next.state, state_since: next.state_since, time_scale: MACHINE_CONFIG.TIME_SCALE });
      // Another request won the race. Re-read and recompute; no partial writes occurred.
    }
    return Response.json({ error: "Machine is busy. Send the next reading." }, { status: 409 });
  } catch (error) {
    // Never log request headers, environment values, or database error messages.
    console.error("Ingest failed", { code: typeof error === "object" && error && "code" in error ? error.code : "configuration" });
    return Response.json({ error: "Database update failed. Check server settings and run supabase/step2.sql." }, { status: 503 });
  }
}
