// @ts-check
import { defineConfig } from 'astro/config';

// Static landing page for Fleetwrit. No client framework: the hero motion is
// CSS-only and the page works without JavaScript. This build currently lives
// in the server repo under site/; it splits into fleetwrit-site at 0.1.0.
export default defineConfig({
  site: 'https://fleetwrit.dev',
  compressHTML: true,
});
