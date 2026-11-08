# Laundry Monitor — Step 1

Next.js App Router, TypeScript, Tailwind CSS, and Supabase Postgres. Intended
for Vercel hosting later. This step only sets up the project and database.

## 1. Install Node.js and project dependencies

Install an LTS version of Node.js (22 or newer) from https://nodejs.org/en/download
using the macOS installer. No account or key is needed. Close and reopen Terminal.

The project files are already created in this folder. Run these commands in macOS Terminal:

```sh
cd /Users/jaden/Documents/ChatGPT/emergent-2026
node --version
npm --version
npm install
cp -n .env.example .env.local
```

`npm install` creates package-lock.json; keep that file in Git so future installs
use the same dependency versions. `cp -n` preserves an existing environment file.

For reference ONLY, the equivalent starter command for a NEW empty project is:

```sh
npx create-next-app@latest laundry-monitor --typescript --tailwind --app --use-npm --no-src-dir --import-alias '@/*' --eslint --yes
```

Do not run that command inside this existing project: its files are already here.

## 2. Create your free Supabase project

1. Visit https://supabase.com/dashboard and create a Supabase account, or sign in.
2. Create an organization on the Free plan if asked, then choose **New project**.
3. Name it `laundry-monitor`. Generate a strong database password and save it in
   your password manager. Choose a nearby region and create the project.
4. Wait for the database to finish starting.
5. Find your **Project URL** in the project's **Connect** dialog or
   **Settings → Data API**. Copy it into `SUPABASE_URL` in `.env.local`.
6. Open **Settings → API Keys**. Under **Secret keys**, create or reveal a secret
   key beginning `sb_secret_`. Copy it into `SUPABASE_SECRET_KEY` in `.env.local`.
   Do not use the publishable key for this server-only setup.

Edit `.env.local` in your editor. To open it with TextEdit from Terminal:

```sh
open -a TextEdit .env.local
```

Keep this file as plain text. Never paste your secret key in chat or commit it to
Git. `.gitignore` already excludes it. The database password is not an app
environment variable. No Supabase browser key is needed: the server reads the
database and sends only the machine details to the page.

## 3. Create the tables and seed four machines

1. Open `supabase/schema.sql` in your editor. Copy the entire file.
2. In Supabase, choose **SQL Editor → New query**. Paste it and click **Run**.
   Run this schema once on a new project; it intentionally does not replace
   existing tables.
3. Open `supabase/seed.sql`. Copy it into a second SQL Editor query and click **Run**.
   This is the seed script; no additional program is needed. It is safe to rerun.
4. The results should show `washer-1`, `washer-2`, `dryer-1`, and `dryer-2`.
   You can also open **Table Editor → machines** to see all four rows.

The seed also creates an initial IDLE state row for each machine, with null
sensor readings and last_seen because no device has reported yet. It does not
invent readings, cycles, or subscriptions. All sample machine names and locations
are labeled demo. The page does not claim their IDLE defaults are live availability.

One extra field, `machine_state.vibration_since`, persists the sustained-vibration
timer across serverless requests. `cycles.duration_seconds` is automatically
calculated from its timestamps, and stays null until the cycle ends. RLS is enabled
on all tables with no public policies; only the server's secret key can access them.

## 4. Environment variables for the full project

All values go in `.env.local` beside `package.json`. Later, add these same values
in Vercel's project environment settings, with the deployed HTTPS app URL.
Restart the dev server after editing environment variables.

| Variable | Purpose | Needed now? |
| --- | --- | --- |
| `SUPABASE_URL` | Your project's API URL from Supabase. | Yes |
| `SUPABASE_SECRET_KEY` | Private server key beginning `sb_secret_`; gives database access. | Yes |
| `DEVICE_INGEST_KEY` | Shared secret the ESP32 will send in `x-device-key`. | Before ingestion |
| `TIME_SCALE` | Duration speed multiplier: `1` normal, `22.5` compresses 45 minutes into 2 minutes. | Defaults to `1` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally; your Vercel HTTPS URL later, for QR links. | Supplied in template |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Public Web Push key sent to browsers. | Push step |
| `VAPID_PRIVATE_KEY` | Private partner to the public push key; server only. | Push step |
| `VAPID_SUBJECT` | Push contact such as `mailto:you@example.com`, using your actual email. | Push step |

Generate the device secret locally when ready:

```sh
openssl rand -hex 32
```

Copy its output into `DEVICE_INGEST_KEY`. Later, copy the same value into the
ESP32 configuration. Do not add `NEXT_PUBLIC_` to any private key.

