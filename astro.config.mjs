import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  site: 'https://Takkey55.github.io',
  base: '/prompt-hub',
  integrations: [tailwind()],
});
