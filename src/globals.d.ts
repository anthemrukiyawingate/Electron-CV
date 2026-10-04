// [CAPSTONE INTEGRATION TARGET] Browser code sees only the named public bridge.
import type { PlatoBridge } from './shared/types.ts';
declare global { interface Window { plato: PlatoBridge } }
export {};
