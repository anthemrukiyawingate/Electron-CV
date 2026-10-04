// [CAPSTONE INTEGRATION TARGET] Confine physical-pipeline ingress to validated loopback data.
import { createSocket } from 'node:dgram';
import type { IncomingMessage } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { decodeOsc, MAX_PACKET_BYTES, RateGate, TelemetryStore } from './shared/contracts.ts';
import type { Transport } from './shared/types.ts';

interface Options { wsPort: number; oscPort: number; onUpdate?: () => void; log?: (event: string, detail: Record<string, unknown>) => void }
export function startTelemetry(options: Options) {
  const store = new TelemetryStore();
  const globalGate = new RateGate(120, 1000);
  const logGate = new RateGate(2, 1000);
  let closing = false;
  const reject = (transport: Transport, reason: string): void => {
    store.reject();
    if (logGate.allow(Date.now())) options.log?.('telemetry_rejected', { transport, reason });
  };
  const accept = (value: unknown, transport: Transport): void => {
    const result = store.accept(value, transport, Date.now());
    if (result.ok) options.onUpdate?.();
    else if (logGate.allow(Date.now())) options.log?.('telemetry_rejected', { transport, reason: result.error.message });
  };
  const ws = new WebSocketServer({
    host: '127.0.0.1', port: options.wsPort, maxPayload: MAX_PACKET_BYTES, perMessageDeflate: false,
    verifyClient: ({ origin, req }: { origin: string; req: IncomingMessage }) => !origin && req.url === '/' && ws.clients.size < 4,
  });
  ws.on('listening', () => { store.setListener('ws', 'listening'); options.log?.('listener_ready', { transport: 'ws', address: ws.address() }); });
  ws.on('error', (error: Error) => { store.setListener('ws', 'error'); options.log?.('listener_error', { transport: 'ws', message: error.message }); });
  ws.on('connection', (socket, request) => {
    if (request.socket.remoteAddress !== '127.0.0.1') { socket.close(1008, 'Loopback only'); return; }
    const gate = new RateGate(60, 1000);
    socket.on('error', () => reject('ws', 'Socket payload or transport error'));
    socket.on('message', (data, binary) => {
      if (!gate.allow(Date.now()) || !globalGate.allow(Date.now())) { reject('ws', 'Rate limit'); return; }
      if (binary) { reject('ws', 'Expected JSON text'); return; }
      try {
        const bytes = Buffer.isBuffer(data) ? data : Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data);
        if (bytes.length > MAX_PACKET_BYTES) { reject('ws', 'Payload size'); return; }
        accept(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown, 'ws');
      } catch { reject('ws', 'Malformed JSON text'); }
    });
  });
  const osc = createSocket('udp4');
  osc.on('listening', () => { store.setListener('osc', 'listening'); options.log?.('listener_ready', { transport: 'osc', address: osc.address() }); });
  osc.on('error', (error: Error) => { store.setListener('osc', 'error'); options.log?.('listener_error', { transport: 'osc', message: error.message }); });
  osc.on('message', (bytes, remote) => {
    if (remote.address !== '127.0.0.1' || !globalGate.allow(Date.now())) { reject('osc', 'Sender or rate limit'); return; }
    try { accept(decodeOsc(bytes), 'osc'); } catch { reject('osc', 'Malformed OSC packet'); }
  });
  osc.bind(options.oscPort, '127.0.0.1');
  return {
    store, ws, osc,
    async close(): Promise<void> {
      if (closing) return;
      closing = true;
      for (const socket of ws.clients) { if (socket.readyState !== WebSocket.CLOSED) socket.terminate(); }
      await Promise.all([
        new Promise<void>((resolve) => { ws.close(() => resolve()); }),
        new Promise<void>((resolve) => { try { osc.close(() => resolve()); } catch { resolve(); } }),
      ]);
    },
  };
}
