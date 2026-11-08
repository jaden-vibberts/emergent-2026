"use client";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const system = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setDark(document.documentElement.dataset.theme === "dark");
    const followSystem = () => {
      let saved: string | null = null;
      try { saved = localStorage.getItem("spinsense-theme"); } catch {}
      apply(saved === "dark" || (saved !== "light" && system.matches));
      sync();
    };
    sync();
    system.addEventListener("change", followSystem);
    window.addEventListener("storage", followSystem);
    return () => { system.removeEventListener("change", followSystem); window.removeEventListener("storage", followSystem); };
  }, []);
  function apply(next: boolean) {
    document.documentElement.dataset.theme = next ? "dark" : "light";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next ? "#081824" : "#096B9B");
    setDark(next);
  }
  return <button className="theme-toggle" type="button" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} onClick={() => {
    const next = document.documentElement.dataset.theme !== "dark";
    apply(next);
    try { localStorage.setItem("spinsense-theme", next ? "dark" : "light"); } catch {}
  }}>
    <svg className="theme-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></svg>
    <svg className="theme-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z" /></svg>
  </button>;
}
