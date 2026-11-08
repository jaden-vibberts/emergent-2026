# SpinSense

**Know when your laundry is done—and when the laundry room is less busy.**

SpinSense is a shared-laundry-room monitor. A small sensor device on each washer or dryer reports movement and whether its door is open. A website turns those readings into a live status board, optional completion notifications, and a dashboard showing typical busy and quiet times.

Residents do not need an account or password. They scan a machine’s QR code to open its page. Building managers and residents use the same public usage dashboard.

Live site: **https://emergent-2026-sf95.vercel.app/**

## What you can do

- **Check availability:** see all machines together, including which are running, finished, likely free, or offline.
- **Follow one machine:** scan its QR code to see its status, time in that state, and an estimated finish time once enough history exists.
- **Get a notification:** tap “Notify me when it’s done” and allow notifications. On an iPhone, install the website using **Share → Add to Home Screen**, then open it from the Home Screen.
- **Find a quieter time:** compare washers and dryers in a weekly heatmap, with suggested quiet two-hour windows and the busiest periods.
- **Print QR labels:** create a label linking directly to each machine’s page.
- **Inspect the sensors:** use the debug page to see recent vibration readings, door readings, and connection freshness.

The interface includes light and dark themes, water-themed machine windows, and mobile-friendly pages. Motion is disabled when the device requests reduced motion. QR labels stay black on white in either theme.

## How it works, from machine to phone

```text
Vibration sensor + door sensor
              ↓
ESP32 sends a reading about every 2 seconds
              ↓
Website server checks the reading and determines the machine’s status
              ↓
Supabase saves the reading, status, and completed-cycle history
              ↓
Live pages update · completion notifications are sent · dashboard shows patterns
```

An **ESP32** is a small Wi-Fi-enabled computer attached to a machine. Its vibration sensor measures how much the machine is shaking; its door sensor reports whether the door is open. It sends a short message like this:

```json
{ "device": "washer-1", "rms": 0.42, "door_open": false }
```

Here, `device` identifies the machine, `rms` measures vibration strength, and `door_open` describes the door. The device sends these messages to `/api/readings`, the website’s receiving address for sensor data.

The server uses a **state machine**: a set of rules for deciding when a machine changes from one status to another. It waits for sustained evidence so a brief bump or a pause during washing does not immediately change the status.

| Status | What it means |
| --- | --- |
| **Idle** | No confirmed cycle is currently running. |
| **In use** | Vibration has stayed above the running threshold for 20 seconds. |
| **Done — clothes probably inside** | The machine has been in use for at least 8 minutes and then continuously quiet for 3 minutes with the door closed. |
| **Likely free** | The door was opened after the machine reached Done. Closing it returns the machine to Idle. |
| **Offline** | No reading has arrived for more than 30 seconds, or none has arrived yet. This display warning does not replace the saved machine state. |

New sustained vibration can start another run. Timing and vibration settings live together in [`lib/machine-config.ts`](lib/machine-config.ts). `TIME_SCALE` can shorten the timing windows for demonstrations; real devices should use normal timing (`1`).

**These are estimates of availability, not proof that a machine is empty.** A door opening does not confirm someone removed their clothes. Missing readings do not count as a completed cycle. Check the machine before loading it.

## Understanding the usage dashboard

The dashboard groups history by the building’s local day and hour, including daylight-saving changes. Its two measurements answer different questions:

- **Utilization:** what share of the washers or dryers was running on average? If one of two washers runs for a whole hour, utilization is 50%.
- **Fully booked:** how often were all machines of that type running at once? With one of two washers running, this is 0%; another washer was still available.

The calculation counts usage minute by minute. Each cell also reports how many distinct weeks contributed observations. Cells with fewer than two weeks are faded to show lower confidence. Suggested laundry windows rank two-hour periods by average utilization.

The color legend adjusts to the selected machine type, metric, and date range. A darker cell means busier **within that view**; read its percentage and legend when comparing different views. In dark mode, brighter aqua indicates busier periods.

Finish-time estimates on individual machine pages are separate: they use the median—the middle value—of up to 20 recent completed cycles, requiring at least three. Until then, the page says “estimating…” instead of inventing a finish time.

## The technical pieces, in plain English

