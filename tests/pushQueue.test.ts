import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("Postgres queues a completed cycle atomically, deduplicates registration, and claims only once", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    for (const file of ["schema.sql", "seed.sql", "step2.sql", "step4.sql"]) {
      await db.exec(await readFile(new URL(`../supabase/${file}`, import.meta.url), "utf8"));
    }
    // Rerunning the migration must not reset pending or sent deliveries.
    await db.exec(await readFile(new URL("../supabase/step4.sql", import.meta.url), "utf8"));
    await db.exec("set role service_role");
    const register = () => db.query<{ status: string }>(
      "select public.register_machine_push('washer-1', 'endpoint-hash', $1::jsonb) as status",
      [JSON.stringify({ endpoint: "https://web.push.apple.com/test", keys: {} })],
    );
    assert.equal((await register()).rows[0].status, "pending");
    await register();
    assert.equal((await db.query<{ count: number }>("select count(*)::int as count from public.push_subscriptions")).rows[0].count, 1);
    assert.equal((await db.query("select * from public.claim_machine_push('washer-1')")).rows.length, 0);
    await db.exec("update public.machine_state set state = 'IN_USE', run_started_at = '2026-01-01T00:00:00Z' where machine_id = 'washer-1'");
    const row = (await db.query<Record<string, unknown>>("select * from public.machine_state where machine_id = 'washer-1'")).rows[0];
    const next = { ...row, state: "DONE", state_since: "2026-01-01T00:15:00Z", last_seen: "2026-01-01T00:15:00Z", last_rms: 0, door_open: false };
    const save = () => db.query<{ saved: boolean }>("select public.save_machine_reading('washer-1', 0, $1::jsonb) as saved", [JSON.stringify(next)]);
    assert.equal((await save()).rows[0].saved, true);
    assert.equal((await save()).rows[0].saved, false); // competing/stale calculation
    assert.equal((await register()).rows[0].status, "queued");
    const firstClaim = await db.query<{ id: string; cycle_id: string }>("select * from public.claim_machine_push('washer-1')");
    assert.equal(firstClaim.rows.length, 1);
    assert.ok(firstClaim.rows[0].cycle_id);
    assert.equal((await db.query("select * from public.claim_machine_push('washer-1')")).rows.length, 0);
    assert.equal((await register()).rows[0].status, "sending");
    await db.exec("update public.push_subscriptions set delivery_status = 'sent', notified_at = now() where machine_id = 'washer-1'");
    assert.equal((await db.query("select * from public.claim_machine_push('washer-1')")).rows.length, 0);
    assert.equal((await register()).rows[0].status, "pending"); // explicit next-load opt-in
    assert.equal((await db.query("select * from public.claim_machine_push('washer-1')")).rows.length, 0);
    // A rolled-back cycle must not leave a queued notification behind.
    await db.exec("begin; insert into public.cycles(machine_id, started_at, ended_at) values ('washer-1', now(), now()); rollback;");
    assert.equal((await db.query("select * from public.claim_machine_push('washer-1')")).rows.length, 0);
    await db.exec("reset role; set role anon");
    await assert.rejects(() => register(), /permission denied/);
  } finally { await db.close(); }
});
