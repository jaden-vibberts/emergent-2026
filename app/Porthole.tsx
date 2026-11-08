"use client";

import { useId } from "react";

// Decorative only: the adjacent status text remains the accessible source of truth.
export default function Porthole({ status }: { status: string }) {
  const clipId = `porthole-${useId().replace(/:/g, "")}`;
  const running = status === "IN_USE";
  const water = running || status === "DONE";
  return <div className={`porthole porthole-${status.toLowerCase()}`} aria-hidden="true">
    <svg viewBox="0 0 240 240" fill="none" focusable="false">
      <defs><clipPath id={clipId}><circle cx="120" cy="120" r="83" /></clipPath></defs>
      <circle className="porthole-halo" cx="120" cy="120" r="111" />
      <circle className="porthole-rim" cx="120" cy="120" r="98" strokeWidth="2" />
      <circle className="porthole-inset" cx="120" cy="120" r="87" strokeWidth="2" />
      <g clipPath={`url(#${clipId})`}>
        <circle className="porthole-glass" cx="120" cy="120" r="83" />
        {water && <>
          <g className="porthole-water-back"><path d="M-120 124Q-90 108-60 124T0 124T60 124T120 124T180 124T240 124T300 124T360 124V240H-120Z" /></g>
          <g className="porthole-water-front"><path d="M-120 137Q-90 121-60 137T0 137T60 137T120 137T180 137T240 137T300 137T360 137V240H-120Z" /></g>
        </>}
        {running && <g className="porthole-bubbles"><circle cx="78" cy="180" r="5" /><circle cx="156" cy="175" r="3" /><circle cx="137" cy="195" r="6" /></g>}
        <path className="porthole-reflection" d="M58 110a64 64 0 0 1 38-49" strokeWidth="7" strokeLinecap="round" />
        <g className="porthole-glyph" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          {status === "IN_USE" ? <><path d="M104 104a20 20 0 0 1 34 8m0-10v10h-10" /><path d="M136 132a20 20 0 0 1-34-8m0 10v-10h10" /></>
            : status === "DONE" ? <><path d="M107 122v-11a13 13 0 0 1 26 0v11l5 7h-36l5-7Z" /><path d="M116 137h8m-4-44v4" /></>
            : status === "LIKELY_FREE" ? <path d="m103 120 11 11 24-25" />
            : status === "OFFLINE" ? <><circle cx="120" cy="120" r="20" /><path d="m106 106 28 28" /></>
            : status === "IDLE" ? <><path d="M113 106v28m14-28v28" /></>
            : <><path d="M113 111a8 8 0 1 1 12 7c-4 2-5 3-5 7" /><path d="M120 133v1" /></>}
        </g>
      </g>
      <g className="porthole-fasteners"><circle cx="120" cy="28" r="2" /><circle cx="212" cy="120" r="2" /><circle cx="120" cy="212" r="2" /><circle cx="28" cy="120" r="2" /></g>
    </svg>
  </div>;
}
