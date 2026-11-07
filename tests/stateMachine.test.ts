import test from "node:test";
import assert from "node:assert/strict";
import { nextState, type MachineState } from "../lib/stateMachine.ts";
import { machineConfig } from "../lib/machine-config.ts";

const config = machineConfig(1);
const iso = (seconds: number) => new Date(Date.UTC(2026, 0, 1) + seconds * 1000).toISOString();
function harness() {
  let state: MachineState = {
    machine_id: "washer-1", state: "IDLE", state_since: iso(0), last_seen: null,
    last_rms: null, door_open: null, run_started_at: null, quiet_since: null,
    vibration_since: null, door_opened_since_done: false, revision: 0,
  };
  return {
    get state() { return state; },
    read(t: number, rms = 0.42, door_open = false) {
      state = nextState(state, { at: iso(t), rms, door_open }, config);
      return state;
    },
    through(start: number, end: number, rms = 0.42, door = false) {
      for (let t = start; t <= end; t += 2) this.read(t, rms, door);
    },
  };
}

test("full cycle: confirms run, waits for both minimum run and quiet, then DONE", () => {
  const h = harness();
  h.through(0, 18);
  assert.equal(h.state.state, "IDLE");
  h.read(20);
  assert.equal(h.state.state, "IN_USE");
  h.through(22, 620);
  h.through(622, 800, 0);
  assert.equal(h.state.state, "IN_USE");
  h.read(802, 0);
  assert.equal(h.state.state, "DONE");
  assert.equal(h.state.state_since, iso(802));
  h.read(804, 0);
  assert.equal(h.state.state_since, iso(802));
});

test("short bump is not a run and the next bump starts a new timer", () => {
  const h = harness();
  h.through(0, 18);
  h.read(20, 0);
  h.through(22, 40);
  assert.equal(h.state.state, "IDLE");
  h.read(42);
  assert.equal(h.state.state, "IN_USE");
});

test("quiet pause in the middle of a cycle does not finish it", () => {
  const h = harness();
  h.through(0, 620);
  h.through(622, 740, 0);
  assert.equal(h.state.state, "IN_USE");
  h.read(742);
  assert.equal(h.state.quiet_since, null);
  h.through(744, 900);
  assert.equal(h.state.state, "IN_USE");
});

test("minimum run time still applies after three minutes of quiet", () => {
  const h = harness();
  h.through(0, 20);
  h.through(22, 202, 0);
  assert.equal(h.state.state, "IN_USE");
});

test("door after DONE means LIKELY_FREE, closing means IDLE", () => {
  const h = harness();
  h.through(0, 620);
  h.through(622, 802, 0);
  h.read(804, 0, true);
  assert.equal(h.state.state, "LIKELY_FREE");
  assert.equal(h.state.door_opened_since_done, true);
  h.read(806, 0, false);
  assert.equal(h.state.state, "IDLE");
  assert.equal(h.state.run_started_at, null);
});

test("opening door interrupts quiet confirmation", () => {
  const h = harness();
  h.through(0, 620);
  h.through(622, 790, 0);
  h.read(792, 0, true);
  h.through(794, 810, 0);
  assert.equal(h.state.state, "IN_USE");
});

test("sustained vibration restarts a DONE machine", () => {
  const h = harness();
  h.through(0, 620);
  h.through(622, 802, 0);
  h.through(804, 824);
  assert.equal(h.state.state, "IN_USE");
  assert.equal(h.state.run_started_at, iso(824));
});

test("a missing device signal cannot prove sustained vibration", () => {
  const h = harness();
  h.read(0);
  h.read(30);
  assert.equal(h.state.state, "IDLE");
  assert.equal(h.state.vibration_since, iso(30));
});

test("pure function leaves input unchanged, ignores stale timestamps, and scales time", () => {
  const h = harness();
  const input = structuredClone(h.state);
  const first = nextState(Object.freeze(input), { at: iso(0), rms: 0.42, door_open: false }, machineConfig(22.5));
  const second = nextState(first, { at: iso(1), rms: 0.42, door_open: false }, machineConfig(22.5));
  assert.equal(input.last_seen, null);
  assert.equal(second.state, "IN_USE");
  assert.deepEqual(nextState(second, { at: iso(0), rms: 0, door_open: true }), second);
  assert.equal(machineConfig(22.5).RUN_THRESHOLD, config.RUN_THRESHOLD);
  assert.throws(() => machineConfig(0));
});
