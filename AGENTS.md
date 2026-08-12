# playlists — agent guide

A multi-tenant "morning music channel" site. One Astro app, server-rendered
per request, serves any number of branded sites (`9xm.scenes.wtf`,
`paris.scenes.wtf`, or a fork's own domains). The tenant is resolved from
the **Host header on every request**; title, description, OG tags,
favicons, hero art, the two title lines, the pill links, and the track
catalog all come from per-tenant config. Config and assets — never code —
are the only places a tenant's name appears.

This file is written so a coding agent with no prior context can execute
any of the three journeys below on a fresh fork. Each journey ends with a
verification block: you are done when those commands produce those outputs.

## How tenant resolution works

`src/tenant.ts` takes the first label of the request's hostname
(`9xm.scenes.wtf` → `9xm`) and looks it up in `src/tenants.json`. If it
matches a tenant key, that tenant renders. **Every other host — apex
domains, `www.`, `localhost`, `*.workers.dev`, anything unrecognized —
renders the default tenant.** There is deliberately no 404 path: a
hostname only reaches this code because the operator attached it to the
deployment, so the sensible answer for an unmatched host is "serve the
main site". This is also what makes apex-domain deployments work (the
first label of `sunsetradio.com` matches nothing → default tenant).

The default tenant is the `"default": "<key>"` entry in `tenants.json`,
or, if that entry is absent or names a nonexistent tenant, simply the
first tenant in the file. A single-tenant file therefore needs no
`default` entry at all.

Track catalogs are discovered, not registered: `src/catalog.ts` globs
`src/tracks/*.json` at build time and keys each catalog by filename.
Dropping in `sunset.json` makes the `sunset` tenant's catalog exist —
there is no import list to edit. A tenant whose catalog file is missing
plays the default tenant's tracks and logs a warning.

## Key files

| Path | What it is |
| --- | --- |
| `src/tenants.json` | Per-tenant config (copy, links, tile color) + optional `"default"` entry |
| `src/tenant.ts` | Host-header → tenant resolution (never returns null) |
| `src/catalog.ts` | Build-time glob of `src/tracks/*.json`, keyed by filename |
| `src/tracks/<key>.json` | Per-tenant track catalog — generate with `npm run tracks` |
| `scripts/tracks.mjs` | Scrapes a public YouTube playlist into a catalog file |
| `src/pages/index.astro` | The whole page (head, hero, player, client script) |
| `src/pages/site.webmanifest.ts`, `src/pages/favicon.ico.ts` | Per-tenant dynamic routes |
| `public/tenants/<key>/` | Heroes, favicon set, `og.jpg` per tenant |
| `wrangler.deploy.jsonc` | Cloudflare deploy config — see gotchas for why it is NOT `wrangler.jsonc` |

## Journey 1: set up your own deployment (fork → live)

Inputs to collect from the human before starting: their GitHub account
(they fork the repo), a Cloudflare account, the domain they want to serve
from, and everything listed under "Inputs" in Journey 3 for their first
tenant.

Agent-executable steps:

1. Clone the fork, `npm install` (Node ≥ 22.12).
2. Create their first tenant (Journey 3). Delete the demo tenants they
   don't want: remove each unwanted entry from `src/tenants.json`, its
   `src/tracks/<key>.json`, and its `public/tenants/<key>/` folder. Make
   sure `"default"` names a tenant that still exists (or delete the
   `"default"` entry — the first tenant in the file then wins).
3. Verify locally (block below), commit, push to `main`.

Human-only steps (dashboard clicking — hand the human this list):

1. Cloudflare dashboard → Workers & Pages → Create → Workers → import the
   forked GitHub repo (this sets up Workers Builds: every push to `main`
   builds and deploys).
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy --config wrangler.deploy.jsonc`
2. Add their domain to Cloudflare (transfer it in, or point its
   nameservers at Cloudflare).
3. Worker → Settings → Domains & Routes → add each hostname that should
   serve the site — e.g. `sunsetradio.com` AND `www.sunsetradio.com`, or
   per-tenant subdomains like `sunset.example.com`. DNS records and SSL
   are automatic. Wildcards are deliberately not used; each hostname is
   attached by hand.

Verification (local, before push):

```sh
npm run build
npx wrangler dev --config wrangler.deploy.jsonc --port 8788
# Their tenant renders on its own hostname:
curl -s -H "Host: <their-domain>" http://localhost:8788/ | grep -o "<title>[^<]*"
# Any unknown host renders the default tenant (NOT a 404):
curl -s -H "Host: anything.example" http://localhost:8788/ | grep -o "<title>[^<]*"
# OG image is an absolute URL on the tenant's own host:
curl -s -H "Host: <their-domain>" http://localhost:8788/ | grep -o 'og:image" content="[^"]*"'
```

After the push lands, open the live domain, then share
`https://<their-domain>/?v=1` in WhatsApp — the query string bypasses
WhatsApp's per-URL card cache. The bare URL's card refreshes on their
schedule (hours to days); that lag is their cache, not a bug.

