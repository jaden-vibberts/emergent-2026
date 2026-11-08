import Link from "next/link";
import LiveMachines from "../../LiveMachines";
import NotifyButton from "../../NotifyButton";
import { WaveDivider, WaveFooter } from "../../WaterDecor";
export default async function MachinePage({ params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await params;
  return <main className="page-shell detail-shell">
    <header className="site-header"><Link href="/" className="wordmark">Laundry room<span className="wordmark-dot" /></Link><Link href="/" className="nav-link">← All machines</Link></header>
    <section className="page-heading"><p className="eyebrow">MACHINE STATUS</p><h1>Machine details</h1><p>You can leave this page open. Status updates automatically.</p></section>
    <WaveDivider />
    <LiveMachines deviceId={deviceId} />
    <WaveDivider />
    <NotifyButton deviceId={deviceId} />
    <WaveFooter>“Likely free” means the door was opened after the cycle ended. Check inside before loading.</WaveFooter>
  </main>;
}
