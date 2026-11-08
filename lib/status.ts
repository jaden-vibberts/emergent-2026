export const STATUS_POLL_MS = 3000;
// Display/push freshness only; independent of machine-state timing and TIME_SCALE.
export const OFFLINE_AFTER_MS = 30_000;
export function isOffline(lastSeen: string | null, now: number) {
  return !lastSeen || !Number.isFinite(Date.parse(lastSeen)) || now - Date.parse(lastSeen) > OFFLINE_AFTER_MS;
}
export function lastSeenLabel(lastSeen: string | null, now: number) {
  if (!lastSeen || !Number.isFinite(Date.parse(lastSeen))) return "No readings received yet";
  const seconds = Math.max(0, Math.floor((now - Date.parse(lastSeen)) / 1000));
  if (seconds < 60) return `Last seen ${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  return `Last seen ${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
}
export type MachineView = {
  id: string; name: string; location: string; state: string; is_demo: boolean;
  state_since: string | null; last_seen: string | null; run_started_at: string | null;
  median_seconds: number | null; history_count: number;
};
export const statusLabels: Record<string, string> = {
  IDLE: "Idle", IN_USE: "In use", DONE: "Done — clothes probably inside", LIKELY_FREE: "Likely free",
};
export function medianDuration(values: number[]) {
  const sorted = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (sorted.length < 3) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
export function elapsedLabel(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes}m ${seconds % 60}s` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
export function remainingLabel(machine: MachineView, now: number) {
  if (machine.state !== "IN_USE") return null;
  if (isOffline(machine.last_seen, now)) return "Waiting for device";
  if (machine.median_seconds === null || !machine.run_started_at) return "estimating...";
  const remaining = machine.median_seconds * 1000 - (now - Date.parse(machine.run_started_at));
  return remaining > 0 ? `About ${elapsedLabel(remaining)} remaining` : "Taking longer than usual";
}
