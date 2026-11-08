"use client";
import { useEffect, useState } from "react";

export default function NotifyButton({ deviceId }: { deviceId: string }) {
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState(false);
  const [secure, setSecure] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  useEffect(() => {
    const display = window.matchMedia("(display-mode: standalone)");
    const update = () => setInstalled(display.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone);
    update(); display.addEventListener("change", update);
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    setSecure(window.isSecureContext);
    setSupported("serviceWorker" in navigator && "PushManager" in window && "Notification" in window);
    setReady(true);
    return () => display.removeEventListener("change", update);
  }, []);

  async function subscribe() {
    if (!publicKey || !supported || !secure || (ios && !installed)) return;
    setBusy(true); setMessage("");
    try {
      // This must be the first async operation: iOS requires a direct button tap.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage(permission === "denied" ? "Notifications are blocked. Allow them in your device’s notification settings, then try again." : "Permission wasn’t granted. Tap again when you’re ready.");
        return;
      }
      let timer: ReturnType<typeof setTimeout>;
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("App setup is still loading. Reload the app and try again.")), 10_000); }),
      ]).finally(() => clearTimeout(timer));
      const padding = "=".repeat((4 - publicKey.length % 4) % 4);
      const decoded = atob((publicKey + padding).replace(/-/g, "+").replace(/_/g, "/"));
      const key = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
      let subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const oldKey = subscription.options.applicationServerKey;
        if (oldKey && Array.from(new Uint8Array(oldKey)).join(",") !== Array.from(key).join(",")) {
          await subscription.unsubscribe(); subscription = null;
        }
      }
      subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const response = await fetch("/api/push", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device: deviceId, subscription: subscription.toJSON() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save notification.");
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not enable notifications. Please try again.");
    } finally { setBusy(false); }
  }
  return <section className="notify-panel" aria-label="Cycle notifications">
    <h2>Know when it’s done</h2><p>Get one notification for the next completed cycle on this machine.</p>
    {ready && ios && !installed && <p className="install-banner">Tap Share, then Add to Home Screen, then open the app from your Home Screen.</p>}
    {ready && !ios && !installed && <p className="helper">For quick access, install Laundry Room using your browser’s “Install app” or “Add to Home Screen” option.</p>}
    {ready && !secure && <p className="install-banner">Open the deployed HTTPS website to enable notifications. A local Wi-Fi address won’t support push.</p>}
    {ready && !supported && !(ios && !installed) && <p className="helper">This browser doesn’t support Web Push. On iPhone, use iOS 16.4 or newer and open the installed app.</p>}
    {!publicKey && <p className="helper">Notifications are being set up.</p>}
    <button className="print-button" disabled={!ready || !supported || !secure || !publicKey || busy || (ios && !installed)} onClick={subscribe}>
      {busy ? "Enabling notification…" : "Notify me when it’s done"}
    </button>
    {message && <p role="status" className="helper">{message}</p>}
  </section>;
}
