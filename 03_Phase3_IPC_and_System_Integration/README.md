# Phase 3: IPC and system integration

> **[CAPSTONE INTEGRATION TARGET]** Keep Plato responsive and honest when Main, telemetry producers, or automation transports slow down or disappear.

Complete VF-300 through VF-303 with [ipc.ipynb](ipc.ipynb). Explore [the asynchronous bus simulation](../docs/phase-3/index.html). Inputs are the Phase 2 contract, `src/preload.ts`, `src/main.ts`, and `src/telemetry.ts`.

```bash
.venv/bin/python scripts/run-notebooks.py --phase ipc --output-dir /tmp/voltforge-notebooks
npm run check
npm test
npm run build
```

## Trace the actual request

`window.plato.getSnapshot()` → preload requestId → `ipcRenderer.invoke('plato:snapshot', request)` → Main sender/schema checks → `Result<Snapshot>` → preload settlement → UI. The reference caller deadline is **2000 ms**. A timeout settles the caller; it does not cancel work already executing in Main. Timers and subscriptions need cleanup, and late replies must not overwrite a newer UI state.

The notebook uses 10/100 ms for a fast deterministic timeout test. Its Python cancellation semantics are explicitly a fixture convenience. The returned failure envelope carries a typed application code; a broken MCP connection instead fails at the automation transport layer.

## Freshness and source ordering

Main uses its own receipt time: data is live through 1500 ms, stale after 1500 ms, and disconnected after 5000 ms. It retains the last accepted telemetry for historical display. The producer's clock does not control freshness. Listener status separately describes whether WS/OSC reception is starting, listening, or in error; an open socket does not prove healthy hardware.

For each retained source, sequence must increase. Duplicate/out-of-order/malformed packets cannot refresh the receipt time or replace the accepted sample. The sequence map retains the most recent **32 source IDs**, so this is bounded ordering detection, not cryptographic replay protection. On producer restart, retain monotonic sequence or use a distinct source ID for the session.

## Failure-oriented exercise

| Inject | Expected result | Required evidence |
| --- | --- | --- |
| Legal request, no producer | Successful snapshot with disconnected state | Correlated invoke/resolve events |
| Malformed request | `INVALID_REQUEST` | Rejection before service work |
| Foreign frame | `UNTRUSTED_SENDER` | Frame identity, valid shape still rejected |
| Work slower than caller deadline | `TIMEOUT`, retry available | Finite elapsed time; late result ignored |
| Producer silent for 1501/5001 ms | Stale/disconnected, last values labeled historical | Receiver-time state transitions |
| Old sequence or malformed telemetry | Reject count increases, accepted sample unchanged | Sequence, receipt time before/after |
| Fresh valid packet | Live state returns | New receipt time and visible values |
| Destroyed window or unsubscribe | No leaked callbacks/timers | Native teardown test |

## Actual simulator and live bridge

On the graphical execution host, run `npm start`; in another terminal run `npm run telemetry:simulate`. WebSocket listens on loopback 8765; OSC uses UDP loopback 9000 with address `/plato/telemetry` and exactly one JSON string argument. Follow the [Capstone schema and producer guide](../Projects/CAPSTONE_Plato_Dashboard_Electron/README.md). The TCP SSH tunnel for CDP does not carry OSC/UDP.

For notebook-native evidence, discover tool schemas as in Phase 1, create an IPC-specific Renderer mapping for `await window.plato.getSnapshot()`, then run:

```bash
.venv/bin/python scripts/run-notebooks.py --phase ipc --live \
  --mcp-config /tmp/voltforge-ipc-mcp.json --output-dir /tmp/voltforge-live-ipc
```

Stop/start a producer and repeat the live call to observe normal, stale, and disconnected cases. Exercise native timeout/rejection through controlled tests; adding arbitrary delay/eval privileges to the public bridge is not part of the solution. Record exact actual output; fixture assertions cannot verify Windows IPC.

Submit the failure matrix, payload-redacted JSON traces, cleanup observation, and any pending Windows/hardware rows. Proceed to [mini projects](../Projects/mini_projects/README.md) and the [Capstone](../Projects/CAPSTONE_Plato_Dashboard_Electron/README.md).
