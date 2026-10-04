// [CAPSTONE INTEGRATION TARGET] Verify the actual Electron security and rendering boundary.
import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests', testMatch: 'electron*.spec.ts', timeout: 30_000, workers: 1, reporter: 'list', outputDir: 'test-results/electron' });
