import type { Metadata, Viewport } from "next";
import PwaSetup from "./PwaSetup";
import "./globals.css";

export const metadata: Metadata = {
  title: "Laundry Monitor",
  description: "Live status for your shared laundry room.",
  appleWebApp: { capable: true, title: "Laundry", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#245c4c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><PwaSetup />{children}</body></html>;
}
