-- Run after step6.sql. Does not alter real cycles, readings, or machine state.
begin;
alter table public.cycles add column if not exists seed_batch text;
alter table public.machines add column if not exists is_demo boolean not null default false;
update public.machines set is_demo = true where id in ('washer-2', 'dryer-1', 'dryer-2');
update public.machines set is_demo = false where id = 'washer-1';

-- Seeded historical rows must never queue notifications. Non-seeded behavior is unchanged.
create or replace function public.queue_cycle_push() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.seed_batch is not null then return new; end if;
  if new.ended_at is not null then
    update public.push_subscriptions set delivery_status = 'queued', cycle_id = new.id
      where machine_id = new.machine_id and delivery_status = 'pending' and notified_at is null;
  end if;
  return new;
end;
$$;

-- Replacement/reset is atomic. Even a mistakenly batch-tagged REAL row survives.
create or replace function public.replace_demo_seed(p_rows jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare deleted_count integer; inserted_count integer;
begin
  perform pg_advisory_xact_lock(7062026);
  if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'Expected an array of demo cycles'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_rows) as r(machine_id text, started_at timestamptz, ended_at timestamptz, is_demo boolean, seed_batch text)
    where r.machine_id is null or r.machine_id not in ('washer-1','washer-2','dryer-1','dryer-2')
      or r.is_demo is distinct from true or coalesce(length(trim(r.seed_batch)),0) = 0
      or r.started_at is null or r.ended_at is null or r.ended_at <= r.started_at or r.ended_at >= now()
  ) then raise exception 'Every seeded row must be a completed, past, explicitly labeled demo cycle for a known demo target'; end if;
  if exists (
    select 1 from (
      select r.*, max(ended_at) over (partition by machine_id order by started_at, ended_at rows between unbounded preceding and 1 preceding) as prior_end
      from jsonb_to_recordset(p_rows) as r(machine_id text, started_at timestamptz, ended_at timestamptz)
    ) ordered where started_at < prior_end
  ) then raise exception 'Seeded cycles overlap'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_rows) as r(machine_id text, started_at timestamptz, ended_at timestamptz)
    join public.cycles c on c.machine_id = r.machine_id
    where (c.seed_batch is null or c.is_demo = false)
      and r.started_at < coalesce(c.ended_at, now()) and r.ended_at > c.started_at
  ) then raise exception 'New seed overlaps preserved history; preview again before writing'; end if;
  -- A seed must not modify subscriptions through the cycle_id ON DELETE action.
  if exists (select 1 from public.push_subscriptions s join public.cycles c on c.id = s.cycle_id
    where c.seed_batch is not null and c.is_demo = true) then
    raise exception 'Seeded rows are unexpectedly referenced by notifications; no data changed';
  end if;
  delete from public.cycles where seed_batch is not null and is_demo = true;
  get diagnostics deleted_count = row_count;
  insert into public.cycles(machine_id, started_at, ended_at, is_demo, seed_batch)
    select machine_id, started_at, ended_at, is_demo, seed_batch
    from jsonb_to_recordset(p_rows) as r(machine_id text, started_at timestamptz, ended_at timestamptz, is_demo boolean, seed_batch text);
  get diagnostics inserted_count = row_count;
  return jsonb_build_object('deleted', deleted_count, 'inserted', inserted_count);
end;
$$;
revoke all on function public.queue_cycle_push() from public, anon, authenticated;
grant execute on function public.queue_cycle_push() to service_role;
revoke all on function public.replace_demo_seed(jsonb) from public, anon, authenticated;
grant execute on function public.replace_demo_seed(jsonb) to service_role;
commit;