Leave push values blank for now. During the push step, generate the key pair with
`npx web-push generate-vapid-keys`, then copy Public Key and Private Key into the
corresponding variables. This needs no account or paid Apple Developer membership.
A Vercel account will be needed at deployment, not in Step 1.

Thresholds and durations live together in `lib/machine-config.ts`.
`TIME_SCALE` divides durations, not the vibration threshold or database timestamps.
At `22.5`, the 20-second window becomes about 0.89 seconds; with readings every
2 seconds, transitions will occur on a later reading rather than exactly at the
scaled time. The state engine and its ingest authentication are for the next step.

## 5. Test Step 1

In Terminal, from this project folder:

```sh
npm run typecheck
npm run build
npm run dev
```

Keep the last command running and open http://localhost:3000 in your browser.
Expect **Supabase connected · 4 machines found**, two washers, two dryers, and
clear demo labels. Compare with the four rows in Supabase's `machines` table.
Press Control+C in Terminal to stop the server.

If you see a database setup message, check both Supabase values in `.env.local`,
confirm the SQL ran successfully, and restart `npm run dev`. If the connection
works but shows zero machines, run the seed script and refresh.

Stop here and confirm this works before implementing ingestion, notifications,
PWA installation, dashboards, or deployment.

## Step 2 — Ingestion and simulator

The implementation is now in place. No new account or paid service is needed.
Do not rerun schema.sql; apply only this step's update.

### A. Update Supabase

Copy the entire `supabase/step2.sql` file into a new Supabase SQL Editor query
and click Run. It adds a revision counter and a server-only database function.
The function locks the machine row and saves the reading, new state, and any
finished cycle together in one transaction. A stale calculation is retried
against the latest database state. No timers or machine state are kept in memory.

### B. Set the device secret and demo speed

In Terminal, inside this project folder, run:

```sh
openssl rand -hex 32
```

Copy the generated value into `DEVICE_INGEST_KEY` in `.env.local`. If you already
generated and saved a key, keep that existing value. Do not share it in chat.
Also set `TIME_SCALE=22.5` for the demo. Keep `NEXT_PUBLIC_APP_URL=http://localhost:3000`.

Stop the current website with Control+C, then run:

```sh
cd /Users/jaden/Documents/ChatGPT/emergent-2026
npm test
npm run dev
```

Use Node 22.18 or newer for the TypeScript test and simulator commands; the
Node 26 version installed for this project supports them directly. No extra
dependencies are needed for Step 2.

### C. Run the demo in a second Terminal tab

Leave the website running. Open a second Terminal tab and run:

```sh
cd /Users/jaden/Documents/ChatGPT/emergent-2026
npm run simulate -- washer-1
```

You can substitute `washer-2`, `dryer-1`, or `dryer-2`. Use only one simulator
or physical device per machine at a time. The simulator checks that its machine
still has demo labels, and aborts if the server uses a different TIME_SCALE.

It posts fake readings through the real authenticated endpoint, vibrates,
pauses briefly, vibrates again, stops, waits for DONE, then opens the door.
Expect IN_USE → DONE → LIKELY_FREE in about two minutes plus a ten-second
DONE inspection window and network overhead. It reports transitions in Terminal.
The simulated sensor reports faster than a real ESP32 to demonstrate short
scaled windows accurately. It leaves the door open so LIKELY_FREE stays visible.

In Supabase, open Table Editor → machine_state and refresh while it runs.
Watch the row for washer-1. In cycles, expect one new finished row for that
machine. `duration_seconds` records actual elapsed seconds including the quiet
confirmation period, not the unscaled 45-minute simulation label. Refresh the
website to see saved state there too. All seeded machines remain labeled demo.

If an interrupted simulator leaves a machine IN_USE, use another demo machine
for the next attempt. State persists even if you restart the web server.

### Behavior and checks

- `POST /api/readings` requires the exact `x-device-key`. Missing/wrong keys
  return 401; missing server configuration returns 503; malformed readings
  return 400; unregistered machine IDs return 404.
- `lib/stateMachine.ts` is a pure function. `lib/machine-config.ts` contains
  all state thresholds and timing settings. `npm test` runs deterministic
  tests without Supabase or real-time waits.
- IN_USE starts when the sustained-vibration confirmation completes. DONE
  requires both eight minutes since entering IN_USE and three continuous
  quiet minutes with the door closed. These windows may overlap.
- An open door interrupts the quiet window. Opening after DONE produces
  LIKELY_FREE; closing afterward produces IDLE. New sustained vibration
  starts a new run. Exactly-at-threshold readings prove neither running nor quiet.
