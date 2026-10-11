import type { MetadataRoute } from "next";

/**
 * Web app manifest — makes the app installable as a PWA and supplies the theme
 * colour / icons to the browser and OS.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ServiceHub — Local Home Services",
    short_name: "ServiceHub",
    description:
      "Discover, book and review trusted local home-service providers.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#0f172a",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
