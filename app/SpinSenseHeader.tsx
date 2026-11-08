import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

export default function SpinSenseHeader() {
  return <header className="spin-header no-print">
    <div className="header-bubbles" aria-hidden="true">
      <span /><span /><span /><span /><span />
    </div>
    <div className="spin-header-inner">
      <Link href="/" className="spin-brand" aria-label="SpinSense home">
        <svg className="spin-logo" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <rect width="48" height="48" rx="16" fill="currentColor" />
          <path d="M24 8c-3.5 5.6-12 13-12 20a12 12 0 0 0 24 0c0-7-8.5-14.4-12-20Z" fill="var(--color-aqua)" />
          <path d="M14 28c4-5 8 4 13 0s7-2 7 0a10 10 0 0 1-20 0Z" fill="var(--color-foam)" />
          <circle cx="29" cy="23" r="2.3" fill="var(--color-foam)" />
        </svg>
        <span><span className="spin-brand-name">SpinSense</span><span className="spin-brand-caption">A little clarity. A lighter laundry day.</span></span>
      </Link>
      <div className="spin-header-actions"><nav className="spin-nav" aria-label="Main navigation">
        <Link href="/">Machines</Link>
        <Link href="/dashboard">Usage dashboard</Link>
        <Link href="/qr">QR labels <span aria-hidden="true">↗</span></Link>
      </nav><ThemeToggle /></div>
    </div>
    <svg className="header-wave" viewBox="0 0 1440 52" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 18C220 65 370-6 610 19s380 22 560 0 220-2 270 8v25H0Z" fill="var(--color-aqua)" opacity=".18" />
      <path d="M0 29C190 2 350 53 560 32s340-14 540 3 270-24 340-9v26H0Z" fill="var(--color-background)" />
    </svg>
  </header>;
}
