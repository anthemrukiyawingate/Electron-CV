# Phase 2: Context bridge and security

> **[CAPSTONE INTEGRATION TARGET]** Keep untrusted telemetry and renderer input on the data side of Plato's privilege boundary.

Complete VF-200 through VF-203. Inputs: the Phase 1 notebook, the actual BrowserWindow preferences, `src/preload.ts`, and `src/shared/contracts.ts`. Use [security.ipynb](security.ipynb) and [the bridge challenge](../docs/phase-2/index.html).

```bash
.venv/bin/python scripts/run-notebooks.py --phase security --output-dir /tmp/voltforge-notebooks
npm run check
npm test
```

## Exact authority contract

Preload exposes `window.plato.getSnapshot()` and `window.plato.onSnapshot(callback)`, whose return value unsubscribes the callback. The Renderer never picks an IPC channel or creates the internal request payload. Preload privately invokes `plato:snapshot` with exactly `{requestId: string}`; the identifier contains 1–64 ASCII letters, digits, `_`, or `-`. Main checks the actual trusted top-level frame before acting and independently checks the payload.

Results are `{ok:true,value:Snapshot}` or `{ok:false,error:{code,message}}`. Codes are `INVALID_REQUEST`, `UNTRUSTED_SENDER`, `TIMEOUT`, and `INTERNAL`. The [Capstone guide](../Projects/CAPSTONE_Plato_Dashboard_Electron/README.md) is the full telemetry contract. Unknown fields, duplicate track IDs, nonfinite/range-invalid numbers, unknown schema versions, excessive tracks, and invalid hardware states reject.

The Python notebook exercises decoded schema validation and models sender rejection. TypeScript tests exercise actual application contract functions. A native Electron launch is still needed to inspect sandbox globals, contextBridge, navigation, and CSP. Do not call a passing fixture test proof of a Chromium security boundary.

## Red → green exercise

1. Define an extra-field attack and write an assertion expecting `INVALID_REQUEST`; identify the vulnerable behavior a new implementation would show.
2. Validate the exact payload in Main. Never solve this by removing the word `script`, replacing angle brackets, or evaluating attacker text.
3. Independently test a foreign/child frame with valid input and expect `UNTRUSTED_SENDER`.
4. Inspect the public bridge: no raw `ipcRenderer`, generic channel method, arbitrary file path, shell command, or evaluation method.
5. Render all untrusted labels as text. Record which control addresses data shape, authority, runtime isolation, or script loading.

The example malicious strings are inert and safe to inspect. A strict schema is not a universal XSS sanitizer. Context isolation does not validate values automatically. A CSP does not replace authorization.

## Native live inspection

Use Phase 1's discovery flow, then a **separate phase-specific config**. Map the Renderer tool to inspect `Object.keys(window.plato)`, `typeof require`, `typeof process`, and `await window.plato.getSnapshot()`. Adapt expression wrapping and arguments to the discovered schema. Expected runtime facts: only the documented methods are public; `require`/`process` are unavailable in page context; a normal snapshot call returns its typed envelope. The API intentionally provides no parameter through which Renderer can forge an internal requestId.

```bash
.venv/bin/python scripts/run-notebooks.py --phase security --live \
  --mcp-config /tmp/voltforge-security-mcp.json --output-dir /tmp/voltforge-live-security
```

Do not reuse an architecture DOM-mutation mapping and describe that output as a security inspection. Verify the release package on Windows with debugging ports closed; this remains a Build-team/QA gate. Completion requires a written rejected-payload matrix and honest native test status. Continue with [Phase 3](../03_Phase3_IPC_and_System_Integration/README.md).
