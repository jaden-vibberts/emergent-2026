-- Step 6: run after step4.sql. Safe to rerun without relabeling new real cycles.
begin;
alter table public.machines add column if not exists type text
  check (type in ('washer', 'dryer'));
update public.machines set type = case
  when lower(id) like 'washer%' then 'washer'
  when lower(id) like 'dryer%' then 'dryer'
  when lower(name) like 'washer%' then 'washer'
  when lower(name) like 'dryer%' then 'dryer'
  else null end
where type is null;
-- Fail clearly rather than silently assigning an unknown machine the wrong type.
do $$ begin
  if exists (select 1 from public.machines where type is null) then
    raise exception 'Some machines have unknown prefixes. Set their type to washer or dryer, then rerun.';
  end if;
end $$;
alter table public.machines alter column type set not null;
alter table public.machines add column if not exists is_demo boolean not null default false;
update public.machines set is_demo = (id in ('washer-2', 'dryer-1', 'dryer-2'))
where id in ('washer-1', 'washer-2', 'dryer-1', 'dryer-2');

-- User confirmed legacy history mixes real and simulated runs. Mark ALL old
-- rows demo exactly once, when introducing the column. Later reruns preserve real rows.
do $$ begin
  if not exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cycles' and column_name = 'is_demo') then
    alter table public.cycles add column is_demo boolean not null default false;
    update public.cycles set is_demo = true;
  end if;
end $$;
create index if not exists cycles_started_idx on public.cycles(started_at);

create or replace function public.label_demo_cycle() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if exists(select 1 from public.machines where id = new.machine_id and is_demo) then
    new.is_demo := true;
  end if;
  return new;
end;
$$;
drop trigger if exists label_demo_cycle on public.cycles;
create trigger label_demo_cycle before insert or update on public.cycles
  for each row execute function public.label_demo_cycle();
revoke all on function public.label_demo_cycle() from public, anon, authenticated;
grant execute on function public.label_demo_cycle() to service_role;

create or replace function public.save_machine_reading(
  p_machine_id text, p_expected_revision integer, p_next jsonb
) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  old_state public.machine_state;
  new_state public.machine_state;
begin
  select * into old_state from public.machine_state
    where machine_id = p_machine_id for update;
  if not found then raise exception 'Unknown machine'; end if;
  if old_state.revision <> p_expected_revision then return false; end if;
  new_state := jsonb_populate_record(null::public.machine_state, p_next);
  if new_state.machine_id is distinct from p_machine_id
     or new_state.last_seen is null
     or new_state.last_rms is null or new_state.door_open is null
     or (old_state.last_seen is not null and new_state.last_seen <= old_state.last_seen) then
    raise exception 'Invalid state update';
  end if;

  insert into public.readings(machine_id, rms, door_open, created_at)
    values(p_machine_id, new_state.last_rms, new_state.door_open, new_state.last_seen);

  update public.machine_state set
    state = new_state.state, state_since = new_state.state_since,
    last_seen = new_state.last_seen, last_rms = new_state.last_rms,
    door_open = new_state.door_open, run_started_at = new_state.run_started_at,
    quiet_since = new_state.quiet_since, vibration_since = new_state.vibration_since,
    door_opened_since_done = new_state.door_opened_since_done,
    revision = old_state.revision + 1
  where machine_id = p_machine_id;

  if old_state.state = 'IN_USE' and new_state.state = 'DONE' then
    insert into public.cycles(machine_id, started_at, ended_at, is_demo)
      values(p_machine_id, new_state.run_started_at, new_state.last_seen, coalesce((p_next->>'is_demo')::boolean, false));
  end if;
  return true;
end;
$$;
revoke all on function public.save_machine_reading(text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.save_machine_reading(text, integer, jsonb) to service_role;

commit;
