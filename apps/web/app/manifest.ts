import type { MetadataRoute } from "next";

// PWA web app manifest. A benefits tool people add to a phone home screen
// deserves a real name and icon rather than a URL and a screenshot. White
// ground matches the product and the per-page themeColor. Next serves this at
// /manifest.webmanifest and auto-links it from every page.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Demeter — verified SNAP answers",
    short_name: "Demeter",
    description:
      "Ask about SNAP food benefits and get answers grounded in your state's own rules, with the source attached. Free, no account.",
    start_url: "/screen/ask",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#FFFFFF",
    icons: [
      { src: "/demeter-wheat-mark.png", sizes: "192x192", type: "image/png" },
      { src: "/demeter-wheat-mark.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
