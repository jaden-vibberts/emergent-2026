import { setTimeout as sleep } from "node:timers/promises";
import { MACHINE_CONFIG as config } from "../lib/machine-config.ts";

const device = process.argv[2] ?? "washer-1";
const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const key = process.env.DEVICE_INGEST_KEY;

async function main() {
  if (!key) throw new Error("Set DEVICE_INGEST_KEY in .env.local and restart the website first.");
  if (!["washer-1", "washer-2", "dryer-1", "dryer-2"].includes(device)) {
    throw new Error("Use one of the seeded demo machines: washer-1, washer-2, dryer-1, dryer-2.");
  }
  if (config.DEMO_POLL_MS < 100) throw new Error("For this simulator, use TIME_SCALE between 1 and 50.");
  console.log(`DEMO DATA — ${device}; speed ${config.TIME_SCALE}×; about ${Math.round(config.DEMO_CYCLE_MS / 1000)} seconds.`);
  console.log("This writes simulated readings and a simulated cycle to your database. Keep the demo labels.");
  let previous = "";
  async function send(rms: number, door_open = false) {
    const response = await fetch(new URL("/api/readings", base), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-device-key": key!, "x-demo-data": "true" },
      body: JSON.stringify({ device, rms, door_open }),
      signal: AbortSignal.timeout(10_000),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${result.error ?? "Request failed"}`);
    if (result.time_scale !== config.TIME_SCALE) throw new Error("TIME_SCALE differs from the server. Restart npm run dev after editing .env.local.");
    if (result.state !== previous) {
      console.log(`${new Date().toLocaleTimeString()}  ${previous || "START"} → ${result.state} [demo]`);
      previous = result.state;
    }
    return result.state as string;
  }
  async function phase(label: string, duration: number, rms: number, door = false) {
    console.log(`\n${label} [demo]`);
    const end = Date.now() + duration;
    do {
      await send(rms, door);
      await sleep(config.DEMO_POLL_MS);
    } while (Date.now() < end);
  }
  const initial = await send(0, false);
  if (initial === "IN_USE") throw new Error("This machine already has an active run. Choose another demo machine or let that run finish first.");
  // A previous completed demo may still be DONE; opening/closing makes it idle.
  await send(0, true);
  await send(0, false);
  const runDuration = config.DEMO_CYCLE_MS - config.QUIET_CONFIRM_MS - config.DEMO_PAUSE_MS;
  await phase("Starting and vibrating", runDuration / 2, config.RUN_THRESHOLD * 2.1);
  if (previous !== "IN_USE") throw new Error("The machine did not enter IN_USE.");
  await phase("Brief mid-cycle pause (must stay IN_USE)", config.DEMO_PAUSE_MS, 0);
  if (previous !== "IN_USE") throw new Error("The brief pause unexpectedly finished the cycle.");
  await phase("Vibrating again", runDuration / 2, config.RUN_THRESHOLD * 2.1);
  console.log("\nStopped; waiting for DONE [demo]");
  const deadline = Date.now() + config.QUIET_CONFIRM_MS + config.MIN_RUN_MS + 15_000;
  while (await send(0) !== "DONE") {
    if (Date.now() > deadline) throw new Error("Timed out waiting for DONE. Check server TIME_SCALE and competing devices.");
    await sleep(config.DEMO_POLL_MS);
  }
  // Leave DONE visible long enough to inspect before opening the door.
  await phase("DONE — holding for 10 seconds so you can inspect Supabase", 10_000, 0);
  if (await send(0, true) !== "LIKELY_FREE") throw new Error("Expected LIKELY_FREE after opening the door.");
  console.log("\nDemo complete. Door left open so LIKELY_FREE stays visible in Supabase.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Simulator failed");
  process.exitCode = 1;
});
