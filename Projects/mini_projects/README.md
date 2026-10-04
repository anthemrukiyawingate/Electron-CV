# VoltForge mini projects

> **[CAPSTONE INTEGRATION TARGET]** Build four focused pieces of Plato's reliability model before integrating the physical shadow pipeline.

Work from the supplied reference and request any branch changes from the Build environment team. Each project needs an observed red test, a passing implementation, a negative-case audit, and an explicit environment label. Use [the agent protocol](../../handoff/AGENT_PROTOCOL.md) to prepare a task packet. Python notebook fixtures are not native Electron proof.

## 1. Process-boundary explorer

**Tasks:** VF-100, VF-101, VF-102. **Inputs:** architecture notebook, built `dist/main.js`, either offline fixture or a reviewed Windows MCP session.

Create a report identifying the host/process for native window creation, app-version inspection, DOM text mutation, and attempted filesystem access. First test that an undiscovered tool fails; then discover actual schemas, choose safe argument mappings, and run the legal sequence. For native Main inspection use electron-driver's owned session; for existing-app DOM inspection use laststance/CDP. Record the app/version/window count and visible text before/after. Always stop your owned session.

**Acceptance:** exact tool inventory, no guessed argument schema, renderer has no `require`/`process`, timeout is bounded, fixture and native results labeled separately. A broken SSH tunnel and invalid app path produce actionable failures. Deliver a short annotated trace and the safe Main/Renderer explanation.

## 2. Bridge contract auditor

**Tasks:** VF-200, VF-201, VF-202. **Inputs:** `src/shared/contracts.ts`, `src/preload.ts`, security notebook.

Start with the internal legal request `{ "requestId": "audit-001" }`. Write rejection tests for wrong type, unknown fields, oversized identifier, a prototype-like key, inert code text, and a foreign frame with legal data. Prove that allowed requests pass without adding a public payload/channel argument to `window.plato.getSnapshot()`.

Compare these cases with the public HTML bridge challenge. Explain why its simulation schema and the real internal IPC schema have separate roles. Show that removing `<script>` text is insufficient; exact validation and inert text rendering address different concerns.

**Acceptance:** a rejection matrix with expected/observed results; untrusted sender rejects independently; Renderer sees only named methods. Deliver the tests and a one-page explanation of schema, authority, isolation, and CSP. Do not store a malicious string in executable source position.

## 3. Failure and recovery recorder

**Tasks:** VF-300, VF-301, VF-302. **Inputs:** IPC notebook and the request/reply contract.

Record a normal request, one simulated delay exceeding the caller's deadline, then an explicit retry with a fresh requestId. Correlate the outgoing and settling events and measure elapsed time. Demonstrate stale >1500 ms and disconnected >5000 ms using the injected fixture clock, then repeat with the actual producer on a graphical execution host.

Inject a duplicate sequence and prove the receipt timestamp is unchanged. Pause the producer, retain historical values, resume with a new valid sequence/source session, and prove live recovery. In the HTML graph, flood to the queue limit, pause/background/resume, disconnect/reconnect, and reset.

**Acceptance:** finite completion, no false live state, bounded histories, no unsupported claim of remote cancellation, and no leaked event subscriptions. Deliver the trace matrix, notebook assertions, and native rows either observed or marked `not_run`.

## 4. Producer adapter rehearsal

**Tasks:** VF-303, VF-400, VF-401. **Inputs:** the [Capstone protocol](../CAPSTONE_Plato_Dashboard_Electron/README.md), TouchDesigner/Godot owner, Windows execution account.

Run the simulator first. Configure the real producer to send version 1 telemetry to `ws://127.0.0.1:8765`, or OSC UDP `127.0.0.1:9000`, `/plato/telemetry`, with one JSON string argument. Map measured positions to x/y [-1,1], confidence [0,1], unique bounded track IDs, monotonic sequence, and explicit camera/projector flags. Choose a new source ID for a restarted producer session or retain monotonic sequence.

Falsify the mapping with an unknown version, malformed OSC padding/type tag, invalid coordinate, duplicate track, sensor unplug, occupied port, and producer stall. Keep hardware actuation outside this telemetry exercise. A TCP tunnel does not transport OSC/UDP automatically.

**Acceptance:** physical movement and dashboard movement agree; receipt age and source identity are recorded; lost sensor/producer states are honest; recovery is demonstrated. Deliver a device/version/topology record, calibration notes, and actual observed integration trace. If devices are absent, keep the hardware rows pending and submit simulator evidence only.

## Completion packet

For each project include the task ID, files changed, runtime versions, red and green commands/results, failure matrix, screenshots where useful, cleanup evidence, and remaining manual gates. Run `.venv/bin/python scripts/agent_harness.py validate TASK_ID --output /tmp/TASK_ID-validation.json` from the repository root. Submit the reviewable source and evidence to the Build team; they own version control, source transition, and publication.
