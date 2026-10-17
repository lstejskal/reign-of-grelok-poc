import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173 },
  build: { chunkSizeWarningLimit: 2000 }, // Phaser alone is ~1.5 MB minified
});
