# playlists

A multi-tenant "morning music channel" for the web: one glassy player over
full-bleed illustrated art, playing a YouTube playlist. One deployment
serves any number of branded sites — the tenant (title, art, favicons,
social cards, track catalog) is resolved from the Host header on every
request. Live at [9xm.scenes.wtf](https://9xm.scenes.wtf).

Built with Astro (SSR) + Tailwind, deployed on a Cloudflare Worker.
Playback uses the YouTube IFrame API; track covers hotlink YouTube's CDN.
No database, no API keys, no environment variables — config and assets in
the repo are the entire footprint.

## Run your own

You can run one site on your own domain, or many branded sites off one
deployment — they're the same setup with more JSON entries.

**Have a coding agent?** Point it at [`AGENTS.md`](./AGENTS.md) — it
contains complete, verifiable playbooks. A prompt like this is enough:

> Follow "Journey 1: set up your own deployment" in AGENTS.md. My domain
> is example.com, my YouTube Music playlist is <url>, my Spotify playlist
> is <url>, the site title is "…", the two title lines are "…" / "…", and
> here are my two hero images.

**Doing it by hand?** The short version:

1. **Fork and clone**, `npm install` (Node ≥ 22.12).
2. **Describe your site** in `src/tenants.json`: title, description, the
   two title lines, a tile color, playlist links. One entry is all a
   single-site deployment needs.
3. **Generate the track catalog** from a public YouTube playlist:
   ```sh
   npm run tracks <key> "https://music.youtube.com/playlist?list=..."
   ```
4. **Add your assets** in `public/tenants/<key>/`: two hero images
   (desktop ~1672×941, mobile ~941×1672), a favicon set, and a 1200×675
   `og.jpg` social card under 300 KB. Exact specs are in
   [`AGENTS.md`](./AGENTS.md), Journey 3.
5. **Check it locally**:
   ```sh
   npm run build
   npx wrangler dev --config wrangler.deploy.jsonc --port 8788
   # open http://localhost:8788
   ```
6. **Deploy on Cloudflare**: dashboard → Workers & Pages → create a
   Worker from your fork (build command `npm run build`, deploy command
   `npx wrangler deploy --config wrangler.deploy.jsonc`), then attach
   your hostnames under Settings → Domains & Routes (add both
   `example.com` and `www.example.com`). Every push to `main` deploys.

Any hostname you attach that doesn't name a specific tenant serves your
default (first) tenant — apex domains and `www.` just work; there is no
404 path.

**More channels later:** each extra tenant is one `tenants.json` entry +
one generated catalog + one asset folder, with its subdomain attached in
the dashboard. No code changes.

**Not on Cloudflare?** Swap the adapter for `@astrojs/node` and put nginx
in front (one catch-all server block with `proxy_set_header Host $host`).
Details in AGENTS.md under "Deploying elsewhere".

## Commands

| Command | Action |
| :-- | :-- |
| `npm install` | Install dependencies |
| `npm run dev` | Dev server at `localhost:4321` (renders the default tenant) |
| `npm run tracks <key> <url>` | Generate/refresh a tenant's catalog from a YouTube playlist |
| `npm run build` | Build to `./dist/` |
| `npx wrangler dev --config wrangler.deploy.jsonc` | Run the real worker locally (Host-header routing works) |
