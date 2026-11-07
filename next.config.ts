import type { NextConfig } from "next";

// Allow phone testing through the exact hostname configured for our QR links.
// Next loads .env.local before evaluating this file. No wildcard origins.
const appUrl = process.env.NEXT_PUBLIC_APP_URL;
const nextConfig: NextConfig = {
  allowedDevOrigins: appUrl ? [new URL(appUrl).hostname] : [],
};

export default nextConfig;
