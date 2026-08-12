import type { APIRoute } from "astro";
import { resolveTenant, tenantAssets } from "../tenant";

/**
 * Per-tenant web app manifest: the name and icons follow the subdomain,
 * exactly like the rest of the page's identity.
 */
export const GET: APIRoute = ({ request }) => {
  const tenant = resolveTenant(request.headers.get("host"));
  const assets = tenantAssets(tenant.key);
  return new Response(
    JSON.stringify({
      name: tenant.title,
      short_name: tenant.title,
      icons: [
        { src: `${assets}/android-chrome-192x192.png`, sizes: "192x192", type: "image/png" },
        { src: `${assets}/android-chrome-512x512.png`, sizes: "512x512", type: "image/png" },
      ],
      theme_color: tenant.tileColor,
      background_color: tenant.tileColor,
      display: "standalone",
    }),
    { headers: { "Content-Type": "application/manifest+json" } },
  );
};
