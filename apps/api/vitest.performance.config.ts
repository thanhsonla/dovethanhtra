import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['performance/**/*.performance.test.ts'],
    testTimeout: 60_000,
  },
})
