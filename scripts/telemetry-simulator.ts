// [CAPSTONE INTEGRATION TARGET] Send reproducible physical-shadow motion through real ingress.
import { WebSocket } from 'ws';
import { createSocket } from 'node:dgram';
import { encodeOsc } from '../src/shared/contracts.ts';
import type { Telemetry } from '../src/shared/types.ts';
const transport = process.argv.includes('--osc') ? 'osc' : 'ws';
const rawPort = process.env[transport === 'ws' ? 'VOLTFORGE_WS_PORT' : 'VOLTFORGE_OSC_PORT'] ?? (transport === 'ws' ? '8765' : '9000');
if (!/^\d{4,5}$/.test(rawPort) || Number(rawPort) < 1024 || Number(rawPort) > 65535) throw new Error('Telemetry port must be 1024..65535');
const port = Number(rawPort);
const source = `simulator-${Date.now()}`;
let sequence = 0;
let timer: ReturnType<typeof setInterval> | undefined;
let closing = false;
const ws = transport === 'ws' ? new WebSocket(`ws://127.0.0.1:${port}`, { handshakeTimeout: 2000 }) : undefined;
const udp = transport === 'osc' ? createSocket('udp4') : undefined;
function send(): void {
  const t = sequence / 20;
  const packet: Telemetry = { version: 1, sequence: sequence++, timestamp: Date.now(), source, objects: [
    { id: 'shadow-01', x: Math.sin(t * .7) * .65, y: Math.cos(t * .9) * .62, confidence: .97 },
    { id: 'shadow-02', x: Math.cos(t * .5) * .55, y: Math.sin(t * .8) * .6, confidence: .84 },
  ], hardware: { camera: 'online', projector: Math.floor(t / 20) % 3 === 2 ? 'offline' : 'online' } };
  if (ws?.readyState === WebSocket.OPEN && ws.bufferedAmount < 65536) ws.send(JSON.stringify(packet));
  if (udp) udp.send(encodeOsc(packet), port, '127.0.0.1');
}
function start(): void { console.log(JSON.stringify({ event: 'simulator_started', transport, port, source, frequencyHz: 20 })); timer = setInterval(send, 50); }
function stop(code = 0): void {
  if (closing) return; closing = true; if (timer) clearInterval(timer); ws?.terminate();
  if (udp) { try { udp.close(); } catch { /* Already closed. */ } }
  process.exitCode = code;
}
ws?.once('open', start);
ws?.on('error', (error: Error) => { console.error(JSON.stringify({ event: 'simulator_error', message: error.message })); stop(1); });
ws?.on('close', () => stop());
udp?.on('error', (error: Error) => { console.error(JSON.stringify({ event: 'simulator_error', message: error.message })); stop(1); });
if (udp) start();
process.once('SIGINT', () => stop()); process.once('SIGTERM', () => stop());
