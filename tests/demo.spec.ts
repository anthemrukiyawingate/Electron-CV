// [CAPSTONE INTEGRATION TARGET] Falsify public lab controls and safe failure states before browser lab implementation.
import { test, expect } from '@playwright/test';
const origin = process.env.VOLTFORGE_DEMO_URL ?? 'http://127.0.0.1:4173';

test('architecture creates isolated windows and denies privileged renderer access', async ({ page }) => {
  await page.goto(origin);
  await expect(page.getByRole('heading', { name: 'One app. Two worlds.' })).toBeVisible();
  await expect(page.getByTestId('window-count')).toHaveText('01');
  await page.getByRole('button', { name: 'Spawn window', exact: true }).click();
  await expect(page.getByTestId('window-count')).toHaveText('02');
  await page.getByRole('button', { name: 'Attempt filesystem access' }).click();
  await expect(page.getByTestId('action-result')).toContainText('ACCESS_DENIED');
  await page.getByRole('button', { name: 'Request app status' }).click();
  await expect(page.getByTestId('action-result')).toContainText('STATUS_OK');
});

test('bridge accepts exact schema and rejects executable/unknown-field payloads', async ({ page }) => {
  await page.goto(`${origin}/phase-2/`);
  const editor = page.getByLabel('Request payload');
  await editor.fill('{"operation":"getStatus"}');
  await page.getByRole('button', { name: 'Send through bridge' }).click();
  await expect(page.getByTestId('action-result')).toContainText('ACCEPTED');
  await editor.fill('{"operation":"getStatus","code":"globalThis.compromised=true"}');
  await page.getByRole('button', { name: 'Send through bridge' }).click();
  await expect(page.getByTestId('action-result')).toContainText('REJECTED');
  expect(await page.evaluate(() => Reflect.get(globalThis, 'compromised'))).toBeUndefined();
  await editor.fill('{"operation":"readFile","path":"/etc/passwd"}');
  await page.getByRole('button', { name: 'Send through bridge' }).click();
  await expect(page.getByTestId('action-result')).toContainText('REJECTED');
});

test('IPC exposes correlation, response, timeout and disconnect states', async ({ page }) => {
  await page.goto(`${origin}/phase-3/`);
  await page.getByLabel('Main process latency').focus();
  await page.getByLabel('Main process latency').press('Home');
  await page.getByRole('button', { name: 'Invoke request' }).click();
  await expect(page.getByTestId('request-history')).toContainText('vf-0001');
  await expect(page.getByTestId('request-history')).toContainText('fulfilled');
  await page.getByLabel('Main process latency').focus();
  await page.getByLabel('Main process latency').press('End');
  await page.getByRole('button', { name: 'Invoke request' }).click();
  await expect(page.getByTestId('request-history')).toContainText('timeout', { timeout: 6000 });
  await page.getByRole('button', { name: 'Disconnect Main' }).click();
  await page.getByRole('button', { name: 'Invoke request' }).click();
  await expect(page.getByTestId('request-history')).toContainText('rejected');
});

test('telemetry marks stopped data stale and sensor faults explicitly', async ({ page }) => {
  await page.goto(`${origin}/capstone/`);
  await expect(page.getByTestId('feed-status')).toHaveText('LIVE');
  await page.getByRole('button', { name: 'Pause feed' }).click();
  await expect(page.getByTestId('feed-status')).toHaveText('STALE', { timeout: 7000 });
  await page.getByRole('button', { name: 'Resume feed' }).click();
  await expect(page.getByTestId('feed-status')).toHaveText('LIVE');
  await page.getByRole('button', { name: 'Inject sensor fault' }).click();
  await expect(page.getByTestId('feed-status')).toHaveText('FAULT');
  await page.getByRole('button', { name: 'Recover sensor' }).click();
  await expect(page.getByTestId('feed-status')).toHaveText('LIVE');
});

for (const path of ['', '/phase-1/', '/phase-2/', '/phase-3/', '/capstone/']) {
  test(`standalone navigation and responsive layout ${path || '/'}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${origin}${path}`);
    await expect(page.getByRole('navigation', { name: 'Curriculum phases' })).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('IPC bounds bursts and disconnect settles every pending request', async ({ page }) => {
  await page.goto(`${origin}/phase-3/`);
  await page.getByLabel('Main process latency').focus();
  await page.getByLabel('Main process latency').press('End');
  const invoke = page.getByRole('button', { name: 'Invoke request' });
  for (let i = 0; i < 6; i += 1) await invoke.click();
  await expect(page.getByTestId('action-result')).toContainText('QUEUE_FULL');
  await expect(page.getByTestId('request-history').locator('[data-state="pending"]')).toHaveCount(5);
  await page.getByRole('button', { name: 'Disconnect Main' }).click();
  await expect(page.getByTestId('request-history').locator('[data-state="pending"]')).toHaveCount(0);
  await expect(page.getByTestId('request-history').locator('[data-state="rejected"]')).toHaveCount(5);
});

test('paused telemetry retains its last valid values when controls change', async ({ page }) => {
  await page.goto(`${origin}/capstone/`);
  await page.getByRole('button', { name: 'Pause feed' }).click();
  const lastShadow = await page.locator('#shadow-value').textContent();
  const lastCount = await page.locator('#packet-count').textContent();
  await page.getByRole('slider', { name: 'Shadow intensity' }).focus();
  await page.getByRole('slider', { name: 'Shadow intensity' }).press('End');
  await expect(page.getByTestId('feed-status')).toHaveText('STALE', { timeout: 7000 });
  await expect(page.locator('#shadow-value')).toHaveText(lastShadow ?? '');
  await expect(page.locator('#packet-count')).toHaveText(lastCount ?? '');
  await page.getByRole('button', { name: 'Resume feed' }).click();
  await expect(page.locator('#shadow-value')).toHaveText('90%');
});

test('visible 4K renderer reports measured frame pacing and bounded DRS', async ({ page }, testInfo) => {
  const samples: Array<{ width: number; height: number; fps: number; meanFrameMs: number; resolutionPercent: number }> = [];
  for (const viewport of [{ width: 1440, height: 960 }, { width: 3840, height: 2160 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${origin}/capstone/`);
    await page.bringToFront();
    await expect(page.locator('#fps')).toHaveText(/^\d+$/);
    // Deliberately sample a further complete rendering window, not the navigation frame.
    await page.waitForTimeout(1300);
    const sample = {
      ...viewport,
      fps: Number(await page.locator('#fps').textContent()),
      meanFrameMs: Number(await page.locator('#frame-time').textContent()),
      resolutionPercent: Number((await page.locator('#resolution').textContent())?.replace('%', '')),
    };
    expect(sample.fps).toBeGreaterThan(0);
    expect(sample.meanFrameMs).toBeGreaterThan(0);
    expect(sample.resolutionPercent).toBeGreaterThanOrEqual(60);
    expect(sample.resolutionPercent).toBeLessThanOrEqual(100);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    samples.push(sample);
  }
  console.log(`Visible renderer samples (environment-specific): ${JSON.stringify(samples)}`);
  await testInfo.attach('frame-pacing-samples', { body: JSON.stringify(samples, null, 2), contentType: 'application/json' });
  await page.screenshot({ path: testInfo.outputPath('capstone-4k.png'), fullPage: true });
});
