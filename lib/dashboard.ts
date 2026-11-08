import "server-only";
import { DateTime, IANAZone } from "luxon";
import { getSupabase } from "./supabase";
import { computeUsage, type MachineType, type UsageCycle } from "./usage";
import { isOffline } from "./status";

export async function loadDashboard(range: string, includeDemo: boolean) {
  const timezone = process.env.BUILDING_TIMEZONE || "America/New_York";
  if (!IANAZone.isValidZone(timezone)) throw new Error("Invalid BUILDING_TIMEZONE. Use an IANA name such as America/New_York.");
  const now = DateTime.now().setZone(timezone);
  const end = now.toUTC().toISO()!;
  const db = getSupabase();
  const { data: allMachines, error } = await db.from("machines").select("id, type, is_demo, created_at");
  if (error) throw new Error("Run supabase/step6.sql in Supabase, then reload this page.");
  const machines = (allMachines ?? []).filter((m) => includeDemo || !m.is_demo);
  const ids = machines.map((m) => m.id);
  const counts = { washer: 0, dryer: 0 };
  for (const machine of machines) counts[machine.type as MachineType]++;
  let earliest = end;
  if (ids.length) {
    let first = db.from("cycles").select("started_at").in("machine_id", ids).lt("started_at", end).order("started_at").limit(1);
    if (!includeDemo) first = first.eq("is_demo", false);
    const { data, error: firstError } = await first;
    if (firstError) throw new Error("Could not load usage history. Check Supabase and step6.sql.");
    // Before the inventory existed, absence of cycles is not evidence of free machines.
    earliest = new Date(Math.min(Date.parse(end), ...machines.map((m) => Date.parse(m.created_at)), ...(data ?? []).map((c) => Date.parse(c.started_at)))).toISOString();
  }
  const requested = range === "all" ? earliest : now.minus({ days: Number(range) }).toUTC().toISO()!;
  const start = new Date(Math.max(Date.parse(requested), Date.parse(earliest))).toISOString();
  const cycles: UsageCycle[] = [];
  // Paginate: Supabase's default response limit must never silently truncate history.
  if (ids.length) for (let offset = 0; ; offset += 1000) {
    let query = db.from("cycles").select("id, machine_id, started_at, ended_at, is_demo")
      .in("machine_id", ids).lt("started_at", end).or(`ended_at.is.null,ended_at.gt.${start}`)
      .order("started_at").order("id").range(offset, offset + 999);
    if (!includeDemo) query = query.eq("is_demo", false);
    const { data, error: cyclesError } = await query;
    if (cyclesError) throw new Error("Could not load cycle history from Supabase.");
    for (const cycle of data ?? []) {
      const machine = machines.find((m) => m.id === cycle.machine_id)!;
      cycles.push({ ...cycle, type: machine.type, is_demo: cycle.is_demo || machine.is_demo });
    }
    if (!data || data.length < 1000) break;
  }
  const usage = computeUsage({ cycles, counts, start, end, now: end, timezone, includeDemo });
  const { data: states, error: statesError } = await db.from("machine_state").select("machine_id, state, last_seen");
  if (statesError) throw new Error("Could not load current room status.");
  const live = (["washer", "dryer"] as MachineType[]).map((type) => {
    const group = machines.filter((m) => m.type === type);
    const samples = group.map((m) => states?.find((s) => s.machine_id === m.id));
    const known = samples.every((s) => s && !isOffline(s.last_seen, now.toMillis()));
    const running = samples.filter((s) => s && s.state === "IN_USE" && !isOffline(s.last_seen, now.toMillis())).length;
    const bucket = usage.types[type].buckets[(now.weekday - 1) * 24 + now.hour];
    const typical = usage.types[type].has_data ? bucket.utilization : null;
    const share = group.length ? running / group.length * 100 : 0;
    const comparison = !known || !group.length ? "Live count unavailable" : typical === null ? "Not enough history to compare" :
      share > typical + 10 ? "Busier than usual" : share < typical - 10 ? "Quieter than usual" : "About normal";
    return { type, total: group.length, running: known ? running : null, comparison, typical, weeks: bucket.weeks };
  });
  const demoNow = includeDemo && machines.some((m) => m.is_demo && states?.some((s) => s.machine_id === m.id && s.last_seen));
  return { usage, live, demoShown: usage.demo_included || demoNow, updated: now.toFormat("LLL d, h:mm a"), range, includeDemo };
}
export type DashboardData = Awaited<ReturnType<typeof loadDashboard>>;
