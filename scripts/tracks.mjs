#!/usr/bin/env node
/**
 * Generate a tenant's track catalog from a public YouTube playlist.
 *
 *   npm run tracks <tenant-key> <playlist-url>
 *   npm run tracks sunset "https://music.youtube.com/playlist?list=PL..."
 *
 * Fetches the playlist page, parses the ytInitialData blob out of the HTML,
 * and writes src/tracks/<tenant-key>.json. Handles both markups YouTube
 * serves for playlist pages (lockupViewModel and playlistVideoRenderer).
 * Covers are hotlinked from YouTube's CDN, never stored locally.
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [key, playlistUrl] = process.argv.slice(2);
if (!key || !playlistUrl) {
  console.error("Usage: npm run tracks <tenant-key> <playlist-url>");
  process.exit(1);
}
if (!/^[a-z0-9-]+$/.test(key)) {
  console.error(`Tenant key "${key}" must be lowercase letters/digits/dashes (it becomes a filename and subdomain).`);
  process.exit(1);
}

const listId = (() => {
  try {
    const id = new URL(playlistUrl).searchParams.get("list");
    if (id) return id;
  } catch {}
  if (/^[A-Za-z0-9_-]+$/.test(playlistUrl)) return playlistUrl; // bare playlist id
  console.error(`Could not find a ?list= playlist id in: ${playlistUrl}`);
  process.exit(1);
})();

// music.youtube.com serves an app shell with no track data in the HTML —
// the classic www playlist page embeds everything we need.
const pageUrl = `https://www.youtube.com/playlist?list=${listId}`;
console.log(`Fetching ${pageUrl}`);
const res = await fetch(pageUrl, {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  },
});
if (!res.ok) {
  console.error(`YouTube responded ${res.status} ${res.statusText}`);
  process.exit(1);
}
const html = await res.text();

const marker = html.match(/var ytInitialData\s*=\s*/);
if (!marker) {
  console.error("No ytInitialData found — is the playlist public?");
  process.exit(1);
}
// The blob is a JSON object literal ending at the next `;</script>` —
// scan for the matching closing brace instead of trusting a regex.
const start = marker.index + marker[0].length;
let depth = 0;
let end = -1;
let inString = false;
for (let i = start; i < html.length; i++) {
  const ch = html[i];
  if (inString) {
    if (ch === "\\") i++;
    else if (ch === '"') inString = false;
  } else if (ch === '"') inString = true;
  else if (ch === "{") depth++;
  else if (ch === "}" && --depth === 0) {
    end = i + 1;
    break;
  }
}
if (end === -1) {
  console.error("Could not parse ytInitialData out of the page.");
  process.exit(1);
}
const data = JSON.parse(html.slice(start, end));

// Walk the whole tree; collect tracks from whichever renderer this page uses.
const tracks = [];
const seen = new Set();
const cleanArtist = (name) => (name ?? "").replace(/\s*-\s*Topic$/, "").trim();

function add(videoId, title, artist) {
  if (!videoId || videoId.length !== 11 || seen.has(videoId) || !title) return;
  seen.add(videoId);
  tracks.push({
    id: videoId,
    youtubeId: videoId,
    title,
    artist: cleanArtist(artist),
    album: "",
    cover: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    previewUrl: null,
    rawTitle: title,
  });
}

function walk(node) {
  if (Array.isArray(node)) return node.forEach(walk);
  if (!node || typeof node !== "object") return;

  // Newer markup: lockupViewModel { contentId, metadata: { lockupMetadataViewModel } }
  const lockup = node.lockupViewModel;
  if (lockup?.contentId && lockup?.metadata?.lockupMetadataViewModel) {
    const meta = lockup.metadata.lockupMetadataViewModel;
    const rows =
      meta.metadata?.contentMetadataViewModel?.metadataRows ?? [];
    const artist = rows
      .flatMap((r) => r.metadataParts ?? [])
      .map((p) => p.text?.content)
      .find((t) => t && !/^\d/.test(t)); // skip "3:45", "1.2M views" style parts
    add(lockup.contentId, meta.title?.content, artist);
  }

  // Older markup: playlistVideoRenderer { videoId, title.runs, shortBylineText.runs }
  const pvr = node.playlistVideoRenderer;
  if (pvr?.videoId) {
    add(
      pvr.videoId,
      pvr.title?.runs?.map((r) => r.text).join("") ?? pvr.title?.simpleText,
      pvr.shortBylineText?.runs?.[0]?.text,
    );
  }

  Object.values(node).forEach(walk);
}
walk(data);

if (tracks.length === 0) {
  console.error(
    "Parsed the page but found no tracks. YouTube may have changed its markup — inspect the page's ytInitialData by hand.",
  );
  process.exit(1);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(repoRoot, "src", "tracks", `${key}.json`);
await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(tracks, null, 2) + "\n");
console.log(`Wrote ${tracks.length} tracks to src/tracks/${key}.json`);
console.log(
  `Note: the classic playlist page lists at most ~100 tracks without scrolling; longer playlists are truncated.`,
);
