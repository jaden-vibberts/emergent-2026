import "server-only";
import { getSupabase } from "./supabase";
import { medianDuration, type MachineView } from "./status";

export async function loadMachines(deviceId?: string): Promise<MachineView[]> {
  const db = getSupabase();
  let query = db.from("machines").select("id, name, location").order("id");
  if (deviceId) query = query.eq("id", deviceId);
  const { data: machines, error } = await query;
  if (error) throw error;
  return Promise.all((machines ?? []).map(async (machine) => {
    const [state, history] = await Promise.all([
      db.from("machine_state").select("state, state_since, last_seen, run_started_at").eq("machine_id", machine.id).maybeSingle(),
      db.from("cycles").select("duration_seconds").eq("machine_id", machine.id)
        .not("ended_at", "is", null).gt("duration_seconds", 0).order("ended_at", { ascending: false }).limit(20),
    ]);
    if (state.error || history.error) throw state.error ?? history.error;
    const durations = (history.data ?? []).map((cycle) => Number(cycle.duration_seconds));
    return { ...machine, state: state.data?.state ?? "IDLE", state_since: state.data?.state_since ?? null,
      last_seen: state.data?.last_seen ?? null, run_started_at: state.data?.run_started_at ?? null,
      median_seconds: medianDuration(durations), history_count: durations.length };
  }));
}
