import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("atomic seed/reset preserves real and unbatched history, state, readings, and subscriptions", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    for (const file of ["schema.sql", "seed.sql", "step2.sql", "step4.sql", "step6.sql", "step7.sql"]) await db.exec(await readFile(new URL(`../supabase/${file}`, import.meta.url), "utf8"));
    // Real cycle with an accidental batch marker must survive reset too.
    await db.exec("insert into public.cycles(machine_id,started_at,ended_at,is_demo,seed_batch) values ('washer-1','2026-01-01T00:00Z','2026-01-01T01:00Z',false,null), ('washer-1','2026-01-02T00:00Z','2026-01-02T01:00Z',false,'do-not-delete'), ('washer-1','2026-01-03T00:00Z','2026-01-03T01:00Z',true,null)");
    await db.exec("insert into public.push_subscriptions(machine_id,subscription_json) values ('washer-1','{}')");
    const beforeState = (await db.query("select * from public.machine_state order by machine_id")).rows;
    const beforePush = (await db.query("select * from public.push_subscriptions")).rows;
    const beforeCycles = (await db.query("select * from public.cycles order by id")).rows;
    const seed = [{ machine_id: "washer-1", started_at: "2026-02-01T00:00:00Z", ended_at: "2026-02-01T01:00:00Z", is_demo: true, seed_batch: "seed-test" }];
    await db.exec("set role service_role");
    const replace = (rows: unknown[]) => db.query<{ result: { deleted: number; inserted: number } }>("select public.replace_demo_seed($1::jsonb) as result", [JSON.stringify(rows)]);
    assert.equal((await replace(seed)).rows[0].result.inserted, 1);
    assert.deepEqual((await replace(seed)).rows[0].result, { deleted: 1, inserted: 1 });
    await assert.rejects(() => replace([{ ...seed[0], is_demo: false }]), /explicitly labeled/);
    await assert.rejects(() => replace([{ ...seed[0], started_at: '2026-01-01T00:30:00Z', ended_at: '2026-01-01T01:30:00Z' }]), /overlaps preserved/);
    assert.equal((await db.query<{ count: number }>("select count(*)::int as count from public.cycles")).rows[0].count, 4);
    assert.deepEqual((await replace([])).rows[0].result, { deleted: 1, inserted: 0 });
    assert.deepEqual((await db.query("select * from public.cycles order by id")).rows, beforeCycles);
    assert.deepEqual((await db.query("select * from public.machine_state order by machine_id")).rows, beforeState);
    assert.deepEqual((await db.query("select * from public.push_subscriptions")).rows, beforePush);
    assert.equal((await db.query("select * from public.readings")).rows.length, 0);
    await db.exec("reset role; set role anon");
    await assert.rejects(() => replace([]), /permission denied/);
  } finally { await db.close(); }
});
