import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { coverage: { include: ['src/board/{model,drag,sync}.ts'], thresholds: { lines: 75 } } },
});
