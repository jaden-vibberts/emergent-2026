"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { elapsedLabel, remainingLabel, statusLabels, STATUS_POLL_MS, STALE_AFTER_MS, type MachineView } from "@/lib/status";

export default function LiveMachines({ deviceId }: { deviceId?: string }) {
  const [machines, setMachines] = useState<MachineView[] | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let clockOffset = 0;
    const controller = new AbortController();
    setMachines(null);
    async function poll() {
      try {
        const response = await fetch(`/api/machines${deviceId ? `?device=${encodeURIComponent(deviceId)}` : ""}`, {
          cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
        });
        if (!response.ok) throw new Error("Unable to update");
        const result = await response.json();
        if (!stopped) {
          clockOffset = Date.parse(result.server_time) - Date.now();
          setNow(Date.now() + clockOffset);
          setMachines(result.machines);
          setError("");
        }
      } catch {
        if (!stopped) setError("Connection interrupted. Showing the last saved status; retrying automatically.");
      } finally {
        if (!stopped) timer = setTimeout(poll, STATUS_POLL_MS);
      }
    }
    void poll();
    const clock = setInterval(() => setNow(Date.now() + clockOffset), 1000);
    return () => { stopped = true; controller.abort(); clearTimeout(timer); clearInterval(clock); };
  }, [deviceId]);

  return <>
    <div className="live-line"><span className={`signal ${error ? "signal-warn" : ""}`} />{error ? "Reconnecting" : machines ? "Updates automatically · every 3 seconds" : "Connecting to laundry room…"}</div>
    {error && <p role="alert" className="notice">{error}</p>}
    {!machines && !error && <div className="loading-panel">Loading machine status…</div>}
    {machines?.length === 0 && <div className="loading-panel"><h2>{deviceId ? "Machine not found" : "No machines added yet"}</h2><p>{deviceId ? "Check the QR code or return to all machines." : "Add machines in Supabase to get started."}</p></div>}
    <div className={deviceId ? "detail-grid" : "machine-grid"}>
      {machines?.map((machine) => {
        const stale = !!machine.last_seen && now - Date.parse(machine.last_seen) > STALE_AFTER_MS;
        const known = !!machine.last_seen;
        const estimate = remainingLabel(machine, now);
        const demo = /demo/i.test(machine.name) || /demo/i.test(machine.location);
        return <article key={machine.id} className={`machine-card ${deviceId ? "machine-detail" : ""}`}>
          <div className="card-top"><span className="machine-kind">{machine.id.startsWith("dryer") ? "DRYER" : machine.id.startsWith("washer") ? "WASHER" : "MACHINE"}</span>{demo && <span className="demo-tag">Demo data</span>}</div>
          <h2 className="machine-name">{deviceId ? machine.name : <Link href={`/m/${encodeURIComponent(machine.id)}`}>{machine.name}<span aria-hidden="true" className="card-arrow">↗</span></Link>}</h2>
          <p className="location">{machine.location}</p>
          <div className={`status-block status-${known ? machine.state.toLowerCase() : "unknown"}`}>
            <p className="eyebrow">{stale || error ? "Last known status" : "Machine status"}</p>
            <p className="status-text" role="status">{known ? statusLabels[machine.state] ?? "Unknown" : "Awaiting readings"}</p>
          </div>
          <dl className="machine-facts">
            <div><dt>Time in this state</dt><dd>{known && machine.state_since ? elapsedLabel(now - Date.parse(machine.state_since)) : "—"}</dd></div>
            {machine.state === "IN_USE" && <div><dt>Estimated finish</dt><dd>{error ? "Waiting for connection" : estimate}</dd></div>}
          </dl>
          {machine.state === "IN_USE" && machine.median_seconds === null && <p className="helper">An estimate becomes available after 3 completed cycles.</p>}
          {deviceId && machine.state === "IN_USE" && machine.median_seconds !== null && <p className="helper">Based on the median of {machine.history_count} recent completed cycles. Actual times vary.</p>}
          {stale && <p className="device-note">Device has stopped reporting. Last reading {elapsedLabel(now - Date.parse(machine.last_seen!))} ago.</p>}
          {demo && deviceId && <p className="helper demo-explanation">This machine uses simulated data for testing. It does not indicate real laundry availability.</p>}
        </article>;
      })}
    </div>
  </>;
}
