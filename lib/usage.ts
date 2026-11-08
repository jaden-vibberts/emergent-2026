import { DateTime, IANAZone } from "luxon";

export type MachineType = "washer" | "dryer";
export type UsageCycle = {
  started_at: string; ended_at: string | null; type: MachineType;
  is_demo: boolean; machine_id?: string;
};
export type UsageBucket = {
  day: number; hour: number; minutes: number; machine_minutes: number;
  fully_booked_minutes: number; utilization: number | null;
  fully_booked: number | null; weeks: number;
};
export type UsageWindow = { day: number; start_hour: number; end_hour: number; utilization: number; fully_booked: number; weeks: number };
export type TypeUsage = { total: number; has_data: boolean; buckets: UsageBucket[]; quietest: UsageWindow[]; busiest: UsageWindow[]; insights: string[] };
export type UsageResult = { timezone: string; start: string; end: string; demo_included: boolean; types: Record<MachineType, TypeUsage> };

// Minute-start samples on the real UTC timeline. Luxon maps each sample into the
// building's clock: spring-forward has no missing-hour samples, fall-back has both.
// Counts are temporary computation arrays, never persisted machine state.
export function computeUsage(input: {
  cycles: UsageCycle[]; counts: Record<MachineType, number>; start: string; end: string;
  timezone: string; includeDemo: boolean; now?: string;
}): UsageResult {
  if (!IANAZone.isValidZone(input.timezone)) throw new Error("BUILDING_TIMEZONE must be a valid IANA timezone");
  const now = Date.parse(input.now ?? new Date().toISOString());
  const rawStart = Date.parse(input.start);
  const end = Math.min(Date.parse(input.end), now);
  if (![rawStart, end, now].every(Number.isFinite) || end < rawStart) throw new Error("Invalid usage date range");
  const start = Math.min(end, Math.ceil(rawStart / 60_000) * 60_000);
  const length = Math.max(0, Math.ceil((end - start) / 60_000));
  const types: MachineType[] = ["washer", "dryer"];
  for (const type of types) if (!Number.isInteger(input.counts[type]) || input.counts[type] < 0) throw new Error("Machine counts must be nonnegative integers");
  const diffs = { washer: new Int32Array(length + 1), dryer: new Int32Array(length + 1) };
  const minutes = { washer: new Int32Array(length), dryer: new Int32Array(length) };
  const observed = { washer: false, dryer: false };
  const groups = new Map<string, { type: MachineType; intervals: [number, number][] }>();
  let demoIncluded = false;
  input.cycles.forEach((cycle, index) => {
    if (!types.includes(cycle.type) || (cycle.is_demo && !input.includeDemo)) return;
    const a = Math.max(start, Date.parse(cycle.started_at));
    const b = Math.min(end, cycle.ended_at ? Date.parse(cycle.ended_at) : now);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return;
    observed[cycle.type] = true;
    demoIncluded ||= cycle.is_demo;
    const key = `${cycle.type}:${cycle.machine_id ?? `cycle-${index}`}`;
    if (!groups.has(key)) groups.set(key, { type: cycle.type, intervals: [] });
    groups.get(key)!.intervals.push([a, b]);
  });
  // Merge overlaps for the same machine so it can never count twice.
  for (const { type, intervals } of groups.values()) {
    intervals.sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const interval of intervals) {
      const previous = merged[merged.length - 1];
      if (previous && interval[0] <= previous[1]) previous[1] = Math.max(previous[1], interval[1]);
      else merged.push([...interval]);
    }
    for (const [a, b] of merged) {
      const first = Math.ceil((a - start) / 60_000);
      const last = Math.min(length, Math.ceil((b - start) / 60_000));
      diffs[type][first]++; diffs[type][last]--;
    }
  }
  const buckets = () => Array.from({ length: 168 }, (_, i) => ({ day: Math.floor(i / 24) + 1, hour: i % 24,
    minutes: 0, machine_minutes: 0, fully_booked_minutes: 0, utilization: null, fully_booked: null, weeks: 0 } as UsageBucket));
  const result: UsageResult = { timezone: input.timezone, start: new Date(start).toISOString(), end: new Date(end).toISOString(), demo_included: demoIncluded,
    types: { washer: { total: input.counts.washer, has_data: observed.washer, buckets: buckets(), quietest: [], busiest: [], insights: [] },
      dryer: { total: input.counts.dryer, has_data: observed.dryer, buckets: buckets(), quietest: [], busiest: [], insights: [] } } };
  const weeks = Array.from({ length: 168 }, () => new Set<string>());
  let local = DateTime.fromMillis(start, { zone: input.timezone });
  let nextHour = local.plus({ hours: 1 }).startOf("hour").toMillis();
  const running = { washer: 0, dryer: 0 };
  for (let i = 0; i < length; i++) {
    // Only reconstruct a zoned DateTime on hour boundaries; minute steps preserve
    // all UTC offsets, including zones whose hour boundary is not a UTC hour.
    const stamp = start + i * 60_000;
    if (stamp >= nextHour) {
      local = DateTime.fromMillis(stamp, { zone: input.timezone });
      nextHour = local.plus({ hours: 1 }).startOf("hour").toMillis();
    }
    const index = (local.weekday - 1) * 24 + local.hour;
    weeks[index].add(`${local.weekYear}-${local.weekNumber}`);
    for (const type of types) {
      running[type] += diffs[type][i];
      const count = Math.min(input.counts[type], Math.max(0, running[type]));
      minutes[type][i] = count;
      const bucket = result.types[type].buckets[index];
      bucket.minutes++;
      bucket.machine_minutes += count;
      if (input.counts[type] > 0 && count === input.counts[type]) bucket.fully_booked_minutes++;
    }
  }
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const hour = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
  for (const type of types) {
    const stats = result.types[type];
    for (const [i, bucket] of stats.buckets.entries()) {
      bucket.weeks = weeks[i].size;
      if (stats.total > 0 && bucket.minutes > 0) {
        bucket.utilization = 100 * bucket.machine_minutes / (stats.total * bucket.minutes);
        bucket.fully_booked = 100 * bucket.fully_booked_minutes / bucket.minutes;
      }
    }
    const windows: UsageWindow[] = [];
    if (stats.has_data && stats.total > 0) for (let day = 1; day <= 7; day++) for (let h = 8; h <= 21; h++) {
      const a = stats.buckets[(day - 1) * 24 + h], b = stats.buckets[(day - 1) * 24 + h + 1];
      if (a.minutes < 60 || b.minutes < 60) continue;
      windows.push({ day, start_hour: h, end_hour: h + 2,
        utilization: 100 * (a.machine_minutes + b.machine_minutes) / (stats.total * (a.minutes + b.minutes)),
        fully_booked: 100 * (a.fully_booked_minutes + b.fully_booked_minutes) / (a.minutes + b.minutes), weeks: Math.min(a.weeks, b.weeks) });
    }
    stats.quietest = [...windows].sort((a, b) => a.utilization - b.utilization || a.day - b.day || a.start_hour - b.start_hour).slice(0, 3);
    stats.busiest = [...windows].sort((a, b) => b.utilization - a.utilization || a.day - b.day || a.start_hour - b.start_hour).slice(0, 3);
    const busy = stats.busiest[0], quiet = stats.quietest[0];
    if (busy && quiet) {
      stats.insights = [
        `${type === "washer" ? "Washers" : "Dryers"} are busiest on ${days[busy.day - 1]} ${hour(busy.start_hour)}–${hour(busy.end_hour)}, when ${Math.round(busy.utilization)}% are running and all of them are in use ${Math.round(busy.fully_booked)}% of the time.`,
        `The quietest window is ${days[quiet.day - 1]} ${hour(quiet.start_hour)}–${hour(quiet.end_hour)}, averaging ${Math.round(quiet.utilization)}% busy.`,
        stats.buckets.some((b) => b.minutes && b.weeks < 2) ? "Some time slots have fewer than two weeks of observations; treat those patterns as tentative." : "Compare these historical patterns with live status before starting a load.",
      ];
    }
  }
  return result;
}
