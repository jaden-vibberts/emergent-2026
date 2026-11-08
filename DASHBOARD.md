# Step 6 — Usage dashboard

Open `/dashboard` for a public, no-login view of typical busy/free times. The
Supabase secret stays in server-only code; the browser receives only computed
usage buckets, recommendations, and aggregate live counts. No charting service
or new account is used. Luxon handles the building's local clock.

## Apply the SQL

Copy all of `supabase/step6.sql` into Supabase → SQL Editor → New query and Run.
It adds machines.type (washer/dryer), machines.is_demo, and cycles.is_demo.
Machine type is backfilled from id prefixes, then name prefixes. Unknown types
cause a clear error instead of a guess. New machines must have a type specified.
Do not rerun the old Step 1 seed script after this migration.

As explicitly requested:

- ALL existing cycles are labeled demo once, since old source data is ambiguous.
- washer-2, dryer-1, and dryer-2 have machines.is_demo=true. A database trigger
  forces their cycles to be demo, even if a caller attempts is_demo=false.
- washer-1 has machines.is_demo=false. New physical-device cycles are real.
- Explicit simulator requests (x-demo-data: true) still produce demo cycles on
  washer-1. Fake readings sent manually must include that header too.
- Rerunning the migration does NOT relabel new real cycles as demo.

This does not delete readings, reset machine state, change thresholds, or alter
notification behavior. Machine display names are retained; the dashboard uses
the new flags, not the word “demo” in a name, to classify data.

## Set the building timezone

In Vercel → project → Settings → Environment Variables, add for **Production**:

```dotenv
BUILDING_TIMEZONE=America/New_York
```

That is also the default and has been added to your local `.env.local`. Use the
building's IANA timezone if it is elsewhere. No key or account is required.
Redeploy after changing it. Day/hour grouping, date-range subtraction, and the
“right now” comparison all use this timezone, not Vercel's UTC clock.

## Test and deploy

From the project folder:

```sh
npm test
npm run typecheck
npm run build -- --webpack
```

New tests cover Tuesday 2–3pm by hand, midnight, both daylight-saving transitions,
open cycles, two-machine capacity, demo filtering, overlapping same-machine
records, distinct weeks, rankings, and migration idempotence/demo enforcement.
Postgres tests use an isolated test engine and do not touch Supabase.

Push changes when ready:

```sh
git add .
git commit -m "Add timezone-aware laundry usage dashboard"
git push
```

Once Vercel shows Ready, visit your deployed `/dashboard`.

1. Switch Washers/Dryers. With demo off, only washer-1 is included; there are
   no real dryers configured yet, so Dryers correctly shows an empty state.
2. Turn Include demo data on to include all four machines and legacy history.
   If included output contains demo history or demo live readings, the page
   shows “Showing demo data.” No synthetic history was created in this step.
3. Change 7/14/28 days or All history. The selected interval ends now, and is
   clipped to when the included inventory/history first existed.
4. Switch Utilization/Fully booked. Hover or tap cells for percent, number of
   sampled minutes, and distinct weeks. Faded cells have fewer than two weeks.
5. Inspect the best/busiest window cards and the templated insights. Sparse
   real history will mostly be empty until new real cycles complete. Step 7
   can add clearly labeled demo history.

## Calculation conventions

`computeUsage` in lib/usage.ts is independent of the database/UI. It takes
cycles, counts per type, start/end, timezone, includeDemo, and an optional now
for deterministic tests. It returns plain JSON with 168 buckets for each type,
ranked two-hour windows, and insights.

Cycles use [start,end) intervals. Null ended_at uses now; intervals are clipped
to the selected range and now. The algorithm samples occupancy at each UTC
minute boundary. Sub-minute activity may be missed; this is deliberately a
one-minute approximation, particularly visible in accelerated two-minute demos.
Overlapping intervals for one machine are merged before counting. Temporary
per-minute arrays are calculation inputs only, not serverless machine state.

For a bucket:

- Utilization = running machine-minute samples / (included machines × sampled
  minutes in that local weekday/hour) × 100.
- Fully booked = minutes where all included machines run / sampled minutes × 100.
- Sample size = distinct ISO week-year/week pairs with minutes in the bucket.

The fall-back repeated hour contributes 120 minutes; a skipped spring-forward
hour contributes none. No capacity yields null, not a misleading zero.
Zero cycles yields an empty UI state, even though the arithmetic has zero usage.
A type needs at least one valid overlapping cycle to show a pattern. Two weeks
per bucket are recommended; fewer weeks are shown as low confidence.

Two-hour rankings consider hourly starts from 8am through 9pm (ending no later
than 11pm). Both hour buckets need at least 60 sampled minutes. Rates combine
minute totals, rather than averaging percentages with unequal denominators.
Rankings always use utilization, even when viewing the fully-booked heatmap.
Ties use weekday/hour order for stable display, without an additional preference.
Neighboring ranked windows may overlap.

Machine totals are constant over the chosen range. The data has no inventory
history or sensor uptime log, so the dashboard assumes complete cycle recording.
It cannot distinguish unrecorded use from genuine idle time. It does not infer
free-machine guarantees from a historical average.

Historical charts use stored cycles, including any open cycle rows. Existing
ingestion writes a cycle upon completion, so a current unfinished run normally
appears in the Right now strip before it appears in history. Right now reads
machine_state and refreshes every 30 seconds; if fresh data isn't available for
all included machines of a type, it says the live count is unavailable rather
than treating missing readings as idle. This is an aggregate data-availability
message, not a machine health dashboard. A difference within 10 percentage
points of the selected history's local day/hour average is “About normal.”

Stop after confirming the controls and empty/demo states work. Do not add Step 7
history until requested.
