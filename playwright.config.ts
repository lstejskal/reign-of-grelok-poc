import { defineConfig } from '@playwright/test';

// E2E_BUILD=1 runs the tests against the production build (`npm run build` first) served by `vite preview`
// instead of the dev server.
const build = process.env.E2E_BUILD === '1';
const port = build ? 4173 : 5173;

export default defineConfig({
  testDir: 'tests/e2e',
  use: {
    baseURL: `http://localhost:${port}`,
    viewport: { width: 960, height: 600 },
    // Optional: point at an already-installed Chromium instead of Playwright's own download.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: {
    command: build
      ? `npm run preview -w @grelok/client -- --port ${port} --strictPort`
      : `npm run dev -w @grelok/client -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
  },
});
