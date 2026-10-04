// [CAPSTONE INTEGRATION TARGET] Reproduce the public simulations' interaction contracts in CI.
import { defineConfig } from '@playwright/test';

const python = process.env['PYTHON'] ?? (process.platform === 'win32' ? 'python' : 'python3');
export default defineConfig({
  testDir: './tests',
  testMatch: 'demo.spec.ts',
  timeout: 30_000,
  workers: 1,
  reporter: 'list',
  outputDir: 'test-results/demos',
  use: {
    browserName: 'chromium',
    viewport: { width: 1440, height: 960 },
    reducedMotion: 'no-preference',
    launchOptions: { chromiumSandbox: true },
    screenshot: 'only-on-failure',
  },
  ...(process.env['VOLTFORGE_DEMO_URL'] ? {} : { webServer: {
    command: `${python} -m http.server 4173 --bind 127.0.0.1 --directory docs`,
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env['CI'],
    timeout: 15_000,
  } }),
});
