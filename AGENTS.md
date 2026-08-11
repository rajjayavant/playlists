# playlists — agent guide

A multi-tenant "morning music channel" site. One Astro app, server-rendered
on a Cloudflare Worker, serves any number of branded subdomains
(`9xm.scenes.wtf`, `paris.scenes.wtf`, …). The tenant is resolved from the
**Host header on every request**; title, description, OG tags, favicons,
hero art, the two title lines, the pill links, and the track catalog all
come from per-tenant config. Unknown subdomains return 404; `localhost` and
`*.workers.dev` fall back to the `9xm` tenant.

## Key files

| Path | What it is |
| --- | --- |
| `src/tenants.json` | Per-tenant config (copy, links, tile color) |
| `src/tenant.ts` | Host-header → tenant resolution + fallbacks |
| `src/pages/index.astro` | The whole page; `CATALOGS` map registers each tenant's tracks |
| `src/tracks/<key>.json` | Per-tenant track catalog (from a YouTube playlist) |
| `src/pages/site.webmanifest.ts`, `src/pages/favicon.ico.ts` | Per-tenant dynamic routes |
| `public/tenants/<key>/` | Heroes, favicon set, `og.jpg` per tenant |
| `wrangler.deploy.jsonc` | Deploy config — see gotchas for why it is NOT `wrangler.jsonc` |

Deployment: git push to `main` → Cloudflare Workers Builds runs
`npm run build`, then `npx wrangler deploy --config wrangler.deploy.jsonc`.
The worker is named `playlists`; custom domains are attached to it in the
Cloudflare dashboard.

## Adding a new tenant (subdomain)

Inputs to collect first: the subdomain key (lowercase, becomes
`<key>.scenes.wtf`), title, one-line description, the two title lines
(line1/line2, e.g. "9XM" / "की सुबह"), a tile color (sample a dominant tone
from the hero art if not given), a YouTube Music playlist link, a Spotify
playlist link, and two hero images — landscape ~1672×941 for desktop,
portrait ~941×1672 for mobile.

1. **Assets** → `public/tenants/<key>/`:
   - `bg-desktop.png`, `bg-mobile.png` — the hero art as provided.
   - Favicon set: white tenant mark in Rozha One centered on a solid
     `tileColor` square. Sizes: `android-chrome-512x512.png`, `-192`,
     `apple-touch-icon.png` (180), `favicon-32x32.png`, `favicon-16x16.png`,
     and a multi-resolution `favicon.ico` (16/32/48). Pillow renders Latin
     text fine with the Rozha One TTF (fetch it from Google Fonts).
   - `og.jpg` — the desktop hero resized to 1200×675 with the tenant's
     line1/line2 lockup top-left (Rozha One, white, drop shadow, tight line
     gap), an ↗ arrow top-right, and **no description text**. Save as JPEG
     quality ~85 and keep it **under ~300 KB — WhatsApp silently drops
     heavier preview images** (a 1.3 MB PNG never rendered; this was learned
     the hard way).
   - **Devanagari (or any complex script) in the lockup cannot be drawn with
     Pillow** — this Python lacks raqm shaping, so matras land in the wrong
     places. Render the lockup text on a browser canvas (any page with the
     Rozha One webfont loaded), export as a transparent PNG, and composite
     it with Pillow. Latin-only lockups can be drawn directly with Pillow.

2. **Track catalog** → `src/tracks/<key>.json`:
   - Fetch `https://www.youtube.com/playlist?list=<ID>`, parse the
     `ytInitialData` JSON from the HTML, and collect the `lockupViewModel`
     nodes — each has `contentId` (the video id) and metadata with the title
     and channel name. Strip YouTube's `" - Topic"` suffix from channels.
   - Track shape: `{ id, youtubeId, title, artist, album: "", cover, previewUrl: null, rawTitle }`
     with `cover` = `https://i.ytimg.com/vi/<id>/hqdefault.jpg` (covers are
     hotlinked from YouTube's CDN, never stored locally).
   - Register the file in the `CATALOGS` map at the top of
     `src/pages/index.astro`.

3. **Config**: add the tenant's entry to `src/tenants.json` (same fields as
   the existing entries).

4. **Cloudflare** (dashboard, manual — wildcard domains are deliberately not
   used): Workers & Pages → the `playlists` worker → Settings → Domains &
   Routes → add `<key>.scenes.wtf`. DNS record and SSL are automatic.

5. **Verify locally before pushing**:
   ```sh
   npm run build
   npx wrangler dev --config wrangler.deploy.jsonc --port 8788
   curl -s -H "Host: <key>.scenes.wtf" http://localhost:8788/ | grep -o "<title>[^<]*"
   curl -s -o /dev/null -w "%{http_code}\n" -H "Host: junk.scenes.wtf" http://localhost:8788/   # must be 404
   ```
   Check the title, the `og:image` URL (absolute, on the tenant's own host),
   and that the tenant's og.jpg and heroes return 200.

6. **Deploy**: commit and push to `main`. After it lands, test the link
   preview by sharing `https://<key>.scenes.wtf/?v=1` in WhatsApp — the
   query string bypasses WhatsApp's per-URL card cache. The bare URL's card
   refreshes on their schedule (hours to days); that lag is their cache, not
   a bug.

## Gotchas that have already bitten once

- **`wrangler.deploy.jsonc` must not be renamed to `wrangler.jsonc`.** The
  Astro Cloudflare adapter's vite plugin auto-discovers that exact name at
  build time and fails validating `main` before the build has created it.
  The dashboard deploy command points at the custom name explicitly.
- **The worker name comes from `wrangler.deploy.jsonc` (`"name": "playlists"`)**
  and must keep matching the worker the custom domains are attached to.
- **Never put a background color on `<body>`.** The hero is a fixed element
  at `z-index: -10`; an in-flow body background paints *on top of* negative
  z-index children and blanks the entire artwork. The page-edge black
  (mobile status-bar gap) lives on `<html>`, which paints behind them.
- **The client `<script>` is one shared static bundle across all tenants.**
  Anything tenant-specific the browser needs must flow through the
  `#tenant-data` JSON island rendered into the HTML — never import
  per-tenant data directly into the client script.
- **OG scrapers read raw HTML only.** All meta must be server-rendered, and
  `og:image` must be an absolute URL on the tenant's own hostname.
- The player deliberately starts videos at 0:00 (an inherited 5-second
  start offset was removed); the fullscreen button is desktop-only because
  mobile browsers mishandle the API; the clock shows the visitor's local
  time by design.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

Note: `astro dev` runs the page with the `9xm` fallback tenant. To exercise
tenant switching and the real worker runtime, use the `wrangler dev` flow
from the verification steps above.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
