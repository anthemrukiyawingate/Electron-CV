// [CAPSTONE INTEGRATION TARGET] Falsify the privileged telemetry and IPC boundary.
import assert from 'node:assert/strict';
import test from 'node:test';
import { validateTelemetry, validateSnapshotRequest, isTrustedFrame, decodeOsc, encodeOsc, RateGate, TelemetryStore, withDeadline } from '../../src/shared/contracts.ts';

const packet = { version: 1, sequence: 4, timestamp: 1000, source: 'simulator', objects: [{ id: 'shadow-1', x: 0.2, y: -0.4, confidence: 0.9 }], hardware: { camera: 'online', projector: 'offline' } };

test('telemetry accepts only exact finite, bounded, versioned data', () => {
  assert.equal(validateTelemetry(packet).ok, true);
  for (const bad of [null, [], { ...packet, version: 2 }, { ...packet, shell: 'cmd.exe' }, { ...packet, sequence: -1 }, { ...packet, source: '<script>' }, { ...packet, objects: [{ id: 'a', x: Infinity, y: 0, confidence: 1 }] }, { ...packet, objects: [{ id: 'a', x: 0, y: 0, confidence: 2 }] }, { ...packet, objects: Array.from({ length: 65 }, () => packet.objects[0]) }, { ...packet, hardware: { ...packet.hardware, path: '/tmp' } }]) {
    assert.equal(validateTelemetry(bad).ok, false, JSON.stringify(bad));
  }
});

test('IPC rejects unknown operations/fields and untrusted frames', () => {
  assert.equal(validateSnapshotRequest({ requestId: 'r-17' }).ok, true);
  for (const bad of [{ requestId: 'x', command: 'exec' }, {}, { requestId: 17 }, { requestId: '../x' }]) assert.equal(validateSnapshotRequest(bad).ok, false);
  assert.equal(isTrustedFrame('file:///app/index.html', 'file:///app/index.html', true), true);
  assert.equal(isTrustedFrame('file:///app/index.html', 'file:///app/index.html', false), false);
  assert.equal(isTrustedFrame('https://evil.test/', 'file:///app/index.html', true), false);
  assert.equal(isTrustedFrame('file:///app/index.html?evil', 'file:///app/index.html', true), false);
});

test('OSC subset round trips and rejects truncation, unsupported tags and oversized messages', () => {
  const encoded = encodeOsc(packet);
  assert.deepEqual(decodeOsc(encoded), packet);
  for (const bad of [encoded.subarray(0, encoded.length - 1), Buffer.from('#bundle\0'), Buffer.alloc(20000), Buffer.from('/plato/telemetry\0,x\0\0')]) assert.throws(() => decodeOsc(bad));
  const trailing = Buffer.concat([encoded, Buffer.from([1, 2, 3, 4])]);
  assert.throws(() => decodeOsc(trailing));
});

test('rate gate bounds bursts and resets on a new window', () => {
  const gate = new RateGate(2, 1000);
  assert.equal(gate.allow(10), true);
  assert.equal(gate.allow(20), true);
  assert.equal(gate.allow(30), false);
  assert.equal(gate.allow(1010), true);
});

test('telemetry lifecycle distinguishes empty, stale, disconnected and recovery', () => {
  const store = new TelemetryStore();
  assert.equal(store.snapshot(0).state, 'disconnected');
  assert.equal(store.accept(packet, 'ws', 100).ok, true);
  assert.equal(store.snapshot(101).state, 'live');
  assert.equal(store.snapshot(1800).state, 'stale');
  assert.equal(store.snapshot(5200).state, 'disconnected');
  assert.equal(store.accept({ ...packet, sequence: 3 }, 'ws', 5300).ok, false);
  assert.equal(store.snapshot(5300).rejected, 1);
  assert.equal(store.accept({ ...packet, sequence: 5 }, 'osc', 5400).ok, true);
  assert.equal(store.snapshot(5401).state, 'live');
});

test('deadline fails closed and successful work retains its value', async () => {
  await assert.rejects(withDeadline(new Promise(() => undefined), 10), /deadline/i);
  assert.equal(await withDeadline(Promise.resolve(42), 100), 42);
});
