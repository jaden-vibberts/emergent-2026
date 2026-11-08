# Step 7 — Clearly labeled demo history

The history seed is separate from the live devices. It writes only cycles.
It does not send sensor readings, change machine_state, or enqueue pushes.
washer-1 remains the only real machine. This step does not edit the state engine,
real reading endpoint, device key, or timing configuration.

## 1. Apply SQL

Copy all of `supabase/step7.sql` into Supabase → SQL Editor → New query → Run.
Run it after the previous migrations. It adds nullable cycles.seed_batch,
confirms the three simulated machines' demo flags, and leaves washer-1 real.
Older relabeled rows keep seed_batch null.

The notification trigger now immediately ignores rows with a seed_batch;
non-seeded behavior is unchanged. The seed RPC performs replacement/reset in
one transaction and is callable only with the server's secret key. It deletes
only rows with BOTH is_demo=true AND seed_batch IS NOT NULL. Even an accidentally
batch-tagged real row is preserved. A failed validation rolls back everything.
No real or older unbatched cycle is updated or deleted.

## 2. Preview the history

In Terminal:

```sh
cd /Users/jaden/Documents/ChatGPT/emergent-2026
npm run seed:demo
```

This reads your Supabase database using the existing .env.local credentials and
prints counts per machine. It makes NO changes. No new environment variables,
accounts, or keys are needed.

Defaults: six weeks, seed 42, BUILDING_TIMEZONE (America/New_York if unset).
The generator produces closed historical cycles for all four machines,
including demo-only historical rows for washer-1. Each receives is_demo=true
and a seed_batch such as seed-2026-11-07-42.

For a specific seed/period:

```sh
npm run seed:demo -- --weeks 6 --seed 42
```

Randomness is deterministic for the same seed, weeks, end timestamp, timezone,
and preserved history. Since “ending now” changes between invocations, the
preview prints an exact `--now` timestamp you can reuse to reproduce the
identical output. Passing --now is optional; it must not be in the future.

## 3. Write it

After reviewing the counts, run:

```sh
npm run seed:demo -- --weeks 6 --seed 42 --yes
```

To reproduce the exact preview instead of moving the end time, add `--now`
with the timestamp printed by that preview. The script first replaces any
previous seeded demo history in the same transaction, so rerunning doesn't
duplicate batches. Any validation/database error leaves the old data intact.

Arrivals are sparse overnight, light on weekday mornings, heavy on weekday
evenings, and heaviest on weekends. Weekly demand varies. People wait up to
20 minutes for a free machine before abandoning the queue. Washes last 35–60
minutes, dries 45–75 minutes, and most successful washes prompt a dryer arrival
5–30 minutes later. Machines have a 3–8-minute turnaround gap. Queues and fixed
capacity naturally produce fully-booked intervals.

The generator avoids known preserved real/legacy cycles and currently running
machine intervals. The transaction rejects overlap with preserved history if
it changed during generation; preview and run again if that happens. It never
moves or removes real activity to make room for demo data. More preserved
history can therefore reduce seeded counts or soften the intended peaks.

## 4. Deploy the labels and inspect

Run:

```sh
npm test
npm run typecheck
git add .
git commit -m "Add safe modeled demo history and live demo helper"
git push
```

Wait for Vercel Ready. Visit your production `/dashboard`, choose Last 28 days
or All history, and enable Include demo data. Expect evening/weekend peaks,
quieter mornings, “Showing demo data,” and:

“Demo data is modeled on typical dorm laundry patterns, not measured.”

Turn Include demo data off: only real washer-1 cycles count. Demo cycles on
washer-1 are excluded too. There are no real dryers, so the dryer view is empty.
The live board and /debug use machines.is_demo for a “Demo machine” badge on
washer-2 and both dryers. No badge is added to washer-1. Existing names are kept.
Real washer-1's remaining-time estimate excludes all demo history, so seeding
cannot distort its estimate. Historical seeding does not make offline devices
appear online; use the optional live helper if desired.

## 5. Remove only seeded history

Preview the deletion first:

```sh
npm run seed:demo -- --reset
```

Actually delete the seeded demo rows, then exit without generating anything:

```sh
npm run seed:demo -- --reset --yes
```

Real cycles and legacy unbatched demo cycles remain untouched. The reset also
refuses to delete seed rows unexpectedly referenced by a push subscription,
preventing indirect changes to notifications.

## Optional live status demo

Keep .env.local NEXT_PUBLIC_APP_URL set to the production HTTPS URL and
DEVICE_INGEST_KEY set to the current rotated device key. Stop other simulators
for the same demo machine IDs. No local web server is required.

```sh
npm run demo:live
```

It loops washer-2, dryer-1, and dryer-2 with staggered starts. It checks the
server's demo flags before sending and refuses washer-1. To run just one:

```sh
npm run demo:live -- dryer-1
```

Every request uses the normal authenticated /api/readings endpoint and the
x-demo-data header. All phases are logged with the machine ID. A loop lasts
about 14–17 real minutes; initial starts for the dryers are staggered by 3 and
6 minutes. The helper does not multiply these durations by TIME_SCALE or change
that setting. It supports normal or accelerated server settings (TIME_SCALE
at least 1). If your server already uses accelerated thresholds, the server
may recognize DONE earlier during the helper's three-minute quiet phase.

Unlike the HISTORY seed, this optional helper intentionally creates live demo
readings, state changes, and normal non-batched demo cycles; opted-in users can
receive the normal demo completion pushes. Those cycles are not deleted by
seed reset because they have no seed_batch. This is confined to the three
simulated machines. Ctrl+C stops the helper, and the simulated machines show
Offline after about 30 seconds. washer-1's ESP32 keeps working independently.

## Tests

`npm test` includes deterministic generation, no overlaps, safe labeling,
preserved-history avoidance, modeled peaks, and an isolated PostgreSQL test of
replacement/reset. The database test verifies real cycles (even with accidental
batch tags), legacy rows, machine_state, readings, and pending subscriptions
remain unchanged. Tests do not access your real Supabase database.

Stop after confirming dashboard peaks and demo labeling. No further step is
started automatically.
