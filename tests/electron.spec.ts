// [CAPSTONE INTEGRATION TARGET] Exercise real sandboxed windows and hostile ingress.
import { test, expect, _electron as electron } from '@playwright/test';
import { WebSocket } from 'ws';
import { once } from 'node:events';
import path from 'node:path';
import type { PlatoBridge } from '../src/shared/types.ts';

test('sandboxed dashboard consumes telemetry, rejects hostile frames and recovers after staleness', async () => {
  const executablePath = process.env['VOLTFORGE_ELECTRON_EXECUTABLE'];
  const app = await electron.launch({ chromiumSandbox: true, ...(executablePath ? { executablePath } : {}), args: [...(executablePath ? [] : [path.resolve('dist/main.js')]), '--remote-debugging-address=127.0.0.1'], env: { ...process.env, VOLTFORGE_WS_PORT: '18765', VOLTFORGE_OSC_PORT: '19000' } });
  let client: WebSocket | undefined;
  try {
    const page = await app.firstWindow();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await expect(page.locator('#connection-state')).toHaveText('disconnected');
    expect(await app.evaluate(({ app }) => app.commandLine.hasSwitch('no-sandbox'))).toBe(false);
    expect(await page.evaluate(() => ({ require: typeof require, process: typeof process, api: Object.keys((globalThis as unknown as { plato: PlatoBridge }).plato).sort() }))).toEqual({ require: 'undefined', process: 'undefined', api: ['getSnapshot', 'onSnapshot'] });
    const response = await page.evaluate(() => (globalThis as unknown as { plato: PlatoBridge }).plato.getSnapshot());
    expect(response.ok).toBe(true);

    const hostileWindowPromise = app.waitForEvent('window');
    await app.evaluate(async ({ BrowserWindow }, preload) => {
      const untrusted = new BrowserWindow({ show: false, webPreferences: { preload, sandbox: true, contextIsolation: true, nodeIntegration: false } });
      await untrusted.loadURL('data:text/html,<h1>Untrusted frame fixture</h1>');
    }, path.resolve('dist/preload.js'));
    const hostilePage = await hostileWindowPromise;
    const denied = await hostilePage.evaluate(() => (globalThis as unknown as { plato: PlatoBridge }).plato.getSnapshot());
    expect(denied).toMatchObject({ ok: false, error: { code: 'UNTRUSTED_SENDER' } });
    await hostilePage.close();

    client = new WebSocket('ws://127.0.0.1:18765');
    await once(client, 'open');
    client.send(JSON.stringify({ version: 1, sequence: 0, source: '<img onerror=alert(1)>', timestamp: Date.now(), objects: [], hardware: { camera: 'online', projector: 'online' } }));
    await expect(page.locator('#rejected')).toHaveText('1');
    const packet = { version: 1, sequence: 1, source: 'electron-test', timestamp: Date.now(), objects: [{ id: 'shadow-01', x: .3, y: -.2, confidence: .98 }], hardware: { camera: 'online', projector: 'offline' } };
    client.send(JSON.stringify(packet));
    await expect(page.locator('#connection-state')).toHaveText('live');
    await expect(page.locator('#object-rows')).toContainText('shadow-01');
    await expect(page.locator('#projector-state')).toHaveText('OFFLINE');
    await page.screenshot({ path: 'test-results/electron/plato-live.png', fullPage: true });
    await expect(page.locator('#connection-state')).toHaveText('stale', { timeout: 4000 });
    await expect(page.locator('#connection-state')).toHaveText('disconnected', { timeout: 6000 });
    client.send(JSON.stringify({ ...packet, sequence: 2 }));
    await expect(page.locator('#connection-state')).toHaveText('live');
    await page.getByRole('button', { name: /Refresh status/ }).click();
    await expect(page.getByRole('button', { name: /Refresh status/ })).toBeEnabled();
    expect(errors).toEqual([]);
    // Privileged QA fault injection: stall Main without adding a public debug API.
    const bridgeLogs: string[] = [];
    page.on('console', (message) => { if (message.text().includes('ipc_bridge_failed')) bridgeLogs.push(message.text()); });
    await app.evaluate(({ ipcMain }) => { ipcMain.removeHandler('plato:snapshot'); ipcMain.handle('plato:snapshot', () => new Promise(() => undefined)); });
    const timedOut = await page.evaluate(() => (globalThis as unknown as { plato: PlatoBridge }).plato.getSnapshot());
    expect(timedOut).toMatchObject({ ok: false, error: { code: 'TIMEOUT' } });
    expect(bridgeLogs.some((message) => message.includes('TIMEOUT') && message.includes('snapshot-'))).toBe(true);
  } finally { client?.terminate(); await app.close(); }
});
