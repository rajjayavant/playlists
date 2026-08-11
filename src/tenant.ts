import tenants from "./tenants.json";

export interface Tenant {
  key: string;
  title: string;
  description: string;
  line1: string;
  line2: string;
  tileColor: string;
  youtubeLink: string;
  spotifyLink: string;
}

const DEFAULT_TENANT = "9xm";

/**
 * Resolve the tenant from a request's Host header.
 *
 * `9xm.scenes.wtf` → "9xm"; unknown subdomains → null (the page 404s).
 * Local dev and the bare workers.dev URL fall back to the default tenant so
 * previews always render something.
 */
export function resolveTenant(host: string | null): Tenant | null {
  const hostname = (host ?? "").split(":")[0].toLowerCase();
  const first = hostname.split(".")[0];

  const config = (tenants as Record<string, Omit<Tenant, "key">>)[first];
  if (config) return { key: first, ...config };

  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".workers.dev") ||
    hostname.endsWith(".pages.dev")
  ) {
    const fallback = (tenants as Record<string, Omit<Tenant, "key">>)[DEFAULT_TENANT];
    return { key: DEFAULT_TENANT, ...fallback };
  }

  return null;
}

/** Static asset base for a tenant's images. */
export function tenantAssets(key: string): string {
  return `/tenants/${key}`;
}
