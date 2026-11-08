import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "Laundry Room", short_name: "Laundry", description: "Live laundry status and cycle notifications.",
    start_url: "/", scope: "/", display: "standalone", background_color: "#f5f6f2", theme_color: "#245c4c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
