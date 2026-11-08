import test from "node:test";
import assert from "node:assert/strict";
import { computeUsage, type UsageCycle } from "../lib/usage.ts";
const zone = "America/New_York";
function calculate(start: string, end: string, cycles: UsageCycle[], includeDemo = false, count = 1) {
  return computeUsage({ start, end, now: end, cycles, counts: { washer: count, dryer: 0 }, timezone: zone, includeDemo });
}
function cycle(started_at: string, ended_at: string | null, extra: Partial<UsageCycle> = {}): UsageCycle {
  return { started_at, ended_at, type: "washer", is_demo: false, ...extra };
}

test("one washer Tuesday 2–3pm is 100% at 2pm and 0% at 3pm", () => {
  const result = calculate("2026-11-03T00:00:00-05:00", "2026-11-04T00:00:00-05:00", [cycle("2026-11-03T14:00:00-05:00", "2026-11-03T15:00:00-05:00")]);
  const buckets = result.types.washer.buckets;
  assert.equal(buckets[24 + 14].utilization, 100);
  assert.equal(buckets[24 + 14].fully_booked, 100);
  assert.equal(buckets[24 + 14].weeks, 1);
  assert.equal(buckets[24 + 15].utilization, 0);
  assert.equal(buckets[24 + 15].fully_booked, 0);
  assert.equal(result.types.dryer.buckets[0].utilization, null);
});

test("midnight cycle contributes to both local days", () => {
  const result = calculate("2026-11-02T00:00:00-05:00", "2026-11-04T00:00:00-05:00", [cycle("2026-11-02T23:30:00-05:00", "2026-11-03T00:30:00-05:00")]);
  assert.equal(result.types.washer.buckets[23].utilization, 50);
  assert.equal(result.types.washer.buckets[24].utilization, 50);
});

test("fall-back counts both 1am hours, weighted over 120 real minutes", () => {
  const result = calculate("2026-11-01T00:00:00-04:00", "2026-11-02T00:00:00-05:00", [cycle("2026-11-01T01:30:00-04:00", "2026-11-01T01:30:00-05:00")]);
  const bucket = result.types.washer.buckets[6 * 24 + 1];
  assert.equal(bucket.minutes, 120);
  assert.equal(bucket.utilization, 50);
  assert.equal(bucket.weeks, 1);
  assert.equal(result.types.washer.buckets.reduce((sum, b) => sum + b.minutes, 0), 1500);
});

test("spring-forward skips 2am and counts only real elapsed minutes", () => {
  const result = calculate("2026-03-08T00:00:00-05:00", "2026-03-09T00:00:00-04:00", [cycle("2026-03-08T01:30:00-05:00", "2026-03-08T03:30:00-04:00")]);
  const buckets = result.types.washer.buckets;
  assert.equal(buckets[145].utilization, 50);
  assert.equal(buckets[146].minutes, 0);
  assert.equal(buckets[146].utilization, null);
  assert.equal(buckets[147].utilization, 50);
  assert.equal(buckets.reduce((sum, b) => sum + b.minutes, 0), 1380);
});

test("capacity, open cycles, clipping, demo filter, and overlap deduplication", () => {
  const start = "2026-11-03T14:00:00-05:00", end = "2026-11-03T15:00:00-05:00";
  const cycles = [cycle("2026-11-03T13:00:00-05:00", null, { machine_id: "a" }), cycle(start, end, { machine_id: "a" }), cycle(start, end, { machine_id: "b", is_demo: true })];
  const real = calculate(start, end, cycles, false, 2);
  assert.equal(real.types.washer.buckets[38].utilization, 50);
  assert.equal(real.types.washer.buckets[38].fully_booked, 0);
  assert.equal(real.demo_included, false);
  const demo = calculate(start, end, cycles, true, 2);
  assert.equal(demo.types.washer.buckets[38].utilization, 100);
  assert.equal(demo.types.washer.buckets[38].fully_booked, 100);
  assert.equal(demo.demo_included, true);
});

test("distinct weeks use ISO week-year and windows stay between 8am and 11pm", () => {
  const result = calculate("2026-10-26T00:00:00-04:00", "2026-11-09T00:00:00-05:00", [cycle("2026-11-03T14:00:00-05:00", "2026-11-03T15:00:00-05:00")]);
  assert.equal(result.types.washer.buckets[38].weeks, 2);
  assert.equal(result.types.washer.buckets[38].utilization, 50);
  assert.equal(result.types.washer.busiest.length, 3);
  assert.ok([...result.types.washer.busiest, ...result.types.washer.quietest].every((w) => w.start_hour >= 8 && w.end_hour <= 23));
  assert.equal(result.types.washer.busiest[0].utilization, 25);
  assert.equal(result.types.washer.quietest[0].utilization, 0);
  assert.doesNotThrow(() => JSON.stringify(result));
});

test("empty history and invalid timezone do not fabricate useful history", () => {
  const result = calculate("2026-11-03T00:00:00Z", "2026-11-04T00:00:00Z", []);
  assert.equal(result.types.washer.has_data, false);
  assert.deepEqual(result.types.washer.quietest, []);
  assert.throws(() => computeUsage({ cycles: [], counts: { washer: 1, dryer: 0 }, start: result.start, end: result.end, timezone: "bad-zone", includeDemo: false }));
});
