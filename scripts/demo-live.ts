import { setTimeout as sleep } from "node:timers/promises";
const allowed = ["washer-2", "dryer-1", "dryer-2"];
const requested = process.argv.slice(2);
const devices = requested.length ? requested : allowed;
const stop = new AbortController();
process.on("SIGINT", () => stop.abort());
process.on("SIGTERM", () => stop.abort());

async function main() {
  if (devices.some((id) => !allowed.includes(id)) || new Set(devices).size !== devices.length) {
    throw new Error("Refusing: only washer-2, dryer-1, dryer-2 are allowed, once each. NEVER washer-1.");
  }
  const base = process.env.NEXT_PUBLIC_APP_URL;
  const key = process.env.DEVICE_INGEST_KEY;
  if (!base || !key) throw new Error("Set deployed NEXT_PUBLIC_APP_URL and DEVICE_INGEST_KEY in .env.local.");
  if (new URL(base).protocol !== "https:") throw new Error("Use your deployed HTTPS URL for demo:live.");
  const response = await fetch(new URL("/api/debug", base), { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error("Could not inspect deployed configuration; no readings sent.");
  const config = await response.json();
  if (!Number.isFinite(config.threshold) || config.threshold <= 0 || !Number.isFinite(config.time_scale) || config.time_scale < 1) {
    throw new Error("This helper supports the normal or accelerated server settings (TIME_SCALE >= 1); it will not change configuration.");
  }
  for (const id of devices) if (!config.machines.some((m: { id: string; is_demo: boolean }) => m.id === id && m.is_demo)) {
    throw new Error(`${id} is not confirmed as a demo machine. Apply step7.sql and deploy the badge changes first.`);
  }
  console.log(`LIVE DEMO ONLY: ${devices.join(", ")}. Real wall-clock phases; server TIME_SCALE stays ${config.time_scale}. Ctrl+C stops all.`);
  async function send(device: string, rms: number, door_open: boolean) {
    if (!allowed.includes(device)) throw new Error("Refusing non-demo device");
    const result = await fetch(new URL("/api/readings", base), {
      method: "POST", headers: { "Content-Type": "application/json", "x-device-key": key!, "x-demo-data": "true" },
      body: JSON.stringify({ device, rms, door_open }), signal: AbortSignal.any([stop.signal, AbortSignal.timeout(10_000)]),
    });
    const body = await result.json();
    if (!result.ok) throw new Error(`${device}: HTTP ${result.status}: ${body.error ?? "Reading rejected"}`);
  }
  async function phase(device: string, label: string, minutes: number, rms: number, door = false) {
    console.log(`[DEMO] ${device}: ${label} (${minutes} real minutes)`);
    const until = Date.now() + minutes * 60_000;
    do { await send(device, rms, door); await sleep(2000, undefined, { signal: stop.signal }); }
    while (Date.now() < until && !stop.signal.aborted);
  }
  try {
    await Promise.all(devices.map(async (device) => {
      const index = allowed.indexOf(device);
      if (index > 0) await phase(device, "Idle / staggered start", index * 3, 0);
      while (!stop.signal.aborted) {
        await phase(device, "In use / vibrating", 9 + index, config.threshold * 2.1);
        await phase(device, "Stopped / quiet confirmation", 3.1, 0);
        await phase(device, "Done / clothes inside", 0.5, 0);
        await phase(device, "Likely free / door open", 0.75, 0, true);
        await phase(device, "Idle / door closed", 1, 0);
      }
    }));
  } finally { stop.abort(); }
}
main().catch((error) => {
  if (error instanceof Error && error.name === "AbortError") console.log("Live demo stopped.");
  else { console.error(error instanceof Error ? error.message : "Live demo failed"); process.exitCode = 1; }
});
