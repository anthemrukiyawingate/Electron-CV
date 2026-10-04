// [CAPSTONE INTEGRATION TARGET] Browser-safe contract; no Node or Electron authority.
export type HardwareState = 'online' | 'offline';
export interface ShadowObject { id: string; x: number; y: number; confidence: number }
export interface Telemetry { version: 1; sequence: number; timestamp: number; source: string; objects: ShadowObject[]; hardware: { camera: HardwareState; projector: HardwareState } }
export type Transport = 'ws' | 'osc';
export type ListenerState = 'starting' | 'listening' | 'error';
export interface Snapshot { state: 'live' | 'stale' | 'disconnected'; telemetry: Telemetry | null; transport: Transport | null; receivedAt: number | null; rejected: number; listeners: Record<Transport, ListenerState> }
export type FailureCode = 'INVALID_REQUEST' | 'UNTRUSTED_SENDER' | 'TIMEOUT' | 'INTERNAL';
export type Result<T> = { ok: true; value: T } | { ok: false; error: { code: FailureCode; message: string } };
export interface SnapshotRequest { requestId: string }
export interface PlatoBridge { getSnapshot(): Promise<Result<Snapshot>>; onSnapshot(callback: (snapshot: Snapshot) => void): () => void }
