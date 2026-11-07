import Link from "next/link";
import QRCode from "qrcode";
import { getSupabase } from "@/lib/supabase";
import PrintButton from "./PrintButton";
export const dynamic = "force-dynamic";
export default async function QrPage() {
  try {
    const base = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
    if (!["http:", "https:"].includes(base.protocol)) throw new Error("Invalid URL");
    const { data, error } = await getSupabase().from("machines").select("id, name, location").order("id");
    if (error) throw error;
    const labels = await Promise.all((data ?? []).map(async (machine) => {
      const url = new URL(`/m/${encodeURIComponent(machine.id)}`, base).href;
      return { ...machine, url, qr: await QRCode.toDataURL(url, { width: 600, margin: 4, errorCorrectionLevel: "M" }) };
    }));
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
    return <main className="page-shell qr-page">
      <header className="site-header no-print"><Link className="wordmark" href="/">Laundry room<span className="wordmark-dot" /></Link><Link href="/" className="nav-link">← All machines</Link></header>
      <section className="page-heading no-print"><p className="eyebrow">ROOM SETUP</p><h1>Machine labels</h1><p>Print, cut, and place each label on its matching machine.</p><PrintButton /></section>
      {local && <p className="notice no-print">These codes point to localhost and cannot open on your phone. Set NEXT_PUBLIC_APP_URL to your Mac’s network URL in .env.local and restart before printing. See Step 3 in README.md.</p>}
      {!labels.length && <p>No machines added yet.</p>}
      <div className="qr-grid">{labels.map((machine) => <article className="qr-label" key={machine.id}>
        <p className="eyebrow">LAUNDRY ROOM</p><h2>{machine.name}</h2><p>{machine.location}</p>
        <img src={machine.qr} width="240" height="240" alt={`QR code for ${machine.name}`} />
        <strong>Scan for machine status</strong><a className="qr-url" href={machine.url}>{machine.url}</a>
        {/demo/i.test(`${machine.name} ${machine.location}`) && <span className="demo-tag">Demo data · testing only</span>}
      </article>)}</div>
    </main>;
  } catch {
    return <main className="page-shell"><Link href="/">← All machines</Link><h1 className="mt-8 text-3xl">Could not create labels</h1><p className="mt-4">Check your database settings and NEXT_PUBLIC_APP_URL, then reload this page.</p></main>;
  }
}
