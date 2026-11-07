-- Run once after schema.sql and seed.sql. Safe to run again.
begin;
alter table public.machine_state add column if not exists revision integer not null default 0;

-- One transaction: lock, reject stale calculations, insert reading, update state,
-- and record a finished cycle. No machine state lives in a server process.
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
    insert into public.cycles(machine_id, started_at, ended_at)
      values(p_machine_id, new_state.run_started_at, new_state.last_seen);
  end if;
  return true;
end;
$$;
revoke all on function public.save_machine_reading(text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.save_machine_reading(text, integer, jsonb) to service_role;
commit;