- A gap longer than ten real seconds resets continuous vibration/quiet
  evidence. Disconnection alone never finishes a cycle. No incoming readings
  means no state transitions; keep sending readings while the machine is quiet.
- A cycle is inserted only on the IN_USE → DONE transition. Repeated quiet
  readings do not create more cycles. Notifications are not part of this step.

To verify authentication without using your secret, run in the second Terminal:

```sh
curl -i -X POST http://localhost:3000/api/readings \
  -H 'Content-Type: application/json' \
  -d '{"device":"washer-1","rms":0.42,"door_open":false}'
```

Expect HTTP 401 and `Invalid device key.` Once this step works, set TIME_SCALE
back to 1 and restart the website before using real laundry cycles.

Stop after verifying the simulator and wait before beginning the next step.

## Step 3 — Live pages and printable QR labels

No SQL changes, new accounts, or new keys are needed. The QR library is installed
in this workspace. If setting up another checkout, run `npm install` there.

Pages:

- `/` lists all machines with live status.
- `/m/washer-1` shows that machine's status, time in state, and estimate.
- `/qr` creates printable labels pointing at each machine's detail page.

Both status pages request fresh data every three seconds, with a one-second
elapsed-time display. Failed requests retry automatically and mark the last
saved status. No browser database key is used. The read-only `/api/machines`
endpoint returns only machine details, status, and a history summary. Device
keys and push subscriptions remain private.

Estimates need at least three completed cycles for the same machine. Until then,
a running machine displays `estimating...`. The estimate uses the median of the
latest twenty completed durations, minus time since the current run began.
Estimates include the quiet confirmation period, matching the stored cycle data.
An overdue run says “Taking longer than usual” rather than claiming it is done.
These are observed elapsed durations, so keep the same TIME_SCALE when comparing
demo runs. Use new machine IDs for real devices so demo history never influences
real estimates. No artificial history has been added to make an estimate appear.

### Test on your phone

1. Connect your Mac and phone to the same Wi-Fi network.
2. In Terminal, run this to find your Mac's Wi-Fi IP address:

```sh
ipconfig getifaddr en0
```

If it prints nothing, find the IP address under macOS System Settings → Wi-Fi →
Details → TCP/IP. An example is `192.168.1.42`; use your actual address below.

3. Edit `.env.local` and set the app URL to that address, including port 3000:

```dotenv
NEXT_PUBLIC_APP_URL=http://192.168.1.42:3000
TIME_SCALE=22.5
```

Keep the existing Supabase and device secrets unchanged. The app URL is not a
secret. It controls printed QR links and the simulator destination.

4. Stop the running website with Control+C. In that same Terminal, run:

```sh
cd /Users/jaden/Documents/ChatGPT/emergent-2026
npm run dev -- --hostname 0.0.0.0 --port 3000
```

5. On your phone, open `http://YOUR_MAC_IP:3000/m/washer-1` in Safari or another
browser. Replace YOUR_MAC_IP with the address from step 2. Do not use localhost
on the phone. Keep the page visible while testing.
6. In a second Terminal tab on your Mac, run:

```sh
cd /Users/jaden/Documents/ChatGPT/emergent-2026
npm run simulate -- washer-1
```

Watch the phone change to In use → Done — clothes probably inside → Likely free
without refreshing. Open the home page too; the machine cards update the same way.
The simulator stops sending after it leaves the door open. After fifteen seconds,
the UI will correctly mark the saved state as last known and say the device has
stopped reporting. This does not undo LIKELY_FREE in the database.

7. On your Mac, open `http://localhost:3000/qr`. Confirm the printed URLs contain
your Mac's Wi-Fi IP. Scan a code with your phone camera and confirm it opens the
matching machine. Click Print labels to print or save as PDF; navigation and
instructions are excluded from the printout.

If your phone cannot connect, confirm both devices are on the same Wi-Fi, the Mac
is awake, and the server is running on port 3000. Allow Node's incoming connection
if macOS requests it. Guest networks may block communication between devices;
use a trusted network that allows it. QR labels using a local IP work only on
that network and may need regenerating if the IP changes. At deployment, replace
NEXT_PUBLIC_APP_URL with the Vercel HTTPS URL and regenerate labels.

This step tests status pages over local Wi-Fi. PWA installation and push
notifications will be handled separately with HTTPS in their own step.

Deployment and debug instructions: [Step 3.5](DEPLOYMENT.md).

PWA and notification setup: [Step 4](PUSH.md).

Usage dashboard setup and calculation notes: [Step 6](DASHBOARD.md).
