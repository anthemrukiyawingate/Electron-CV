// [CAPSTONE INTEGRATION TARGET] Reject malformed telemetry before it can enter the UI.
import type { Result, Telemetry, Snapshot, SnapshotRequest, Transport, ListenerState } from './types.ts';
export const MAX_PACKET_BYTES = 16_384;
export const CHANNEL_SNAPSHOT = 'plato:snapshot';
export const CHANNEL_UPDATE = 'plato:update';
const safeName = /^[A-Za-z0-9_-]{1,40}$/;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]): boolean => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const finite = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const name = (value: unknown): value is string => typeof value === 'string' && safeName.test(value);
const invalid = <T>(message: string): Result<T> => ({ ok: false, error: { code: 'INVALID_REQUEST', message } });

export function validateTelemetry(value: unknown): Result<Telemetry> {
  if (!record(value) || !exact(value, ['version', 'sequence', 'timestamp', 'source', 'objects', 'hardware']) || value.version !== 1 || !integer(value.sequence) || !integer(value.timestamp) || !name(value.source)) return invalid('Invalid telemetry envelope');
  if (!Array.isArray(value.objects) || value.objects.length > 64) return invalid('Invalid object collection');
  const seen = new Set<string>();
  for (const object of value.objects) {
    if (!record(object) || !exact(object, ['id', 'x', 'y', 'confidence']) || !name(object.id) || !finite(object.x, -1, 1) || !finite(object.y, -1, 1) || !finite(object.confidence, 0, 1) || seen.has(object.id)) return invalid('Invalid shadow object');
    seen.add(object.id);
  }
  if (!record(value.hardware) || !exact(value.hardware, ['camera', 'projector']) || (value.hardware.camera !== 'online' && value.hardware.camera !== 'offline') || (value.hardware.projector !== 'online' && value.hardware.projector !== 'offline')) return invalid('Invalid hardware state');
  return { ok: true, value: value as unknown as Telemetry };
}

export function validateSnapshotRequest(value: unknown): Result<SnapshotRequest> {
  return record(value) && exact(value, ['requestId']) && typeof value.requestId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value.requestId)
    ? { ok: true, value: { requestId: value.requestId } } : invalid('Expected one bounded requestId');
}

export function isTrustedFrame(actualUrl: string, expectedUrl: string, isMainFrame: boolean): boolean {
  return isMainFrame && actualUrl === expectedUrl;
}

export class RateGate {
  private started = -1;
  private used = 0;
  constructor(private readonly limit: number, private readonly windowMs: number) {}
  allow(now: number): boolean {
    if (this.started < 0 || now - this.started >= this.windowMs || now < this.started) { this.started = now; this.used = 0; }
    this.used += 1;
    return this.used <= this.limit;
  }
}

export class TelemetryStore {
  private latest: Telemetry | null = null;
  private receivedAt: number | null = null;
  private transport: Transport | null = null;
  private rejected = 0;
  private readonly sequences = new Map<string, number>();
  private readonly listeners: Record<Transport, ListenerState> = { ws: 'starting', osc: 'starting' };
  setListener(transport: Transport, state: ListenerState): void { this.listeners[transport] = state; }
  reject(): void { this.rejected = Math.min(Number.MAX_SAFE_INTEGER, this.rejected + 1); }
  accept(value: unknown, transport: Transport, now: number): Result<Telemetry> {
    const result = validateTelemetry(value);
    if (!result.ok) { this.reject(); return result; }
    const prior = this.sequences.get(result.value.source);
    if (prior !== undefined && result.value.sequence <= prior) { this.reject(); return invalid('Out-of-order sequence'); }
    this.sequences.delete(result.value.source);
    this.sequences.set(result.value.source, result.value.sequence);
    if (this.sequences.size > 32) this.sequences.delete(this.sequences.keys().next().value!);
    this.latest = structuredClone(result.value);
    this.receivedAt = now;
    this.transport = transport;
    return { ok: true, value: structuredClone(result.value) };
  }
  snapshot(now: number): Snapshot {
    const age = this.receivedAt === null ? Infinity : Math.max(0, now - this.receivedAt);
    return { state: age > 5000 ? 'disconnected' : age > 1500 ? 'stale' : 'live', telemetry: this.latest === null ? null : structuredClone(this.latest), transport: this.transport, receivedAt: this.receivedAt, rejected: this.rejected, listeners: { ...this.listeners } };
  }
}

export function withDeadline<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Operation deadline exceeded')), timeoutMs);
    work.then((value) => { clearTimeout(timer); resolve(value); }, (error: unknown) => { clearTimeout(timer); reject(error); });
  });
}

function oscString(value: string): Buffer {
  const bytes = Buffer.from(value, 'utf8');
  const output = Buffer.alloc(Math.ceil((bytes.length + 1) / 4) * 4);
  bytes.copy(output);
  return output;
}
export function encodeOsc(value: unknown): Buffer {
  const result = validateTelemetry(value);
  if (!result.ok) throw new Error(result.error.message);
  const output = Buffer.concat([oscString('/plato/telemetry'), oscString(',s'), oscString(JSON.stringify(result.value))]);
  if (output.length > MAX_PACKET_BYTES) throw new Error('OSC packet too large');
  return output;
}
export function decodeOsc(bytes: Buffer): unknown {
  if (bytes.length === 0 || bytes.length > MAX_PACKET_BYTES || bytes.length % 4 !== 0) throw new Error('Invalid OSC size');
  let cursor = 0;
  const read = (): string => {
    const end = bytes.indexOf(0, cursor);
    if (end < cursor) throw new Error('Unterminated OSC string');
    const next = Math.ceil((end + 1) / 4) * 4;
    if (next > bytes.length || bytes.subarray(end, next).some((value) => value !== 0)) throw new Error('Invalid OSC padding');
    const value = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(cursor, end));
    cursor = next;
    return value;
  };
  if (read() !== '/plato/telemetry' || read() !== ',s') throw new Error('Unsupported OSC address or type tags');
  const json = read();
  if (cursor !== bytes.length) throw new Error('Trailing OSC bytes');
  return JSON.parse(json) as unknown;
}
