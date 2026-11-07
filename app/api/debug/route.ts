import { getSupabase } from "@/lib/supabase";
import { MACHINE_CONFIG } from "@/lib/machine-config";

export const dynamic = "force-dynamic";
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    const db = getSupabase();
    const { data, error } = await db.from("machines").select("id, name, location").order("id");
    if (error) throw error;
    const machines = await Promise.all((data ?? []).map(async (machine) => {
      const [state, readings] = await Promise.all([
        db.from("machine_state").select("state, state_since, last_seen").eq("machine_id", machine.id).maybeSingle(),
        db.from("readings").select("id, created_at, rms, door_open").eq("machine_id", machine.id)
          .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(20),
      ]);
      if (state.error || readings.error) throw state.error ?? readings.error;
      return { ...machine, state: state.data?.state ?? null, state_since: state.data?.state_since ?? null,
        last_seen: state.data?.last_seen ?? null, readings: readings.data ?? [] };
    }));
    return Response.json({ machines, threshold: MACHINE_CONFIG.RUN_THRESHOLD, time_scale: MACHINE_CONFIG.TIME_SCALE,
      server_time: new Date().toISOString() }, { headers });
  } catch {
    return Response.json({ error: "Unable to load debug data." }, { status: 503, headers });
  }
}
