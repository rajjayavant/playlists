import { defaultTenant } from "./tenant";

export interface Track {
  id: string;
  youtubeId: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  previewUrl: string | null;
  rawTitle: string;
}

// Every src/tracks/*.json is bundled at build time and keyed by filename —
// dropping in sunset.json makes the "sunset" tenant's catalog exist, no
// registration step. Generate a catalog with:  npm run tracks <key> <url>
const modules = import.meta.glob<{ default: Track[] }>("./tracks/*.json", {
  eager: true,
});

const CATALOGS = new Map<string, Track[]>();
for (const [path, mod] of Object.entries(modules)) {
  const key = path.split("/").pop()!.replace(/\.json$/, "");
  CATALOGS.set(key, mod.default);
}

/**
 * Catalog for a tenant. A tenant without a catalog file plays the default
 * tenant's tracks (with a logged warning) rather than breaking the page.
 */
export function tracksFor(tenantKey: string): Track[] {
  const own = CATALOGS.get(tenantKey);
  if (own) return own;
  console.warn(
    `No catalog at src/tracks/${tenantKey}.json — serving the default tenant's tracks. ` +
      `Generate one with: npm run tracks ${tenantKey} <playlist-url>`,
  );
  return CATALOGS.get(defaultTenant().key) ?? [];
}
