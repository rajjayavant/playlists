import tenantsFile from "./tenants.json";

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

type TenantConfig = Omit<Tenant, "key">;

// tenants.json is a flat map of tenant key → config, plus one optional
// reserved entry: `"default": "<key>"` naming the fallback tenant. If the
// entry is missing (or names a tenant that doesn't exist) the first tenant
// in the file is the fallback, so a single-tenant file needs no ceremony.
const entries = Object.entries(tenantsFile as Record<string, unknown>);
const configs = new Map<string, TenantConfig>();
let declaredDefault: string | undefined;
for (const [key, value] of entries) {
  if (key === "default") {
    if (typeof value === "string") declaredDefault = value;
    continue;
  }
  configs.set(key, value as TenantConfig);
}

const DEFAULT_KEY =
  declaredDefault && configs.has(declaredDefault)
    ? declaredDefault
    : configs.keys().next().value!;

function toTenant(key: string): Tenant {
  return { key, ...configs.get(key)! };
}

/** The tenant served for any host that doesn't name another tenant. */
export function defaultTenant(): Tenant {
  return toTenant(DEFAULT_KEY);
}

/**
 * Resolve the tenant from a request's Host header.
 *
 * `9xm.scenes.wtf` → the "9xm" tenant. Every other host — apex domains,
 * `www.`, localhost, `*.workers.dev`, anything unrecognized — gets the
 * default tenant. There is deliberately no 404 path: hostnames only reach
 * this code because the operator attached them to the deployment, so the
 * sensible answer for an unmatched host is "serve the main site".
 */
export function resolveTenant(host: string | null): Tenant {
  const hostname = (host ?? "").split(":")[0].toLowerCase();
  const first = hostname.split(".")[0];
  return configs.has(first) ? toTenant(first) : defaultTenant();
}

/** Static asset base for a tenant's images. */
export function tenantAssets(key: string): string {
  return `/tenants/${key}`;
}
