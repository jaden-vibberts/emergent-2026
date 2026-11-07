import test from "node:test";
import assert from "node:assert/strict";
import { medianDuration, remainingLabel, elapsedLabel, type MachineView } from "../lib/status.ts";

test("median requires enough usable history and handles outliers and even counts", () => {
  assert.equal(medianDuration([]), null);
  assert.equal(medianDuration([120, 130]), null);
  assert.equal(medianDuration([120, 130, 10000]), 130);
  assert.equal(medianDuration([100, 120, 130, 10000]), 125);
  assert.equal(medianDuration([NaN, 0, -1, 120, 130]), null);
});

test("estimates use elapsed run time, never promise zero, and stop when device is stale", () => {
  const now = Date.UTC(2026, 0, 1);
  const machine: MachineView = {
    id: "washer-1", name: "Washer 1 (demo)", location: "Demo room", state: "IN_USE",
    state_since: new Date(now - 30_000).toISOString(), run_started_at: new Date(now - 30_000).toISOString(),
    last_seen: new Date(now).toISOString(), median_seconds: null, history_count: 0,
  };
  assert.equal(remainingLabel(machine, now), "estimating...");
  assert.equal(remainingLabel({ ...machine, median_seconds: 120 }, now), "About 1m 30s remaining");
  assert.equal(remainingLabel({ ...machine, median_seconds: 20 }, now), "Taking longer than usual");
  assert.equal(remainingLabel(machine, now + 16_000), "Waiting for device");
  assert.equal(remainingLabel({ ...machine, state: "DONE" }, now), null);
  assert.equal(elapsedLabel(-1000), "0s");
});
