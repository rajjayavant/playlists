import type { APIRoute } from "astro";
import { resolveTenant, tenantAssets } from "../tenant";

/**
 * Browsers request /favicon.ico unconditionally, ignoring the <link> tags —
 * redirect that implicit request to the resolved tenant's icon.
 */
export const GET: APIRoute = ({ request }) => {
  const tenant = resolveTenant(request.headers.get("host"));
  if (!tenant) return new Response("Not found", { status: 404 });
  return Response.redirect(
    new URL(`${tenantAssets(tenant.key)}/favicon.ico`, request.url),
    302,
  );
};
