-- Run AFTER schema.sql and step2.sql. Safe to rerun.
begin;
alter table public.push_subscriptions
  add column if not exists endpoint_hash text,
  add column if not exists delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'queued', 'sending', 'sent', 'failed')),
  add column if not exists cycle_id uuid references public.cycles(id) on delete set null,
  add column if not exists claimed_at timestamptz,
  add column if not exists last_error text;
create unique index if not exists push_machine_endpoint_idx
  on public.push_subscriptions(machine_id, endpoint_hash);
create index if not exists push_queued_idx
  on public.push_subscriptions(machine_id) where delivery_status = 'queued';
update public.push_subscriptions set delivery_status = 'sent'
  where notified_at is not null and delivery_status = 'pending';

-- Called inside the existing reading transaction when it inserts a finished cycle.
-- The machine_state row is still locked: registering and completing are serialized.
create or replace function public.queue_cycle_push() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.ended_at is not null then
    update public.push_subscriptions set delivery_status = 'queued', cycle_id = new.id
      where machine_id = new.machine_id and delivery_status = 'pending' and notified_at is null;
  end if;
  return new;
end;
$$;
drop trigger if exists queue_cycle_push on public.cycles;
create trigger queue_cycle_push after insert on public.cycles
  for each row execute function public.queue_cycle_push();

create or replace function public.register_machine_push(
  p_machine_id text, p_endpoint_hash text, p_subscription jsonb
) returns text language plpgsql security invoker set search_path = '' as $$
declare result text;
begin
  perform 1 from public.machine_state where machine_id = p_machine_id for update;
  if not found then return 'unknown_device'; end if;
  insert into public.push_subscriptions(machine_id, endpoint_hash, subscription_json)
    values(p_machine_id, p_endpoint_hash, p_subscription)
  on conflict (machine_id, endpoint_hash) do update set
    subscription_json = excluded.subscription_json,
    delivery_status = 'pending', notified_at = null, cycle_id = null,
    claimed_at = null, last_error = null
  where push_subscriptions.delivery_status in ('pending', 'sent', 'failed')
  returning delivery_status into result;
  -- A delivery already queued/in flight must never be re-armed underneath a sender.
  if result is null then
    select delivery_status into result from public.push_subscriptions
      where machine_id = p_machine_id and endpoint_hash = p_endpoint_hash;
  end if;
  return result;
end;
$$;

create or replace function public.claim_machine_push(p_machine_id text)
returns setof public.push_subscriptions
language sql security invoker set search_path = '' as $$
  with candidates as (
    select id from public.push_subscriptions
    where machine_id = p_machine_id and delivery_status = 'queued'
    order by created_at for update skip locked limit 10
  )
  update public.push_subscriptions s set delivery_status = 'sending', claimed_at = now()
  from candidates c where s.id = c.id returning s.*;
$$;
revoke all on function public.queue_cycle_push() from public, anon, authenticated;
revoke all on function public.register_machine_push(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.claim_machine_push(text) from public, anon, authenticated;
grant execute on function public.queue_cycle_push() to service_role;
grant execute on function public.register_machine_push(text, text, jsonb) to service_role;
grant execute on function public.claim_machine_push(text) to service_role;
commit;
