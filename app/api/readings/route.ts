import { createHash, timingSafeEqual } from "node:crypto";
import { getSupabase } from "@/lib/supabase";
import { nextState, type MachineState } from "@/lib/stateMachine";
import { MACHINE_CONFIG } from "@/lib/machine-config";
import { validateReading, type DeviceReading } from "@/lib/validateReading";
import { after } from "next/server";
import { deliverMachinePush, pushSettings } from "@/lib/push";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.DEVICE_INGEST_KEY;
  if (!secret) return Response.json({ error: "Server is missing DEVICE_INGEST_KEY." }, { status: 503 });
  const supplied = request.headers.get("x-device-key") ?? "";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!supplied || !timingSafeEqual(digest(secret), digest(supplied))) {
    return Response.json({ error: "Invalid device key." }, { status: 401 });
  }
  let rawBody = "";
  const invalid = (message: string) => {
    // Authenticated validation failures only. Do not include headers or secrets.
    console.warn("Reading validation failed", { message, rawBody });
    return Response.json({ error: message, message }, { status: 400 });
  };
  try { rawBody = await request.text(); }
  catch { return invalid("request body could not be read"); }
  let parsed: unknown;
  try { parsed = JSON.parse(rawBody); }
  catch { return invalid("request body must be valid JSON"); }
  const validationError = validateReading(parsed);
  if (validationError) return invalid(validationError);
  const body = parsed as DeviceReading;
  try {
    const db = getSupabase();
    const { data: machine, error: machineError } = await db.from("machines").select("name, location").eq("id", body.device).maybeSingle();
    if (machineError) throw machineError;
    if (!machine) return invalid(`unknown device: ${body.device}`);
    if (request.headers.get("x-demo-data") === "true") {
      if (!machine.name.includes("(demo)")) return invalid(`x-demo-data requires device ${body.device} to have '(demo)' in its name`);
      if (!machine.location.toLowerCase().includes("demo")) return invalid(`x-demo-data requires device ${body.device} to have 'demo' in its location`);
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await db.from("machine_state").select("*").eq("machine_id", body.device).maybeSingle();
      if (error) throw error;
      if (!data) return invalid(`missing machine_state row for device: ${body.device}`);
      const current = data as MachineState;
      if (!Number.isInteger(current.revision)) throw new Error("Run step2.sql");
      // Timestamp on the server, after reading the current row. Preserve monotonic order.
      const at = new Date(Math.max(Date.now(), current.last_seen ? Date.parse(current.last_seen) + 1 : 0)).toISOString();
      const next = nextState(current, { rms: body.rms, door_open: body.door_open, at });
      const { data: saved, error: saveError } = await db.rpc("save_machine_reading", {
        p_machine_id: body.device, p_expected_revision: current.revision, p_next: next,
      });
      if (saveError) throw saveError;
      if (saved) {
        // after() keeps this work within Vercel's request lifetime. The durable
        // queue is also checked on later readings, even after the door opens.
        if (pushSettings() || (current.state === "IN_USE" && next.state === "DONE")) {
          after(() => deliverMachinePush(body.device, machine.name));
        }
        return Response.json({ machine: body.device, state: next.state, state_since: next.state_since, time_scale: MACHINE_CONFIG.TIME_SCALE });
      }
      // Another request won the race. Re-read and recompute; no partial writes occurred.
    }
    return Response.json({ error: "Machine is busy. Send the next reading." }, { status: 409 });
  } catch (error) {
    // Never log request headers, environment values, or database error messages.
    console.error("Ingest failed", { code: typeof error === "object" && error && "code" in error ? error.code : "configuration" });
    return Response.json({ error: "Database update failed. Check server settings and run supabase/step2.sql." }, { status: 503 });
  }
}
