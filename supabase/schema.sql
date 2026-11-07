-- Run once in a NEW Supabase project's SQL Editor.
-- All timestamps represent real UTC instants, even with TIME_SCALE enabled.
begin;

create table public.machines (
  id text primary key,
  name text not null,
  location text not null,
  created_at timestamptz not null default now()
);

create table public.machine_state (
  machine_id text primary key references public.machines(id) on delete cascade,
  state text not null default 'IDLE'
    check (state in ('IDLE', 'IN_USE', 'DONE', 'LIKELY_FREE')),
  state_since timestamptz not null default now(),
  last_seen timestamptz,
  last_rms double precision check (last_rms >= 0 and last_rms < 'Infinity'::double precision),
  door_open boolean,
  run_started_at timestamptz,
  quiet_since timestamptz,
  door_opened_since_done boolean not null default false,
  -- Required to persist the 20-second sustained-vibration candidate window.
  vibration_since timestamptz
);

create table public.cycles (
  id uuid primary key default gen_random_uuid(),
  machine_id text not null references public.machines(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds double precision generated always as
    (extract(epoch from (ended_at - started_at))::double precision) stored,
  check (ended_at is null or ended_at >= started_at)
);
create index cycles_machine_started_idx on public.cycles(machine_id, started_at desc);
create unique index cycles_one_open_per_machine on public.cycles(machine_id) where ended_at is null;

create table public.readings (
  id bigint generated always as identity primary key,
  machine_id text not null references public.machines(id) on delete cascade,
  rms double precision not null check (rms >= 0 and rms < 'Infinity'::double precision),
  door_open boolean not null,
  created_at timestamptz not null default now()
);
create index readings_machine_created_idx on public.readings(machine_id, created_at desc);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  machine_id text not null references public.machines(id) on delete cascade,
  subscription_json jsonb not null check (jsonb_typeof(subscription_json) = 'object'),
  created_at timestamptz not null default now(),
  notified_at timestamptz
);
create index push_subscriptions_pending_idx on public.push_subscriptions(machine_id) where notified_at is null;

-- Browsers cannot read or write these tables directly. The Next.js server
-- uses the secret key; future API routes must validate every request.
alter table public.machines enable row level security;
alter table public.machine_state enable row level security;
alter table public.cycles enable row level security;
alter table public.readings enable row level security;
alter table public.push_subscriptions enable row level security;

revoke all on table public.machines, public.machine_state, public.cycles,
  public.readings, public.push_subscriptions from anon, authenticated;
revoke all on sequence public.readings_id_seq from anon, authenticated;
grant all on table public.machines, public.machine_state, public.cycles,
  public.readings, public.push_subscriptions to service_role;
grant usage, select on sequence public.readings_id_seq to service_role;

commit;
