import type { ReactNode } from "react";

// Decorative SVGs only: no state, events, or data dependencies.
export function BottomWaves() {
  return <div className="bottom-waves" aria-hidden="true">
    <svg viewBox="0 0 1440 160" preserveAspectRatio="none">
      <path className="bottom-wave-back" d="M-720 50Q-540 0-360 50T0 50T360 50T720 50T1080 50T1440 50T1800 50T2160 50V200H-720Z" />
      <path className="bottom-wave-front" d="M-720 95Q-540 45-360 95T0 95T360 95T720 95T1080 95T1440 95T1800 95T2160 95V200H-720Z" />
    </svg>
  </div>;
}

export function WaveDivider() {
  return <div className="wave-divider" aria-hidden="true"><svg viewBox="0 0 1000 32" preserveAspectRatio="none">
    <path d="M0 14Q125 0 250 14T500 14T750 14T1000 14L1000 32L0 32Z" />
  </svg></div>;
}

export function WaveFooter({ children }: { children: ReactNode }) {
  return <footer className="water-footer">
    <svg className="footer-wave" viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true"><path d="M0 20Q125 0 250 20T500 20T750 20T1000 20V40H0Z" /></svg>
    <div className="footer-bubbles" aria-hidden="true"><span /><span /><span /></div>
    <div className="water-footer-copy">{children}</div>
  </footer>;
}
