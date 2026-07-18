import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
    environment: 'node',
    exclude: [...configDefaults.exclude, 'test/**/*.integration.test.ts'],
  },
})
