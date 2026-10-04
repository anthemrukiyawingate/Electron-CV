// [CAPSTONE INTEGRATION TARGET] Exercise actual loopback sockets and fail closed.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createSocket } from 'node:dgram';
import test from 'node:test';
import { WebSocket } from 'ws';
import { startTelemetry } from '../../src/telemetry.ts';
import { encodeOsc } from '../../src/shared/contracts.ts';

const packet = { version: 1, sequence: 1, timestamp: 1000, source: 'network-test', objects: [], hardware: { camera: 'online', projector: 'offline' } };
const eventually = async (predicate: () => boolean): Promise<void> => {
  const end = Date.now() + 2000;
  while (!predicate() && Date.now() < end) await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(predicate(), true, 'condition did not become true within 2 seconds');
};

test('real WebSocket and OSC listeners accept validated packets and reject unsafe traffic', async () => {
  const service = startTelemetry({ wsPort: 0, oscPort: 0 });
  await Promise.all([once(service.ws, 'listening'), once(service.osc, 'listening')]);
  const wsAddress = service.ws.address();
  assert.ok(wsAddress && typeof wsAddress !== 'string');
  assert.equal(wsAddress.address, '127.0.0.1');
  assert.equal(service.osc.address().address, '127.0.0.1');
  const client = new WebSocket(`ws://127.0.0.1:${wsAddress.port}`);
  const udp = createSocket('udp4');
  try {
    await once(client, 'open');
    client.send(JSON.stringify({ ...packet, command: 'exec' }));
    await eventually(() => service.store.snapshot(Date.now()).rejected === 1);
    assert.equal(service.store.snapshot(Date.now()).telemetry, null);
    client.send(JSON.stringify(packet));
    await eventually(() => service.store.snapshot(Date.now()).telemetry?.sequence === 1);
    udp.send(encodeOsc({ ...packet, sequence: 2 }), service.osc.address().port, '127.0.0.1');
    await eventually(() => service.store.snapshot(Date.now()).telemetry?.sequence === 2);
    assert.equal(service.store.snapshot(Date.now()).transport, 'osc');
    udp.send(Buffer.from('#bundle\0'), service.osc.address().port, '127.0.0.1');
    await eventually(() => service.store.snapshot(Date.now()).rejected === 2);
    const browserClient = new WebSocket(`ws://127.0.0.1:${wsAddress.port}`, { origin: 'https://evil.test' });
    const browserFailure = await once(browserClient, 'error');
    assert.match(String(browserFailure[0]), /401|403/);
    const close = once(client, 'close');
    client.send('x'.repeat(17000));
    await close;
    assert.equal(service.store.snapshot(Date.now()).telemetry?.sequence, 2);
  } finally {
    client.terminate(); udp.close(); await service.close();
  }
});

test('port collisions become listener error state rather than uncaught exceptions', async () => {
  const first = startTelemetry({ wsPort: 0, oscPort: 0 });
  await Promise.all([once(first.ws, 'listening'), once(first.osc, 'listening')]);
  const address = first.ws.address();
  assert.ok(address && typeof address !== 'string');
  const second = startTelemetry({ wsPort: address.port, oscPort: first.osc.address().port });
  try {
    await eventually(() => second.store.snapshot(Date.now()).listeners.ws === 'error' && second.store.snapshot(Date.now()).listeners.osc === 'error');
  } finally { await second.close(); await first.close(); }
});
