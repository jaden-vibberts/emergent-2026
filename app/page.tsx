import Link from "next/link";
import LiveMachines from "./LiveMachines";
export default function Home() {
  return <main className="page-shell">
    <header className="site-header"><Link href="/" className="wordmark">Laundry room<span className="wordmark-dot" /></Link><Link href="/qr" className="nav-link">Print QR labels ↗</Link></header>
    <section className="page-heading"><p className="eyebrow">ROOM OVERVIEW</p><h1>Machines</h1><p>Current status, cycle timing, and availability.</p></section>
    <LiveMachines />
    <footer className="site-footer">Door and vibration sensors provide an indication of availability. Check the machine before use.</footer>
  </main>;
}
