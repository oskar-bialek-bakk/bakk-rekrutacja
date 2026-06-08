import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    coverage: { provider: 'v8', include: ['src/domain/**', 'src/persistence/**', 'src/export/**'] },
  },
});
