// [CAPSTONE INTEGRATION TARGET] Expose two named capabilities through an isolated bridge.
import { contextBridge, ipcRenderer } from 'electron';
import { CHANNEL_SNAPSHOT, CHANNEL_UPDATE, withDeadline } from './shared/contracts.ts';
import type { PlatoBridge, Result, Snapshot } from './shared/types.ts';
let sequence = 0;
const bridge: PlatoBridge = {
  async getSnapshot(): Promise<Result<Snapshot>> {
    const requestId = `snapshot-${Date.now()}-${sequence++}`;
    try { return await withDeadline(ipcRenderer.invoke(CHANNEL_SNAPSHOT, { requestId }) as Promise<Result<Snapshot>>, 2000); }
    catch (error: unknown) {
      const code = error instanceof Error && /deadline/.test(error.message) ? 'TIMEOUT' : 'INTERNAL';
      console.warn(JSON.stringify({ timestamp: new Date().toISOString(), event: 'ipc_bridge_failed', requestId, code }));
      return { ok: false, error: { code, message: 'Connection to Main unavailable. Retry the status request.' } };
    }
  },
  onSnapshot(callback: (snapshot: Snapshot) => void): () => void {
    if (typeof callback !== 'function') throw new TypeError('Expected a snapshot callback');
    const listener = (_event: Electron.IpcRendererEvent, snapshot: Snapshot): void => callback(snapshot);
    ipcRenderer.on(CHANNEL_UPDATE, listener);
    return () => { ipcRenderer.removeListener(CHANNEL_UPDATE, listener); };
  },
};
contextBridge.exposeInMainWorld('plato', Object.freeze(bridge));
