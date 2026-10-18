import { defineConfig } from 'vitest/config';

// Kept separate from vite.config.ts so the tests don't load the Tailwind/Figma
// build plugins — they only need TypeScript + JSX.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['tests/**/*.test.{ts,tsx}', 'packages/*/src/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
});
