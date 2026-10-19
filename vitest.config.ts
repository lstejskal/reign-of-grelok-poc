import { defineConfig } from 'vitest/config';

// Unit tests live next to the code (*.test.ts). Browser tests live in tests/e2e (Playwright).
export default defineConfig({
  test: { include: ['packages/**/*.test.ts', 'tools/**/*.test.ts'] },
});
