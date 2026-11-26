import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { coverage: { include: ['src/ordering.ts'], thresholds: { lines: 75 } } },
});
