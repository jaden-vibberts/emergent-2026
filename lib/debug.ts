export const DEBUG_POLL_MS = 2000;
export type DebugReading = { id: number; created_at: string; rms: number; door_open: boolean };
export type DebugMachine = {
  id: string; name: string; location: string; is_demo: boolean;
  state: string | null; state_since: string | null; last_seen: string | null;
  readings: DebugReading[];
};
// Plot in timestamp order, with a nonzero scale even for a flat/empty signal.
export function chartData(readings: DebugReading[], threshold: number) {
  const sorted = [...readings].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const start = sorted.length ? Date.parse(sorted[0].created_at) : 0;
  const end = sorted.length ? Date.parse(sorted[sorted.length - 1].created_at) : start;
  const maximum = Math.max(threshold, ...sorted.map((r) => r.rms), 0.01) * 1.15;
  const y = (value: number) => 155 - (value / maximum) * 135;
  const points = sorted.map((r) => ({ x: end === start ? 325 : 50 + ((Date.parse(r.created_at) - start) / (end - start)) * 550, y: y(r.rms) }));
  return { points, thresholdY: y(threshold), maximum, start, end };
}
