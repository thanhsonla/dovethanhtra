import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit-ipad', use: { ...devices['iPad Pro 11'] } },
  ],
  webServer: [
    {
      command:
        'pnpm db:test:prepare && pnpm exec dotenv -e .env.example -v API_PORT=3100 -- node scripts/with-test-database.mjs pnpm --filter @dove/api dev',
      url: 'http://127.0.0.1:3100/api/v1/health/live',
      reuseExistingServer: false,
    },
    {
      command:
        'pnpm exec dotenv -e .env.example -v VITE_LEGACY_CASE_DASHBOARD=true -v VITE_API_PROXY_TARGET=http://127.0.0.1:3100 -v VITE_BASEMAP_STYLE_URL=http://127.0.0.1:4173/basemaps/e2e-style.json -v VITE_BASEMAP_LABEL="Nền E2E" -v VITE_BASEMAP_ATTRIBUTION="Nền E2E được cấp phép" -v VITE_MAPBOX_PUBLIC_TOKEN=disabled-for-e2e -- pnpm --filter @dove/web dev --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
    },
  ],
})
