import test from "node:test";
import assert from "node:assert/strict";
import { chartData } from "../lib/debug.ts";

test("chart handles empty and single samples without invalid coordinates", () => {
  assert.equal(chartData([], 0.2).points.length, 0);
  const chart = chartData([{ id: 1, created_at: "2026-01-01T00:00:00Z", rms: 0, door_open: false }], 0.2);
  assert.equal(chart.points[0].x, 325);
  assert.equal(chart.points[0].y, 155);
  assert.ok(Number.isFinite(chart.thresholdY));
});
test("chart sorts readings and spaces samples by elapsed time", () => {
  const chart = chartData([10, 0, 2].map((seconds) => ({ id: seconds, created_at: new Date(seconds * 1000).toISOString(), rms: seconds / 10, door_open: false })), 0.2);
  assert.deepEqual(chart.points.map((p) => p.x), [50, 160, 600]);
  assert.ok(chart.points.every((p) => p.y >= 20 && p.y <= 155));
});
