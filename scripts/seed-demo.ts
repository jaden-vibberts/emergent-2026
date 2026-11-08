import { createClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import { generateDemoCycles, SEED_MACHINES, type PreservedCycle } from "../lib/demoSeed.ts";

async function main() {
  const args = process.argv.slice(2);
  let weeks = 6, seed = 42, yes = false, reset = false;
  let now = DateTime.now().toUTC().toISO()!;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--yes") yes = true;
    else if (arg === "--reset") reset = true;
    else if (["--weeks", "--seed", "--now"].includes(arg)) {
      const value = args[++i];
      if (!value) throw new Error(`${arg} requires a value`);
      if (arg === "--weeks") weeks = Number(value);
      else if (arg === "--seed") seed = Number(value);
      else now = value;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  const timezone = process.env.BUILDING_TIMEZONE || "America/New_York";
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.");
  if (!Number.isFinite(Date.parse(now)) || Date.parse(now) > Date.now()) throw new Error("--now must be a valid timestamp no later than the present.");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const preserved: PreservedCycle[] = [];
  const previous: Record<string, number> = {};
  // Read all preserved history plus existing seed counts; never silently truncate at 1000 rows.
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from("cycles").select("id,machine_id,started_at,ended_at,is_demo,seed_batch").order("id").range(offset, offset + 999);
    if (error) throw new Error(`Cannot read cycles (${error.code}). Run supabase/step7.sql first.`);
    for (const row of data ?? []) {
      if (row.is_demo && row.seed_batch !== null) previous[row.machine_id] = (previous[row.machine_id] ?? 0) + 1;
      else preserved.push(row);
    }
    if (!data || data.length < 1000) break;
  }
  let rows: ReturnType<typeof generateDemoCycles> = [];
  if (!reset) {
    const { data: machines, error } = await db.from("machines").select("id,is_demo").in("id", [...SEED_MACHINES]);
    if (error || machines?.length !== 4) throw new Error("All four machines and step7.sql are required.");
    if (machines.some((m) => m.is_demo !== (m.id !== "washer-1"))) throw new Error("Machine demo flags do not match the real washer-1 setup. Run step7.sql.");
    // Avoid the interval occupied by a currently running device, without changing its state.
    const { data: active, error: stateError } = await db.from("machine_state").select("machine_id,state,run_started_at").eq("state", "IN_USE");
    if (stateError) throw new Error("Could not read active runs safely; no data changed.");
    for (const machine of active ?? []) if (machine.run_started_at) preserved.push({ machine_id: machine.machine_id, started_at: machine.run_started_at, ended_at: null });
    rows = generateDemoCycles({ weeks, seed, now, timezone, preserved });
  }
  console.log(`DEMO DATA ONLY — ${reset ? "reset" : "replace seeded history"}`);
  console.log(`Timezone: ${timezone}; end: ${now}; seed: ${seed}; weeks: ${weeks}`);
  console.table([...new Set([...SEED_MACHINES, ...Object.keys(previous)])].map((machine) => ({ machine, seeded_rows_to_delete: previous[machine] ?? 0, demo_rows_to_insert: rows.filter((r) => r.machine_id === machine).length })));
  console.log("Real cycles and legacy rows with seed_batch=null will be preserved. No readings, machine-state writes, or notifications.");
  if (!yes) {
    console.log("PREVIEW ONLY. Add --yes to apply. To reproduce this exact preview, also pass --now '" + now + "' with the same --seed and --weeks.");
    return;
  }
  const { data, error } = await db.rpc("replace_demo_seed", { p_rows: rows });
  if (error) throw new Error(`Seed transaction rejected (${error.code}): ${error.message}`);
  console.log(`Done. Deleted ${data.deleted} seeded demo rows; inserted ${data.inserted} demo rows.`);
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Seed failed"); process.exitCode = 1; });
