import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("dashboard migration labels legacy history once and enforces demo machine cycles", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    for (const file of ["schema.sql", "seed.sql", "step2.sql", "step4.sql"]) await db.exec(await readFile(new URL(`../supabase/${file}`, import.meta.url), "utf8"));
    await db.exec("insert into public.cycles(machine_id,started_at,ended_at) values ('washer-1','2026-01-01T00:00Z','2026-01-01T01:00Z')");
    const migration = await readFile(new URL("../supabase/step6.sql", import.meta.url), "utf8");
    await db.exec(migration);
    assert.equal((await db.query<{ is_demo: boolean }>("select is_demo from public.cycles")).rows[0].is_demo, true);
    await db.exec("insert into public.cycles(machine_id,started_at,ended_at) values ('washer-1','2026-02-01T00:00Z','2026-02-01T01:00Z'), ('washer-2','2026-02-01T00:00Z','2026-02-01T01:00Z')");
    await db.exec(migration);
    const rows = (await db.query<{ machine_id: string; is_demo: boolean }>("select machine_id,is_demo from public.cycles where started_at >= '2026-02-01' order by machine_id")).rows;
    assert.deepEqual(rows, [{ machine_id: "washer-1", is_demo: false }, { machine_id: "washer-2", is_demo: true }]);
    await db.exec("update public.machine_state set state='IN_USE', run_started_at='2026-03-01T00:00Z' where machine_id='washer-1'");
    const row = (await db.query<Record<string, unknown>>("select * from public.machine_state where machine_id='washer-1'")).rows[0];
    await db.query("select public.save_machine_reading('washer-1',0,$1::jsonb)", [JSON.stringify({ ...row, state: "DONE", state_since: "2026-03-01T01:00:00Z", last_seen: "2026-03-01T01:00:00Z", last_rms: 0, door_open: false, is_demo: true })]);
    assert.equal((await db.query<{ is_demo: boolean }>("select is_demo from public.cycles where started_at = '2026-03-01T00:00Z'")).rows[0].is_demo, true);
  } finally { await db.close(); }
});
