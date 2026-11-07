import { MACHINE_CONFIG } from "./machine-config.ts";

export type MachineState = {
  machine_id: string;
  state: "IDLE" | "IN_USE" | "DONE" | "LIKELY_FREE";
  state_since: string;
  last_seen: string | null;
  last_rms: number | null;
  door_open: boolean | null;
  run_started_at: string | null;
  quiet_since: string | null;
  door_opened_since_done: boolean;
  vibration_since: string | null;
  revision: number;
};
export type Reading = { rms: number; door_open: boolean; at: string };

// Pure: no database, clock, network, or modification of the input object.
export function nextState(current: MachineState, reading: Reading, config = MACHINE_CONFIG): MachineState {
  const now = Date.parse(reading.at);
  const elapsed = (since: string) => now - Date.parse(since);
  if (!Number.isFinite(now) || !Number.isFinite(reading.rms) || reading.rms < 0) {
    throw new Error("Invalid reading");
  }
  if (current.last_seen && now <= Date.parse(current.last_seen)) return { ...current };
  const next = { ...current, last_seen: reading.at, last_rms: reading.rms, door_open: reading.door_open };
  const move = (state: MachineState["state"]) => {
    if (next.state !== state) { next.state = state; next.state_since = reading.at; }
  };
  // Silence from the device is not evidence of continuous vibration or quiet.
  if (current.last_seen && elapsed(current.last_seen) > config.MAX_READING_GAP_MS) {
    next.vibration_since = null;
    next.quiet_since = null;
  }
  if (reading.rms > config.RUN_THRESHOLD) {
    next.quiet_since = null;
    next.vibration_since ??= reading.at;
    if (next.state !== "IN_USE" && elapsed(next.vibration_since) >= config.RUN_CONFIRM_MS) {
      move("IN_USE");
      next.run_started_at = reading.at;
      next.door_opened_since_done = false;
    }
  } else {
    next.vibration_since = null;
    if (next.state === "IN_USE") {
      // Door must remain closed throughout the quiet confirmation window.
      if (reading.door_open || reading.rms === config.RUN_THRESHOLD) next.quiet_since = null;
      else next.quiet_since ??= reading.at;
      if (next.run_started_at && next.quiet_since &&
          elapsed(next.run_started_at) >= config.MIN_RUN_MS &&
          elapsed(next.quiet_since) >= config.QUIET_CONFIRM_MS) {
        move("DONE");
        next.door_opened_since_done = false;
      }
    } else next.quiet_since = null;
  }
  if (next.state === "DONE" && reading.door_open) {
    move("LIKELY_FREE");
    next.door_opened_since_done = true;
  } else if (next.state === "LIKELY_FREE" && !reading.door_open) {
    move("IDLE");
    next.run_started_at = null;
    next.quiet_since = null;
    next.door_opened_since_done = false;
  }
  return next;
}
