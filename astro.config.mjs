// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Every page is rendered per request: the tenant (branding, links, tracks)
  // is resolved from the Host header, so the same deployment serves
  // 9xm.scenes.wtf, paris.scenes.wtf, … with different paint.
  output: 'server',
  adapter: cloudflare(),
  vite: {
    plugins: [tailwindcss()]
  }
});
