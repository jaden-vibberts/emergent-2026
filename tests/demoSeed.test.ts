import test from "node:test";
import assert from "node:assert/strict";
import { generateDemoCycles, SEED_MACHINES } from "../lib/demoSeed.ts";
import { computeUsage } from "../lib/usage.ts";
const options = { weeks: 6, seed: 42, now: "2026-11-07T22:00:00Z", timezone: "America/New_York" };

test("seed is repeatable, explicitly labeled, complete, and nonoverlapping with gaps", () => {
  const rows = generateDemoCycles(options);
  assert.deepEqual(rows, generateDemoCycles(options));
  assert.notDeepEqual(rows, generateDemoCycles({ ...options, seed: 43 }));
  assert.ok(rows.length > 500);
  for (const id of SEED_MACHINES) {
    const group = rows.filter((r) => r.machine_id === id);
    assert.ok(group.length > 0);
    for (let i = 0; i < group.length; i++) {
      const row = group[i], duration = (Date.parse(row.ended_at) - Date.parse(row.started_at)) / 60_000;
      assert.equal(row.is_demo, true);
      assert.match(row.seed_batch, /^seed-/);
      assert.ok(Date.parse(row.ended_at) < Date.parse(options.now));
      assert.ok(duration >= (id.startsWith("washer") ? 35 : 45) - 0.001);
      assert.ok(duration <= (id.startsWith("washer") ? 60 : 75) + 0.001);
      if (i) assert.ok(Date.parse(row.started_at) - Date.parse(group[i - 1].ended_at) >= 3 * 60_000 - 1);
    }
  }
});

test("existing real/legacy and active cycles are reserved rather than overwritten or overlapped", () => {
  const preserved = [{ machine_id: "washer-1", started_at: "2026-10-01T00:00:00Z", ended_at: "2026-10-10T00:00:00Z" },
    { machine_id: "washer-2", started_at: "2026-11-01T00:00:00Z", ended_at: null }];
  const rows = generateDemoCycles({ ...options, preserved });
  for (const row of rows) for (const block of preserved) if (row.machine_id === block.machine_id) {
    assert.ok(Date.parse(row.ended_at) <= Date.parse(block.started_at) || Date.parse(row.started_at) >= Date.parse(block.ended_at ?? options.now));
  }
});

test("seed produces evening/weekend peaks and fully booked periods for both types", () => {
  const rows = generateDemoCycles(options);
  const usage = computeUsage({ cycles: rows.map((r) => ({ ...r, type: r.machine_id.startsWith("washer") ? "washer" as const : "dryer" as const })),
    counts: { washer: 2, dryer: 2 }, start: "2026-09-26T22:00:00Z", end: options.now, now: options.now, timezone: options.timezone, includeDemo: true });
  for (const type of ["washer", "dryer"] as const) {
    const buckets = usage.types[type].buckets;
    const average = (filter: (b: typeof buckets[number]) => boolean) => {
      const group = buckets.filter(filter); return group.reduce((sum, b) => sum + (b.utilization ?? 0), 0) / group.length;
    };
    const morning = average((b) => b.day <= 5 && b.hour >= 8 && b.hour < 12);
    assert.ok(average((b) => b.day <= 5 && b.hour >= 18 && b.hour < 22) > morning + 20);
    assert.ok(average((b) => b.day >= 6 && b.hour >= 11 && b.hour < 19) > morning + 20);
    assert.ok(average((b) => b.hour >= 2 && b.hour < 7) < 10);
    assert.ok(buckets.some((b) => (b.fully_booked ?? 0) > 40));
  }
  assert.equal(usage.demo_included, true);
  const real = computeUsage({ cycles: rows.map((r) => ({ ...r, type: "washer" as const })), counts: { washer: 1, dryer: 0 }, start: usage.start, end: options.now, now: options.now, timezone: options.timezone, includeDemo: false });
  assert.equal(real.demo_included, false);
  assert.equal(real.types.washer.has_data, false);
});
