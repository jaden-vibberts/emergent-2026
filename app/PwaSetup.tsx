"use client";
import { useEffect } from "react";
export default function PwaSetup() {
  useEffect(() => {
    if (window.isSecureContext && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
        console.error("Service worker registration failed. Reload the HTTPS app and try again.");
      });
    }
  }, []);
  return null;
}