## Journey 2: single-tenant deployment

Single-tenant is multi-tenant with one entry — there is no separate mode
and nothing else changes. Concretely:

- `src/tenants.json` contains one tenant (no `"default"` needed).
- One catalog file, one asset folder.
- Attach the apex domain and `www.` to the worker; both fall through to
  the default (only) tenant, so the site serves on any hostname the
  operator attaches.
- `localhost` and `*.workers.dev` previews render the same tenant.

## Journey 3: add a tenant

Inputs to collect first: the tenant key (lowercase letters/digits/dashes;
it becomes the filename, asset folder, and — if used as a subdomain — the
subdomain label), title, one-line description, the two title lines
(line1/line2, e.g. "9XM" / "की सुबह"), a tile color (sample a dominant
tone from the hero art if not given), a YouTube Music playlist link, a
Spotify playlist link, and two hero images — landscape ~1672×941 for
desktop, portrait ~941×1672 for mobile.

1. **Config**: add the tenant's entry to `src/tenants.json` (same fields
   as the existing entries).

2. **Track catalog**:
   ```sh
   npm run tracks <key> "<youtube-playlist-url>"
   ```
   Writes `src/tracks/<key>.json` from the public playlist (handles both
   music.youtube.com and www.youtube.com URLs). Re-run it any time the
   playlist changes; catalogs are frozen in git until regenerated. The
   script parses YouTube's `ytInitialData`; if YouTube changes markup and
   it finds zero tracks, it fails loudly rather than writing an empty
   file. Covers are hotlinked from `i.ytimg.com`, never stored locally.
   Note: pages list at most ~100 tracks; longer playlists truncate.

3. **Assets** → `public/tenants/<key>/`:
   - `bg-desktop.png`, `bg-mobile.png` — the hero art as provided.
   - Favicon set: white tenant mark in Rozha One centered on a solid
     `tileColor` square. Sizes: `android-chrome-512x512.png`, `-192`,
     `apple-touch-icon.png` (180), `favicon-32x32.png`,
     `favicon-16x16.png`, and a multi-resolution `favicon.ico` (16/32/48).
     Pillow renders Latin text fine with the Rozha One TTF (fetch it from
     Google Fonts).
   - `og.jpg` — the desktop hero resized to 1200×675 with the tenant's
     line1/line2 lockup top-left (Rozha One, white, drop shadow, tight
     line gap), an ↗ arrow top-right, and **no description text**. Save
     as JPEG quality ~85 and keep it **under ~300 KB — WhatsApp silently
     drops heavier preview images**; the symptom is a link card with no
     image at all (a 1.3 MB PNG never rendered; learned the hard way).
   - **Devanagari (or any complex script) in the lockup cannot be drawn
     with Pillow** — without raqm shaping, matras land in the wrong
     places. Render the lockup text on a browser canvas (any page with
     the Rozha One webfont loaded), export as a transparent PNG, and
     composite it with Pillow. Latin-only lockups can be drawn directly.

4. **Cloudflare** (human-only, only if the tenant gets its own hostname):
   worker → Settings → Domains & Routes → add `<key>.<domain>`.

5. **Verify** (same block as Journey 1, with the new tenant's hostname),
   then commit and push.

## Deploying elsewhere (EC2 / any Node host)

The only Cloudflare-specific piece is the build adapter. To run on a
plain server:

1. `npx astro add node` (or manually: install `@astrojs/node`, and in
   `astro.config.mjs` replace `cloudflare()` with
   `node({ mode: "standalone" })`).
2. `npm run build`, then start with `node ./dist/server/entry.mjs`
   (respects `HOST`/`PORT` env vars). The standalone server also serves
   the static assets itself. Keep it alive with pm2 or systemd.
   `wrangler.deploy.jsonc` becomes irrelevant — ignore it.
3. nginx: ONE catch-all server block proxying to the Node port — the app
   does its own per-tenant routing, so there is no per-tenant nginx
   config. The load-bearing line is:
   ```
   proxy_set_header Host $host;
   ```
   If it's missing, every domain renders the default tenant — that
   symptom always means the Host header isn't being forwarded. Terminate
   TLS in nginx (certbot); OG URLs are built as `https://` + Host, so
   plain-HTTP deployments will advertise wrong OG URLs.

Everything else — tenant resolution, catalogs, dynamic routes — is
platform-neutral and identical in both builds.

## Gotchas that have already bitten once

- **`wrangler.deploy.jsonc` must not be renamed to `wrangler.jsonc`.** The
  Astro Cloudflare adapter's vite plugin auto-discovers that exact name at
  build time and fails validating `main` before the build has created it.
  The deploy command points at the custom name explicitly.
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
- **There is no 404 for unknown hosts — on purpose.** Unmatched hosts get
  the default tenant (see "How tenant resolution works"). Don't "fix" a
  junk-Host test returning 200.
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

Note: `astro dev` runs the page with the default tenant. To exercise
tenant switching and the real worker runtime, use the `wrangler dev` flow
from the verification blocks above.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
