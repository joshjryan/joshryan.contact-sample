import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://example.com',
  adapter: cloudflare(),
  output: 'server',
  image: {
    service: {
      entrypoint: 'astro/assets/services/noop',
    },
  },
  integrations: [],
});
