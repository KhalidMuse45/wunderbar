import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath =
  process.env.PW_CHROMIUM_PATH ||
  (process.platform === 'darwin' && existsSync(localChrome) ? localChrome : undefined);

export default defineConfig({
  testDir: './tests/connected',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3401',
    trace: 'retain-on-failure',
    launchOptions: { executablePath },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: [
    {
      command: 'node tests/fixtures/supabase-server.mjs',
      url: 'http://127.0.0.1:3402/health',
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -- --hostname localhost --port 3401',
      url: 'http://localhost:3401/login',
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:3402',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-test-anon-key',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
        NEXT_PUBLIC_SITE_URL: 'http://localhost:3401',
      },
    },
  ],
});
