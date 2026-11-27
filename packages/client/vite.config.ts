import { defineConfig } from 'vite';

export default defineConfig({
  // Relative URLs in the build, so it runs from any folder (itch.io serves games from a sub-path).
  base: './',
  server: { port: 5173 },
  preview: { port: 4173 },
  build: { chunkSizeWarningLimit: 2000 }, // Phaser alone is ~1.5 MB minified
});
