import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests/live',
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:5198', locale: 'zh-CN', trace: 'retain-on-failure' },
  projects: [{ name: 'production-contract', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'VITE_DATA_MODE=live pnpm dev --host 127.0.0.1 --port 5198 --strictPort',
    url: 'http://127.0.0.1:5198',
    reuseExistingServer: false,
  },
})
