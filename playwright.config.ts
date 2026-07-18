import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
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
      command: 'pnpm exec dotenv -e .env.example -- pnpm --filter @dove/api dev',
      url: 'http://127.0.0.1:3000/api/v1/health/live',
      reuseExistingServer: !process.env.CI,
    },
    {
      command:
        'pnpm exec dotenv -e .env.example -v VITE_BASEMAP_STYLE_URL=http://127.0.0.1:4173/basemaps/e2e-style.json -v VITE_BASEMAP_LABEL="Nền E2E" -v VITE_BASEMAP_ATTRIBUTION="Nền E2E được cấp phép" -- pnpm --filter @dove/web dev --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
    },
  ],
})
