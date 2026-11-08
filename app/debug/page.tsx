"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { chartData, DEBUG_POLL_MS, type DebugMachine } from "@/lib/debug";
import { elapsedLabel, isOffline, lastSeenLabel } from "@/lib/status";

type Snapshot = { machines: DebugMachine[]; threshold: number; time_scale: number; server_time: string };
const time = (value: string | number) => new Date(value).toISOString().slice(11, 23);

export default function DebugPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(0);
  useEffect(() => {
    let stopped = false;
    let pollTimer: ReturnType<typeof setTimeout>;
    let active: AbortController | undefined;
    let offset = 0;
    async function poll() {
      active = new AbortController();
      const timeout = setTimeout(() => active?.abort(), 10_000);
      try {
        const response = await fetch("/api/debug", { cache: "no-store", signal: active.signal });
        if (!response.ok) throw new Error("Request failed");
        const result: Snapshot = await response.json();
        if (!stopped) {
          offset = Date.parse(result.server_time) - Date.now();
          setSnapshot(result); setNow(Date.now() + offset); setError(false);
        }
      } catch { if (!stopped) setError(true); }
      finally {
        clearTimeout(timeout);
        if (!stopped) pollTimer = setTimeout(poll, DEBUG_POLL_MS);
      }
    }
    void poll();
    const clock = setInterval(() => setNow(Date.now() + offset), 1000);
    return () => { stopped = true; active?.abort(); clearTimeout(pollTimer); clearInterval(clock); };
  }, []);

  return <main className="page-shell">
    <header className="site-header"><Link href="/" className="wordmark">Laundry room<span className="wordmark-dot" /></Link><Link href="/" className="nav-link">← All machines</Link></header>
    <section className="page-heading"><p className="eyebrow">DEVICE DIAGNOSTICS</p><h1>Debug readings</h1><p>Latest 20 readings per machine · updates every 2 seconds · all times UTC.</p></section>
    {snapshot && <p className="debug-config">RUN_THRESHOLD <strong>{snapshot.threshold}</strong> · TIME_SCALE <strong>{snapshot.time_scale}×</strong> · Last successful update {time(snapshot.server_time)} UTC</p>}
    {error && <p role="alert" className="notice">Connection interrupted. Data below may be out of date. Retrying automatically.</p>}
    {!snapshot && !error && <p className="loading-panel">Loading device readings…</p>}
    {snapshot?.machines.length === 0 && <p className="loading-panel">No machines registered.</p>}
    <div className="debug-grid">{snapshot?.machines.map((machine) => {
      const offline = isOffline(machine.last_seen, now);
      const chart = chartData(machine.readings, snapshot.threshold);
      const demo = /demo/i.test(`${machine.name} ${machine.location}`);
      return <article key={machine.id} className={`machine-card debug-card ${offline ? "machine-offline" : ""}`}>
        <div className="card-top"><Link className="machine-name" href={`/m/${encodeURIComponent(machine.id)}`}>{machine.name}</Link>{demo && <span className="demo-tag">Demo data</span>}</div>
        <p className="location">{machine.id} · {machine.location}</p>
        <p className="status-text" role="status">{offline ? "Offline" : "Online"}</p>
        {offline && <p className="offline-note">{lastSeenLabel(machine.last_seen, now)}</p>}
        <dl className="machine-facts">
          <div><dt>Current saved state</dt><dd>{machine.state ?? "No state row"}</dd></div>
          <div><dt>Time in state</dt><dd>{machine.state_since ? elapsedLabel(now - Date.parse(machine.state_since)) : "—"}</dd></div>
          <div><dt>Since last reading</dt><dd>{machine.last_seen ? elapsedLabel(now - Date.parse(machine.last_seen)) : "Never received"}</dd></div>
        </dl>
        {demo && <p className="helper">Demo readings for testing; not real laundry activity.</p>}
        {machine.readings.length ? <>
          <figure className="rms-chart">
            <svg viewBox="0 0 640 195" role="img" aria-label={`Recent RMS readings for ${machine.name}; dashed line is RUN_THRESHOLD ${snapshot.threshold}`}>
              <line x1="50" x2="600" y1="155" y2="155" stroke="#cbd5d1" />
              <line x1="50" x2="50" y1="20" y2="155" stroke="#cbd5d1" />
              <text x="43" y="24" textAnchor="end">{chart.maximum.toFixed(2)}</text><text x="43" y="159" textAnchor="end">0</text>
              <line x1="50" x2="600" y1={chart.thresholdY} y2={chart.thresholdY} stroke="#b48842" strokeDasharray="6 4" />
              <polyline points={chart.points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#245c4c" strokeWidth="2.5" />
              {chart.points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="3" fill="#245c4c" />)}
              <text x="50" y="182">{time(chart.start)}</text><text x="600" y="182" textAnchor="end">{time(chart.end)}</text>
            </svg>
            <figcaption>RMS over time · dashed line: threshold {snapshot.threshold}. Lines join samples; gaps are not measurements.</figcaption>
          </figure>
          <div className="reading-scroll"><table className="reading-table"><caption>Latest readings · newest first</caption><thead><tr><th scope="col">Time (UTC)</th><th scope="col">rms</th><th scope="col">door_open</th></tr></thead><tbody>
            {machine.readings.map((reading) => <tr key={reading.id}><td><time dateTime={reading.created_at} title={reading.created_at}>{time(reading.created_at)}</time></td><td>{reading.rms}</td><td>{String(reading.door_open)}</td></tr>)}
          </tbody></table></div>
        </> : <p className="helper">Send a reading to see its chart and raw values here.</p>}
      </article>;
    })}</div>
    <footer className="site-footer">Change RUN_THRESHOLD in lib/machine-config.ts, then restart locally or redeploy. A short burst alone does not start a cycle.</footer>
  </main>;
}
