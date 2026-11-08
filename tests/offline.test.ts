import test from "node:test";
import assert from "node:assert/strict";
import { isOffline, lastSeenLabel } from "../lib/status.ts";

test("offline begins strictly after 30 seconds and clears on a new reading", () => {
  const now = Date.UTC(2026, 0, 1);
  assert.equal(isOffline(new Date(now - 30_000).toISOString(), now), false);
  assert.equal(isOffline(new Date(now - 30_001).toISOString(), now), true);
  assert.equal(isOffline(new Date(now).toISOString(), now), false);
  assert.equal(isOffline(null, now), true);
  assert.equal(isOffline("invalid", now), true);
});
test("last-seen copy reports seconds, then minutes, without inventing missing data", () => {
  const now = Date.UTC(2026, 0, 1);
  assert.equal(lastSeenLabel(new Date(now - 31_000).toISOString(), now), "Last seen 31 seconds ago");
  assert.equal(lastSeenLabel(new Date(now - 60_000).toISOString(), now), "Last seen 1 minute ago");
  assert.equal(lastSeenLabel(new Date(now - 120_000).toISOString(), now), "Last seen 2 minutes ago");
  assert.equal(lastSeenLabel(null, now), "No readings received yet");
});
