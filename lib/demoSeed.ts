import { DateTime, IANAZone } from "luxon";
export const SEED_MACHINES = ["washer-1", "washer-2", "dryer-1", "dryer-2"] as const;
export type SeedCycle = { machine_id: string; started_at: string; ended_at: string; is_demo: true; seed_batch: string };
export type PreservedCycle = { machine_id: string; started_at: string; ended_at: string | null };

export function generateDemoCycles(options: { weeks: number; seed: number; now: string; timezone: string; preserved?: PreservedCycle[] }): SeedCycle[] {
  if (!Number.isInteger(options.weeks) || options.weeks < 1 || options.weeks > 52) throw new Error("--weeks must be an integer from 1 to 52");
  if (!Number.isSafeInteger(options.seed)) throw new Error("--seed must be a safe integer");
  if (!IANAZone.isValidZone(options.timezone)) throw new Error("Invalid BUILDING_TIMEZONE");
  const end = DateTime.fromISO(options.now, { zone: options.timezone });
  if (!end.isValid) throw new Error("Invalid --now timestamp");
  const start = end.minus({ weeks: options.weeks }).startOf("hour");
  let state = options.seed >>> 0;
  const random = () => { state += 0x6D2B79F5; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const between = (a: number, b: number) => a + random() * (b - a);
  const minute = 60_000;
  const batch = `seed-${end.toISODate()}-${options.seed}`;
  const washerArrivals: number[] = [], dryerArrivals: number[] = [];
  const weekly = new Map<string, number>();
  // Poisson arrivals within each local clock hour, with a stable weekly demand factor.
  for (let local = start; local.toMillis() < end.toMillis(); local = local.plus({ hours: 1 })) {
    const key = `${local.weekYear}-${local.weekNumber}`;
    if (!weekly.has(key)) weekly.set(key, between(0.8, 1.25));
    const h = local.hour, weekend = local.weekday >= 6;
    let rate = h < 7 ? 0.015 : weekend ? (h < 10 ? 0.45 : h < 19 ? 4.8 : h < 22 ? 2 : 0.6)
      : h < 9 ? 0.25 : h < 14 ? 0.5 : h < 18 ? 0.9 : h < 22 ? 4.2 : 0.6;
    rate *= weekly.get(key)!;
    const until = Math.min(local.plus({ hours: 1 }).toMillis(), end.toMillis());
    for (const [arrivals, hourlyRate] of [[washerArrivals, rate], [dryerArrivals, rate * 0.18]] as [number[], number][]) {
      let at = local.toMillis();
      while (true) {
        at += -Math.log(1 - random()) * 60 * minute / hourlyRate;
        if (at >= until) break;
        arrivals.push(at);
      }
    }
  }
  const cycles: SeedCycle[] = [];
  const available = new Map<string, number>(SEED_MACHINES.map((id) => [id, start.toMillis()]));
  const blocks = new Map<string, [number, number][]>();
  for (const id of SEED_MACHINES) blocks.set(id, (options.preserved ?? []).filter((c) => c.machine_id === id)
    .map((c) => [Date.parse(c.started_at), c.ended_at ? Date.parse(c.ended_at) : end.toMillis()] as [number, number])
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a).sort((a, b) => a[0] - b[0]));
  function schedule(arrival: number, type: "washer" | "dryer") {
    const duration = between(type === "washer" ? 35 : 45, type === "washer" ? 60 : 75) * minute;
    const candidates = SEED_MACHINES.filter((id) => id.startsWith(type)).map((id) => {
      let at = Math.max(arrival, available.get(id)!);
      for (const [a, b] of blocks.get(id)!) {
        if (at + duration + 3 * minute <= a) break;
        if (at < b + 3 * minute && at + duration > a - 3 * minute) at = b + 3 * minute;
      }
      return { id, at };
    }).sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
    const chosen = candidates[0];
    if (chosen.at > arrival + 20 * minute || chosen.at + duration >= end.toMillis()) return;
    const finished = chosen.at + duration;
    available.set(chosen.id, finished + between(3, 8) * minute);
    cycles.push({ machine_id: chosen.id, started_at: new Date(chosen.at).toISOString(), ended_at: new Date(finished).toISOString(), is_demo: true, seed_batch: batch });
    if (type === "washer" && random() < 0.85) dryerArrivals.push(finished + between(5, 30) * minute);
  }
  for (const arrival of washerArrivals.sort((a, b) => a - b)) schedule(arrival, "washer");
  for (const arrival of dryerArrivals.sort((a, b) => a - b)) schedule(arrival, "dryer");
  return cycles.sort((a, b) => a.started_at.localeCompare(b.started_at) || a.machine_id.localeCompare(b.machine_id));
}
