-- DEMO DATA ONLY. Safe to rerun: existing machines/state are not overwritten.
begin;
insert into public.machines (id, name, location) values
  ('washer-1', 'Washer 1 (demo)', 'Demo laundry room'),
  ('washer-2', 'Washer 2 (demo)', 'Demo laundry room'),
  ('dryer-1', 'Dryer 1 (demo)', 'Demo laundry room'),
  ('dryer-2', 'Dryer 2 (demo)', 'Demo laundry room')
on conflict (id) do nothing;

insert into public.machine_state (machine_id)
select id from public.machines
where id in ('washer-1', 'washer-2', 'dryer-1', 'dryer-2')
on conflict (machine_id) do nothing;
commit;

select m.id, m.name, m.location, s.state, s.last_seen
from public.machines m join public.machine_state s on s.machine_id = m.id
where m.id in ('washer-1', 'washer-2', 'dryer-1', 'dryer-2')
order by m.id;