| Technology | Its job in SpinSense |
| --- | --- |
| **Next.js and React** | Build the website’s pages and interactive controls. Next.js also runs the server endpoints that receive readings and fetch data. The project uses its App Router to organize pages by URL. |
| **TypeScript** | JavaScript with checks that help catch mistakes, such as using text where a number is expected, before the app is deployed. |
| **Tailwind CSS, CSS, and SVG** | Control the layout, colors, themes, icons, and lightweight water animations. SVG draws graphics that stay sharp on different screens. |
| **Supabase / PostgreSQL** | The persistent database: the project’s shared memory for machines, readings, states, cycle history, and notification subscriptions. |
| **Vercel** | Hosts the website and runs server code when requests arrive. Because those server processes are temporary, machine state is stored in the database rather than kept in server memory. |
| **PWA (Progressive Web App)** | Lets the website be installed on a phone’s Home Screen without distributing a native app through an app store. |
| **Service worker and Web Push** | A browser-managed background component handles incoming notifications and opens the relevant machine page. Notification permission is requested only after a button tap. |
| **VAPID keys** | A public/private key pair that identifies the application to the push service. The public key goes to browsers; the private key stays on the server. |
| **Luxon** | Handles building-local dates and times so “7pm” means the building’s evening, rather than the hosting server’s time zone. |

Live status pages request updates every three seconds; the debug page updates every two seconds. This is called **polling**—asking the server for fresh information at regular intervals.

Database updates keep a reading, its resulting state, and any completed cycle together. Notification work is also tracked in the database to prevent duplicate sends from simultaneous requests. Push failures are logged; delivery is not guaranteed, and uncertain sends are not automatically retried. Offline machines do not send completion notifications.

## Real hardware and clearly labeled demo data

In the current project setup, **washer-1 is the only real ESP32-connected machine**. Washer-2, dryer-1, and dryer-2 are simulated machines and carry “Demo machine” badges.

The project has two different demonstration tools:

- **Historical demo data** creates realistic-looking past cycles, including evening and weekend peaks. It only writes cycle history: it does not change live readings, machine states, or send notifications. Generated rows are tagged as demo data and grouped into replaceable batches.
- **Live simulation** sends artificial sensor readings through the normal receiving endpoint. The looping live-demo helper only uses the three simulated machines and refuses to use washer-1.

Demo history can include washer-1, but those rows remain separate from its real cycles. Older mixed-source history was marked as demo because its origin could not be established. The dashboard’s **Include demo data** control determines whether demo history is shown, and a banner identifies views that include it. Generated patterns are modeled examples, not measured building behavior.

## Access and configuration

There is no resident or manager login. QR codes are convenient links, not passwords or reservations. Status, dashboard, QR, and debug pages are publicly accessible.

Sensor submissions require a shared device secret in the `x-device-key` request header. Database credentials and private push keys stay on the server and are not sent to the browser. Configuration is supplied through **environment variables**: settings kept separately from source code, in an ignored `.env.local` file locally and in Vercel’s settings when deployed.

Important settings include the database connection, device secret, public website address, push keys, `BUILDING_TIMEZONE`, and `TIME_SCALE`. See [`.env.example`](.env.example) for variable names; never commit real secrets.

## Where to find things

| Location | What it contains |
| --- | --- |
| `app/` | Pages, visual components, and server endpoints in `app/api/`. |
| `lib/stateMachine.ts` | Rules for interpreting readings and changing machine state. |
| `lib/machine-config.ts` | Adjustable vibration threshold and timing windows. |
| `lib/usage.ts` | Dashboard calculations, kept separate from the visual display. |
| `lib/push.ts` | Server-side notification delivery. |
| `supabase/` | SQL files that create and update the database structure. |
| `scripts/` | Sensor simulators, demo-history generation, and push setup tools. |
| `tests/` | Automated checks for state transitions, database behavior, and demo/usage calculations. |
| `public/` | App icons, service-worker files, and other browser assets. |

## Running and working on the project

For an **already configured checkout**, run these commands in the project folder:

```sh
npm install
npm run dev
```

Open **http://localhost:3000**. The app needs its environment settings and an initialized Supabase database; installing dependencies alone does not create them. Use Node.js 22.18 or newer for the TypeScript scripts.

Useful checks:

```sh
npm run typecheck
npm test
npm run build -- --webpack
```

These check TypeScript, run automated tests, and build the production version. They do not deploy the project.

Detailed guides:

- [Deployment and debugging](DEPLOYMENT.md)
- [Home Screen installation and push notifications](PUSH.md)
- [Usage dashboard setup and calculation notes](DASHBOARD.md)
- [Demo history and live simulation](DEMO.md)

The guides follow the project’s original build stages. For a new database, review the SQL files in stage order; do not rerun the initial schema against an existing installation. The production project to use is the one serving **emergent-2026-sf95.vercel.app**.
