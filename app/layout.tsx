import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Laundry Monitor",
  description: "Live status for your shared laundry room.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
