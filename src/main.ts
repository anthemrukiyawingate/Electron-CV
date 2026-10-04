// [CAPSTONE INTEGRATION TARGET] Main owns windows, transport sockets, and all privileged IPC.
import { app, BrowserWindow, ipcMain, session } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CHANNEL_SNAPSHOT, CHANNEL_UPDATE, isTrustedFrame, RateGate, validateSnapshotRequest, withDeadline } from './shared/contracts.ts';
import type { Result, Snapshot } from './shared/types.ts';
import { startTelemetry } from './telemetry.ts';

const log = (event: string, detail: Record<string, unknown> = {}): void => { console.log(JSON.stringify({ timestamp: new Date().toISOString(), event, ...detail })); };
function port(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (!/^\d{4,5}$/.test(raw) || Number(raw) < 1024 || Number(raw) > 65535) throw new Error(`${name} must be an integer between 1024 and 65535`);
  return Number(raw);
}
let window: BrowserWindow | null = null;
let telemetry: ReturnType<typeof startTelemetry> | undefined;
let tick: ReturnType<typeof setInterval> | undefined;
const indexFile = path.join(__dirname, 'index.html');
const expectedUrl = pathToFileURL(indexFile).href;
const ipcRate = new RateGate(30, 1000);
function publish(): void {
  if (telemetry && window && !window.isDestroyed() && !window.webContents.isDestroyed() && !window.webContents.isLoading()) window.webContents.send(CHANNEL_UPDATE, telemetry.store.snapshot(Date.now()));
}
function createWindow(): void {
  window = new BrowserWindow({ width: 1360, height: 900, minWidth: 800, minHeight: 600, title: 'Plato · VoltForge', backgroundColor: '#0D1117', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, devTools: !app.isPackaged, navigateOnDragDrop: false },
  });
  window.setMenuBarVisibility(false);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  window.once('ready-to-show', () => { window?.show(); });
  window.on('closed', () => { window = null; });
  window.webContents.on('render-process-gone', (_event, detail) => log('renderer_gone', { reason: detail.reason }));
  void window.loadFile(indexFile).catch((error: unknown) => log('window_load_failed', { message: String(error) }));
}
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.on('will-download', (event) => event.preventDefault());
  telemetry = startTelemetry({ wsPort: port('VOLTFORGE_WS_PORT', 8765), oscPort: port('VOLTFORGE_OSC_PORT', 9000), onUpdate: publish, log });
  ipcMain.handle(CHANNEL_SNAPSHOT, async (event, value: unknown): Promise<Result<Snapshot>> => {
    if (!window || event.sender !== window.webContents || !event.senderFrame || !isTrustedFrame(event.senderFrame.url, expectedUrl, event.senderFrame === window.webContents.mainFrame)) {
      log('ipc_rejected', { code: 'UNTRUSTED_SENDER' });
      return { ok: false, error: { code: 'UNTRUSTED_SENDER', message: 'This frame is not authorized' } };
    }
    const request = validateSnapshotRequest(value);
    if (!request.ok) { log('ipc_rejected', { code: request.error.code }); return request; }
    if (!ipcRate.allow(Date.now())) return { ok: false, error: { code: 'INVALID_REQUEST', message: 'Request rate exceeded' } };
    try {
      const snapshot = await withDeadline(Promise.resolve(telemetry!.store.snapshot(Date.now())), 1500);
      log('ipc_complete', { requestId: request.value.requestId, state: snapshot.state });
      return { ok: true, value: snapshot };
    } catch (error: unknown) {
      const timedOut = error instanceof Error && /deadline/.test(error.message);
      log('ipc_failed', { requestId: request.value.requestId, code: timedOut ? 'TIMEOUT' : 'INTERNAL' });
      return { ok: false, error: { code: timedOut ? 'TIMEOUT' : 'INTERNAL', message: timedOut ? 'Snapshot deadline exceeded' : 'Unable to read current status' } };
    }
  });
  tick = setInterval(publish, 500);
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  log('app_ready', { version: app.getVersion() });
}).catch((error: unknown) => { log('startup_failed', { message: String(error) }); app.exit(1); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { if (tick) clearInterval(tick); ipcMain.removeHandler(CHANNEL_SNAPSHOT); void telemetry?.close(); });
