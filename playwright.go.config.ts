import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests/go',
  use: { baseURL: 'http://127.0.0.1:5199', locale: 'zh-CN', trace: 'retain-on-failure' },
  projects: [{ name: 'go-contract', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'VITE_DATA_MODE=live VITE_API_BACKEND=go pnpm dev --host 127.0.0.1 --port 5199 --strictPort',
    url: 'http://127.0.0.1:5199',
    reuseExistingServer: false,
  },
})
