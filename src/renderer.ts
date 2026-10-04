// [CAPSTONE INTEGRATION TARGET] A browser-only renderer visualizes validated snapshots.
import type { Snapshot, ShadowObject } from './shared/types.ts';
function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing view element: ${id}`);
  return found as T;
}
const canvas = element<HTMLCanvasElement>('shadow-canvas');
const context = canvas.getContext('2d');
if (!context) throw new Error('Canvas rendering unavailable');
const ctx: CanvasRenderingContext2D = context;
const retry = element<HTMLButtonElement>('retry');
const trails = element<HTMLInputElement>('trails');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let snapshot: Snapshot | null = null;
let requestPending = false;
let disposed = false;
let unsubscribe: (() => void) | undefined;
const positions = new Map<string, { x: number; y: number; trail: Array<{ x: number; y: number }> }>();
const text = (id: string, value: string): void => { element(id).textContent = value; };
function status(state: string, message: string): void {
  const chip = element('connection-state');
  if (chip.textContent !== state) chip.textContent = state;
  chip.dataset['state'] = state;
  text('status-message', message);
}
function render(value: Snapshot): void {
  snapshot = value;
  const data = value.telemetry;
  const states = { live: 'Validated telemetry is arriving from your local producer.', stale: 'Signal is stale. Positions show the last accepted frame.', disconnected: data ? 'Producer disconnected. Reconnect it to resume updates.' : 'No telemetry yet. Start a simulator or local producer.' };
  status(value.state, states[value.state]);
  text('source', data?.source ?? '—');
  text('transport', value.transport?.toUpperCase() ?? '—');
  text('sequence', data ? String(data.sequence) : '—');
  text('rejected', String(value.rejected));
  text('age', value.receivedAt === null ? '—' : `${Math.max(0, (Date.now() - value.receivedAt) / 1000).toFixed(1)} s ago`);
  text('object-count', String(data?.objects.length ?? 0).padStart(2, '0'));
  text('rejection-note', value.rejected ? 'Invalid, excessive, or out-of-order packets were rejected in Main.' : 'Only validated, versioned packets reach this view.');
  for (const [id, state] of [['camera', data?.hardware.camera ?? 'unknown'], ['projector', data?.hardware.projector ?? 'unknown'], ['ws', value.listeners.ws], ['osc', value.listeners.osc]]) {
    if (id === undefined || state === undefined) continue;
    const field = element(`${id}-state`);
    field.textContent = state.toUpperCase();
    field.dataset['good'] = String(state === 'online' || state === 'listening');
  }
  element('empty-state').hidden = (data?.objects.length ?? 0) > 0;
  if (data && data.objects.length === 0) { const heading = element('empty-state').querySelector('h3'); if (heading) heading.textContent = 'No shadows in this frame'; }
  const rows = element('object-rows');
  const fragment = document.createDocumentFragment();
  for (const object of data?.objects ?? []) {
    const row = document.createElement('tr');
    for (const value of [object.id, object.x.toFixed(3), object.y.toFixed(3), `${Math.round(object.confidence * 100)}%`]) {
      const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
    }
    fragment.append(row);
  }
  if (!data?.objects.length) { const row = document.createElement('tr'); const cell = document.createElement('td'); cell.colSpan = 4; cell.textContent = 'No validated objects in the current frame.'; row.append(cell); fragment.append(row); }
  rows.replaceChildren(fragment);
}
async function refresh(): Promise<void> {
  if (requestPending || disposed) return;
  requestPending = true; retry.disabled = true; retry.textContent = 'Loading…';
  status('loading', 'Requesting current status from Main…');
  try {
    if (!window.plato) throw new Error('The isolated preload bridge is unavailable. Restart the application.');
    const result = await window.plato.getSnapshot();
    if (disposed) return;
    if (result.ok) render(result.value); else status('error', `${result.error.code}: ${result.error.message}`);
  } catch (error: unknown) { status('error', error instanceof Error ? error.message : 'Unable to contact Main. Retry the request.'); }
  finally { requestPending = false; retry.disabled = false; retry.textContent = 'Refresh status ↗'; }
}
retry.addEventListener('click', () => { void refresh(); });
if (window.plato) unsubscribe = window.plato.onSnapshot(render);
void refresh();

let resolution = 1;
let previousTime = 0;
let averageMs = 16.67;
let frames = 0;
let animationId = 0;
function drawObject(object: ShadowObject, width: number, height: number, delta: number): void {
  const target = { x: (object.x + 1) * width / 2, y: (1 - object.y) * height / 2 };
  const position = positions.get(object.id) ?? { ...target, trail: [] };
  const ease = reducedMotion.matches ? 1 : 1 - Math.exp(-delta / 90);
  position.x += (target.x - position.x) * ease; position.y += (target.y - position.y) * ease;
  if (trails.checked && !reducedMotion.matches) { position.trail.push({ x: position.x, y: position.y }); if (position.trail.length > 60) position.trail.shift(); }
  else position.trail.length = 0;
  positions.set(object.id, position);
  if (position.trail.length > 1) {
    ctx.beginPath(); const first = position.trail[0]!; ctx.moveTo(first.x, first.y);
    for (const point of position.trail) ctx.lineTo(point.x, point.y);
    ctx.strokeStyle = '#70e4da35'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  ctx.globalAlpha = snapshot?.state === 'live' ? 1 : .4;
  ctx.beginPath(); ctx.arc(position.x, position.y, 24, 0, Math.PI * 2); ctx.strokeStyle = '#70e4da44'; ctx.stroke();
  ctx.beginPath(); ctx.arc(position.x, position.y, 6 + object.confidence * 5, 0, Math.PI * 2); ctx.fillStyle = '#70e4da'; ctx.fill();
  ctx.fillStyle = '#b7d5df'; ctx.font = '10px ui-monospace, monospace'; ctx.fillText(object.id, Math.min(width - 100, position.x + 18), Math.max(18, position.y - 15));
  ctx.globalAlpha = 1;
}
function frame(time: number): void {
  const delta = previousTime ? Math.min(100, time - previousTime) : 16.67; previousTime = time;
  averageMs = averageMs * .95 + delta * .05;
  frames++;
  if (frames % 90 === 0) { if (averageMs > 21) resolution = Math.max(.5, resolution - .1); else if (averageMs < 17.5) resolution = Math.min(1, resolution + .05); text('fps', String(Math.round(1000 / averageMs))); text('resolution', String(Math.round(resolution * 100))); }
  const width = canvas.clientWidth, height = canvas.clientHeight;
  const scale = Math.min(devicePixelRatio, 2) * resolution;
  if (canvas.width !== Math.round(width * scale) || canvas.height !== Math.round(height * scale)) { canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale); positions.clear(); }
  ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = '#233747'; ctx.lineWidth = .6;
  for (let x = 0; x <= width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
  for (let y = 0; y <= height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
  ctx.strokeStyle = '#426273'; ctx.setLineDash([3, 6]); ctx.beginPath(); ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke(); ctx.setLineDash([]);
  const current = snapshot?.telemetry?.objects ?? [];
  const active = new Set(current.map((object) => object.id));
  for (const id of positions.keys()) if (!active.has(id)) positions.delete(id);
  for (const object of current) drawObject(object, width, height, delta);
  if (!document.hidden && !disposed) animationId = requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { cancelAnimationFrame(animationId); previousTime = 0; if (!document.hidden && !disposed) animationId = requestAnimationFrame(frame); });
animationId = requestAnimationFrame(frame);
window.addEventListener('beforeunload', () => { disposed = true; unsubscribe?.(); cancelAnimationFrame(animationId); }, { once: true });
