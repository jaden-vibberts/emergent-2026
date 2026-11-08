import Link from "next/link";
import LiveMachines from "./LiveMachines";
import { WaveDivider, WaveFooter } from "./WaterDecor";
export default function Home() {
  return <main className="page-shell">
    <header className="site-header"><Link href="/" className="wordmark">Laundry room<span className="wordmark-dot" /></Link><nav className="flex flex-wrap justify-end gap-4"><Link href="/dashboard" className="nav-link">Usage dashboard</Link><Link href="/qr" className="nav-link">Print QR labels ↗</Link></nav></header>
    <section className="page-heading"><p className="eyebrow">ROOM OVERVIEW</p><h1>Machines</h1><p>Current status, cycle timing, and availability.</p></section>
    <WaveDivider />
    <LiveMachines />
    <WaveFooter>Door and vibration sensors provide an indication of availability. Check the machine before use.</WaveFooter>
  </main>;
}
