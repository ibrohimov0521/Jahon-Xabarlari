import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_ICON_192, SITE_ICON_512, SITE_NAME, SITE_URL } from "../lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "JX",
    description: SITE_DESCRIPTION,
    start_url: SITE_URL,
    scope: SITE_URL,
    display: "standalone",
    background_color: "#07101f",
    theme_color: "#07132f",
    icons: [
      { src: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { src: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { src: SITE_ICON_192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: SITE_ICON_512, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: SITE_ICON_512, sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
