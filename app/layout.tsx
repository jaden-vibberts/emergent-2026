import type { Metadata, Viewport } from "next";
import PwaSetup from "./PwaSetup";
import localFont from "next/font/local";
import SpinSenseHeader from "./SpinSenseHeader";
import { BottomWaves } from "./WaterDecor";
import "./globals.css";

const displayFont = localFont({ src: "./fonts/Nunito.ttf", variable: "--font-display", display: "swap", weight: "200 1000" });
const bodyFont = localFont({ src: "./fonts/DMSans.ttf", variable: "--font-body", display: "swap", weight: "100 1000" });

export const metadata: Metadata = {
  title: "SpinSense",
  description: "Live status for your shared laundry room.",
  appleWebApp: { capable: true, title: "SpinSense", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#096B9B" };

// Runs before page content is parsed; storage access may be blocked in private browsers.
const themeInit = `(function(){var t;try{t=localStorage.getItem('spinsense-theme')}catch(e){}if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.content=t==='dark'?'#081824':'#096B9B'})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning className={`${displayFont.variable} ${bodyFont.variable}`}><body><script dangerouslySetInnerHTML={{ __html: themeInit }} /><BottomWaves /><PwaSetup /><SpinSenseHeader />{children}</body></html>;
}
