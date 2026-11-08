"use client";
import { useEffect, useState, useTransition, type CSSProperties } from "react";
import { heatmapColor, heatmapRange, heatmapPosition, heatmapGradient, rangeLabel } from "./heatmapColors";
import { useRouter } from "next/navigation";
import type { DashboardData } from "@/lib/dashboard";
import type { MachineType, UsageWindow } from "@/lib/usage";
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const hour = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
const percent = (n: number) => `${Math.round(n)}%`;

export default function Dashboard({ data }: { data: DashboardData }) {
  const [type, setType] = useState<MachineType>("washer");
  const [metric, setMetric] = useState<"utilization" | "fully_booked">("utilization");
  const [selected, setSelected] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  useEffect(() => { const timer = setInterval(() => router.refresh(), 30_000); return () => clearInterval(timer); }, [router]);
  function change(range: string, demo: boolean) { startTransition(() => router.push(`/dashboard?range=${range}&demo=${demo ? "1" : "0"}`, { scroll: false })); }
  const stats = data.usage.types[type];
  const hasData = stats.has_data && stats.total > 0;
  const colorRange = heatmapRange(hasData ? stats.buckets.map((bucket) => bucket[metric]) : []);
  const detail = selected === null ? null : stats.buckets[selected];
  const metricLabel = metric === "utilization" ? "Utilization" : "Fully booked";
  function windows(title: string, entries: UsageWindow[]) {
    return <section className="usage-card usage-window-card p-6"><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-xs text-slate-500">Two-hour windows · ranked by utilization</p>
      {entries.length ? <ol className="mt-5 divide-y divide-slate-100">{entries.map((window) => <li key={`${window.day}-${window.start_hour}`} className="flex items-start justify-between gap-4 py-3">
        <div><p className="text-sm font-semibold">{days[window.day - 1]} · {hour(window.start_hour)}–{hour(window.end_hour)}</p><p className="mt-1 text-xs text-slate-500">Fully booked {percent(window.fully_booked)} · {window.weeks} {window.weeks === 1 ? "week" : "weeks"}{window.weeks < 2 ? " · low confidence" : ""}</p></div><span className="whitespace-nowrap text-sm font-semibold">{percent(window.utilization)} busy</span>
      </li>)}</ol> : <p className="mt-5 text-sm text-slate-500">Need cycle history and two complete adjacent daytime hours to rank windows.</p>}
    </section>;
  }
  return <div className="usage-dashboard">
    <section className="page-heading"><p className="eyebrow">ROOM USAGE</p><h1>Find a quieter time</h1><p>Patterns in {data.usage.timezone} · updated {data.updated}</p></section>
    {data.demoShown && <p role="status" className="notice usage-demo font-semibold">Showing demo data</p>}
    <div className="usage-controls mb-6 flex flex-wrap items-center gap-x-7 gap-y-4 p-4" aria-busy={pending}>
      <div className="usage-segment" aria-label="Machine type">{(["washer", "dryer"] as MachineType[]).map((value) => <button key={value} aria-pressed={type === value} onClick={() => setType(value)} className="usage-toggle">{value === "washer" ? "Washers" : "Dryers"}</button>)}</div>
      <label className="text-sm">Date range <select className="usage-select ml-2" value={data.range} onChange={(e) => change(e.target.value, data.includeDemo)} disabled={pending}><option value="7">Last 7 days</option><option value="14">Last 14 days</option><option value="28">Last 28 days</option><option value="all">All history</option></select></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={data.includeDemo} disabled={pending} onChange={(e) => change(data.range, e.target.checked)} />Include demo data</label>
      {pending && <span role="status" className="text-xs text-slate-500">Updating…</span>}
    </div>
    <section aria-label="Right now" className="mb-6 grid gap-3 sm:grid-cols-2">{data.live.map((item) => <div key={item.type} className="usage-card usage-live-card p-5"><p className="eyebrow">{item.type === "washer" ? "WASHERS" : "DRYERS"} · RIGHT NOW</p><p className="mt-3 text-2xl font-semibold">{item.running === null ? "—" : item.running} <span className="text-sm font-normal text-slate-500">of {item.total} running</span></p><p className="mt-2 text-sm">{item.comparison}</p>{item.typical !== null && <p className="mt-1 text-xs text-slate-500">Typical for this day/hour: {percent(item.typical)}{item.weeks < 2 ? " · low confidence" : ""}</p>}</div>)}</section>
    {!hasData && <div className="notice"><h2 className="font-semibold">Not enough {type === "washer" ? "washer" : "dryer"} history yet</h2><p className="mt-2 text-sm">{stats.total === 0 ? "No machines of this type are included. Enable demo data to include the demo machines." : "At least one valid cycle in this range is needed to show a pattern. Two weeks of observations are recommended for each time slot."}</p></div>}
    <section className="usage-card usage-heatmap p-5 sm:p-6" aria-label="Weekly heatmap">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Typical weekly usage</h2><p className="mt-1 text-xs text-slate-500">{metric === "utilization" ? "Average share of machines running" : "Share of minutes when every machine is running"}</p></div><div className="usage-segment">{(["utilization", "fully_booked"] as const).map((value) => <button key={value} aria-pressed={metric === value} onClick={() => setMetric(value)} className={`usage-toggle ${value === "fully_booked" ? "usage-fully-booked" : ""}`}>{value === "utilization" ? "Utilization" : "Fully booked"}</button>)}</div></div>
      <div className="overflow-x-auto pb-2"><div className="grid min-w-[760px] gap-1" style={{ gridTemplateColumns: "64px repeat(24, minmax(0, 1fr))" }}>
        <span /><>{Array.from({ length: 24 }, (_, h) => <span key={h} className="pb-2 text-center text-[10px] text-slate-500">{hour(h)}</span>)}</>
        {days.map((day, index) => <div key={day} className="contents"><span className="self-center text-xs font-medium">{day.slice(0, 3)}</span>{stats.buckets.slice(index * 24, index * 24 + 24).map((bucket) => {
          const value = hasData ? bucket[metric] : null;
          const position = value !== null && colorRange ? heatmapPosition(value, colorRange) : 0;
          const lightColor = heatmapColor(position, bucket.weeks < 2);
          const darkColor = heatmapColor(position, bucket.weeks < 2, true);
          const label = `${day} ${hour(bucket.hour)}–${hour(bucket.hour + 1)}: ${value === null ? "No data" : `${percent(value)} ${metricLabel.toLowerCase()}`}; ${bucket.weeks} weeks${bucket.weeks < 2 ? "; low confidence" : ""}`;
          return <button key={bucket.hour} aria-label={label} title={label} onClick={() => setSelected(index * 24 + bucket.hour)} style={{ "--heat-light": lightColor.backgroundColor, "--heat-light-text": lightColor.color, "--heat-dark": darkColor.backgroundColor, "--heat-dark-text": darkColor.color, transitionDelay: `${bucket.hour * 12}ms` } as CSSProperties} className={`heat-cell h-9 text-[10px] ${value === null ? "heat-empty" : ""} ${selected === index * 24 + bucket.hour ? "heat-selected" : ""}`}>{value === null ? "—" : Math.round(value)}</button>;
        })}</div>)}
      </div></div>
      <p role="status" className="usage-cell-detail mt-4 min-h-10 text-sm">{detail ? `${days[detail.day - 1]} ${hour(detail.hour)}–${hour(detail.hour + 1)} · ${hasData && detail[metric] !== null ? `${percent(detail[metric]!)} ${metricLabel.toLowerCase()}` : "No data"} · ${hasData ? detail.weeks : 0} distinct weeks · ${detail.minutes} sampled minutes${detail.weeks < 2 ? " · low confidence" : ""}` : "Hover or tap a cell to inspect the percentage and sample size."}</p>
      <div className="heat-legend mt-4 text-xs text-slate-600">
        {colorRange ? <div className="heat-legend-scale"><div className="flex justify-between gap-4"><span>Lower · {rangeLabel(colorRange.min)}</span><span>Higher · {rangeLabel(colorRange.max)}</span></div><div className="heat-gradient" style={{ "--gradient-light": heatmapGradient(colorRange), "--gradient-dark": heatmapGradient(colorRange, true) } as CSSProperties} role="img" aria-label={`${metricLabel} color scale: ${rangeLabel(colorRange.min)} to ${rangeLabel(colorRange.max)}`} /><p className="mt-2">{metricLabel} · color range for this machine type and date range{colorRange.min === colorRange.max ? " · all measured cells have the same value" : ""}.</p></div> : <p>No measured values to color yet.</p>}
        <span className="heat-empty rounded px-2 py-1">— No data</span>
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">Faded cells have fewer than 2 distinct weeks and are low confidence. Percentages use one-minute samples; repeated daylight-saving hours are both counted. Missing spring-forward hours contribute no minutes.</p>
      {data.demoShown && <p className="usage-demo-note mt-2 text-xs leading-5">Demo data is modeled on typical dorm laundry patterns, not measured.</p>}
    </section>
    <div className="mt-6 grid gap-5 lg:grid-cols-2">{windows("Best times to do laundry", stats.quietest)}{windows("Busiest times", stats.busiest)}</div>
    <section className="usage-card usage-insights mt-6 p-6"><h2 className="text-lg font-semibold">Insights</h2>{stats.insights.length ? stats.insights.map((text) => <p key={text} className="mt-3 text-sm leading-6 text-slate-600">{text}</p>) : <p className="mt-3 text-sm text-slate-500">Insights will appear once there is enough cycle history to compare daytime windows.</p>}</section>
    <p className="mt-5 text-xs leading-5 text-slate-500">History begins when included machines were added, or earlier if historical cycles exist. Calculations assume complete cycle logging and a constant inventory across the range. Unrecorded loads cannot be distinguished from idle time. Right now refreshes every 30 seconds; comparisons within 10 percentage points are “About normal.”</p>
  </div>;
}
