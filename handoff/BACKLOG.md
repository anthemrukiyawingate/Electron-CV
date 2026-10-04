# VoltForge sprint backlog

> **[CAPSTONE INTEGRATION TARGET]** Each acceptance artifact proves one boundary or failure mode used by the Plato dashboard. The completed reference implementation is the teaching baseline; each learner repeats the red → green → review cycle.

## Planning contract

Five sequential sprints, suggested duration one week each for a learner pair. Points below estimate learning and integration complexity, not elapsed execution time. Each sprint ends with a demo, falsification audit, and evidence review. Only the Build environment team manages branches, merges, repository import, and publication. Task status is not inferred from the existence of a file; executed delivery results live in `VALIDATION.md`.

All tasks begin from the supplied source directory, a current supported Node LTS, and (for notebooks) Python 3.11+ in a virtual environment. Offline tasks require no paid model account, MCP server, Windows host, or physical device. Live tasks explicitly list those dependencies. Names such as WINDOWS_PRIVATE_IP and REVIEWED_VERSION are placeholders requiring operator substitution.

**Ready:** input files available, owner assigned, environment named, data/authority contract written, failing example specified. **Done:** test observed failing for the intended reason, minimal implementation passes, negative case passes, interface documented, logs redacted, required platform evidence attached. A missing environment produces an explicit pending gate, not a pass.

## Sprint 0 — infrastructure bootstrapping (17 points)

### VF-000 · Establish the delivery contract · 2 points

- **Owner / dependencies:** lead architect; no predecessors.
- **Inputs:** project mandate, attribution names, Linux + Windows topology, Build team ownership.
- **Steps / outputs:** produce `README.md`, MIT `LICENSE`, mandatory phase directories, source map, scope and review gates; distinguish public mocks from Electron execution.
- **Red / green validation:** enumerate missing required documents; create them; validate internal file links and the exact project title. Reviewer checks both attributions and MIT scope.
- **Failure audit:** no assumed GitHub URL, no embedded credentials, no claim that local checkout changes Pages source.
- **Exit:** Build team can identify what to import, what to exclude, and which checks it owns.

### VF-001 · Strict TypeScript and Forge scaffold · 5 points

- **Owner / dependencies:** Electron developer; VF-000.
- **Inputs:** empty app scaffold and chosen reviewed package versions.
- **Steps / outputs:** root package and lockfile; separate Main and Browser TypeScript configs; bundled sandbox-compatible preload; Forge makers; reproducible build script.
- **Red / green validation:** missing implementation tests fail; `npm ci`, `npm run check`, `npm run build`, and `npm test` pass. Renderer compilation cannot resolve Node globals.
- **Failure audit:** no global Electron dependency, no source evaluation through preload, no hidden CDN dependencies, no development credentials in package output.
- **Exit:** `dist/main.js` launches through the root package; Forge packaging commands and platform restrictions are documented.

### VF-002 · Linux notebook and MCP harness · 5 points

- **Owner / dependencies:** automation engineer; VF-000.
- **Inputs:** Python environment, `requirements.txt`, MCP adapter documentation.
- **Steps / outputs:** schema-aware stdio MCP helper, offline fixture, notebook runner, explicit live-mode opt-in and deadlines.
- **Red / green validation:** missing helper fails; unittest validates timeout, malformed response, tool rejection, and absence of live side effects by default. All three notebooks execute offline.
- **Failure audit:** list tool schemas before invocation; unavailable adapter never produces a simulated result labeled live; errors carry structured codes.
- **Exit:** new learner executes offline laboratories from either repository or notebook directory without editing imports.

### VF-003 · Agent task dispatch and audit format · 3 points

- **Owner / dependencies:** QA lead; VF-000, VF-001, VF-002.
- **Inputs:** this backlog and the two mandated developer instruction templates.
- **Steps / outputs:** `AGENT_PROTOCOL.md`, machine-readable task manifest, local harness for selecting tasks and running validation. Separate file ownership for concurrent agents.
- **Red / green validation:** unknown task ID fails; known task emits its exact inputs, outputs, test commands, and falsification requirements. No implicit cloud/model invocation.
- **Failure audit:** harness refuses ambiguous/unknown commands rather than evaluating user input; evidence states whether red failure was environmental or behavioral.
- **Exit:** another developer can execute a card without inventing interface names or setup assumptions.

### VF-004 · Cross-platform connectivity rehearsal · 2 points

- **Owner / dependencies:** Windows operator and QA; VF-001, VF-002; two actual hosts and approved SSH account.
- **Inputs:** Windows interactive session, Linux host, reviewed MCP adapter.
- **Steps / outputs:** version inventory, SSH host fingerprint verification, loopback CDP launch, local forwarding, `/json/version` response, tool inventory.
- **Validation:** deadline-bound discovery succeeds through tunnel; stopping SSH produces a bounded failure. Main evaluation is demonstrated through the owned Electron session, separately from CDP DOM evaluation.
- **Failure audit:** verify bound addresses and no public CDP firewall rule. Prove untrusted host cannot reach debugger directly.
- **Exit:** evidence attached by workstation owner; pending until real hosts are available.

## Sprint 1 — architecture (13 points)

### VF-100 · Native window and Main laboratory · 5 points

- **Owner / dependencies:** automation engineer; VF-002, VF-004 for live mode.
- **Inputs:** architecture notebook and driver tool schema inventory.
- **Steps / outputs:** start one owned Electron session, enumerate window, evaluate a harmless Main fact (`app.getVersion()`), stop the owned session; document process ownership.
- **Validation:** offline fixture predicts the trace; live Playwright/driver run observes native window count and Main result. Always close the session in cleanup.
- **Failure audit:** invalid entry path, session already running, lost transport, and missing start tool fail explicitly. Main evaluation never becomes a renderer API.
- **Exit:** notebook identifies which host owns each process and why CDP alone cannot perform this exercise.

### VF-101 · Sandboxed renderer and DOM laboratory · 3 points

- **Owner / dependencies:** Electron developer; VF-001, VF-100.
- **Inputs:** secure BrowserWindow and preload.
- **Steps / outputs:** inspect the renderer through CDP or Electron Playwright; manipulate a harmless DOM label through the privileged test harness; inspect `typeof require` in page context.
- **Validation:** visible label changes; `require` and `process` are unavailable; context isolation and sandbox preferences remain enabled.
- **Failure audit:** popup and navigation attempts fail; no filesystem or shell capability is exposed.
- **Exit:** learner can explain why a DOM mutation does not authorize reading OS files.

### VF-102 · Architecture engine mock · 5 points

- **Owner / dependencies:** graphics developer; VF-101.
- **Inputs:** conceptual Main/Renderer/OS model.
- **Steps / outputs:** standalone `docs/index.html` and `docs/phase-1/index.html`; spawn mock windows, attempt restricted file access, visualize allowed mediated requests.
- **Validation:** Playwright clicks each control and checks state transitions. Check offline direct-file launch, keyboard access, 390 px width, and 4K viewport.
- **Failure audit:** no real OS calls; simulator status labeled; window/history limits prevent unbounded state.
- **Exit:** DRS, time-based easing, visibility handling, and a measurable frame-rate display operate without external assets.

## Sprint 2 — context bridge and security (16 points)

### VF-200 · Typed, minimal preload contract · 5 points

- **Owner / dependencies:** Electron developer; VF-101.
- **Inputs:** documented request/reply union and trusted application URL.
- **Steps / outputs:** expose named methods through contextBridge; keep channels private; wrap invoke in finite deadlines; validate sender frame in Main.
- **Validation:** real renderer sees only named public methods; forged channel, child frame, foreign origin, and unknown request fields are rejected.
- **Failure audit:** no raw `ipcRenderer` object, generic send method, `eval`, or user-controlled path resolution.
- **Exit:** exact API, error codes, and authority model in the Capstone guide.

### VF-201 · Security falsification notebook · 3 points

- **Owner / dependencies:** automation engineer; VF-200.
- **Inputs:** bridge schema and malicious data corpus.
- **Steps / outputs:** security notebook compares valid structured data, unknown fields, wrong types, excessive size, prototype-like keys, and attempted code strings.
- **Validation:** permitted command passes; every invalid case is rejected for an explicit reason; untrusted values stay text.
- **Failure audit:** schema rejection is not represented as comprehensive XSS protection or a general code sanitizer.
- **Exit:** learner explains the difference between input validation, sender authorization, context isolation, and CSP.

### VF-202 · Context bridge challenge · 5 points

- **Owner / dependencies:** graphics developer; VF-201.
- **Inputs:** notebook cases and allowed demo request schema.
- **Steps / outputs:** standalone `docs/phase-2/index.html`; edit a payload, select challenges, observe gate decisions and an explanatory trace.
- **Validation:** valid payload accepted; script string and extra authority rejected; score/state updates; malicious text never executes.
- **Failure audit:** JSON parse errors recover without reloading; renderer remains interactive after repeated rejections.
- **Exit:** challenge includes a clear explanation of why replacing `<script>` text is insufficient.

### VF-203 · Packaged security inspection · 3 points

- **Owner / dependencies:** QA and Build team; VF-200.
- **Inputs:** packaged native bundle on target OS.
- **Validation:** inspect preferences, navigation, CSP, default closed debug ports, package contents and preload loading. Run actual sandboxed renderer smoke test.
- **Failure audit:** development-only debug switches are absent from release launch; signing credentials never packaged.
- **Exit:** target-host package evidence attached; a headless host inability to launch cannot count as security success.

## Sprint 3 — IPC and system integration (16 points)

### VF-300 · Async request/reply and graceful failure · 5 points

- **Owner / dependencies:** Electron developer; VF-200.
- **Inputs:** IPC channel, response union, request ID rules.
- **Steps / outputs:** `ipcMain.handle`/`ipcRenderer.invoke`; correlate responses; time out pending work; show loading, error, retry, and stale state.
- **Validation:** fulfillment, handler rejection, no reply, duplicate/late reply, destroyed window, and retry all have explicit expected outcomes.
- **Failure audit:** timeouts clear timers, late replies cannot replace newer UI state, and a client deadline is not falsely described as remote cancellation.
- **Exit:** test traces explain the return trip across the isolated context.

### VF-301 · IPC notebook and bounded orchestration · 3 points

- **Owner / dependencies:** automation engineer; VF-300.
- **Inputs:** request fixture and helper.
- **Steps / outputs:** notebook records request ID, send/settle times, error code, and retry policy. Distinguish transport timeout from application rejection.
- **Validation:** normal and timeout fixtures run offline; live tests invoke the actual bridge API. Repeated execution leaves no background tasks.
- **Failure audit:** no indefinite wait on MCP start, initialization, list-tools, call-tools, or teardown.
- **Exit:** notebook and helper produce machine-readable, payload-redacted logs.

### VF-302 · IPC node graph simulator · 5 points

- **Owner / dependencies:** graphics developer; VF-301.
- **Inputs:** state machine: queued → pending → fulfilled/rejected/timed out.
- **Steps / outputs:** standalone `docs/phase-3/index.html`; visual outbound/return paths, latency control, disconnect and failure injection, bounded trace.
- **Validation:** change latency and deadline, dispatch multiple requests, force disconnect, then reconnect and retry. Check distinct correlated outcomes.
- **Failure audit:** paused animation/background tab does not invent successful replies; queue capacity is enforced and communicated.
- **Exit:** the graph communicates promises without teaching that messages execute synchronously.

### VF-303 · Telemetry transport boundary · 3 points

- **Owner / dependencies:** Electron developer; VF-300.
- **Inputs:** versioned telemetry and OSC mapping from Capstone guide.
- **Steps / outputs:** loopback receiver, bounded message size/rate, health snapshot, disposal and bind-error handling.
- **Validation:** inject valid, invalid, oversized, stale, out-of-order, and malformed packets; simulate occupied ports; test cleanup/restart.
- **Failure audit:** UDP packet loss and lack of authentication are explicit; physical hardware is never shown healthy merely because a socket opened.
- **Exit:** fixtures exercise actual local transport as well as pure parsing.

## Sprint 4 — Plato integration and release (21 points)

### VF-400 · Desktop dashboard and simulator · 5 points

- **Owner / dependencies:** Electron developer; VF-303.
- **Inputs:** telemetry service and desktop UI design.
- **Steps / outputs:** native dashboard with shadow position, confidence/health telemetry, source status and age; deterministic local producer; history bounds and retry affordance.
- **Validation:** simulator data traverses transport → Main validation → bridge → visible renderer. Stop producer and observe stale state; restart and recover.
- **Failure audit:** invalid data cannot refresh freshness or overwrite last valid values; disconnect preserves clearly labeled historical values.
- **Exit:** native launch and local end-to-end test evidence; no model-generated runtime code execution.

### VF-401 · TouchDesigner / Godot producer rehearsal · 5 points

- **Owner / dependencies:** physical pipeline owner and QA; VF-400; actual producer application/hardware.
- **Inputs:** OSC address/type tags and JSON schema, sample adapter instructions.
- **Steps / outputs:** map normalized shadow coordinates and measured confidence/status to versioned telemetry; document units, frame timestamp, frequency and source identity.
- **Validation:** physical movement causes matching UI movement; unplug sensor, stall producer, send unknown schema version; confirm honest statuses and recovery.
- **Failure audit:** no hardware control/actuation; no claim of true hardware health when only transport data exists; UDP routing validated separately from TCP.
- **Exit:** physical demonstration evidence, owner, device details and network topology attached.

### VF-402 · Public Capstone simulation · 3 points

- **Owner / dependencies:** graphics developer; VF-400.
- **Inputs:** physical-shadow concept, no proprietary original assets.
- **Steps / outputs:** standalone `docs/capstone/index.html`, parameter controls, live simulated silhouette/telemetry, sensor failure and restoration.
- **Validation:** values react to controls; failure/stale states visible; all phase links work from a GitHub repository subpath.
- **Failure audit:** simulated data never presented as connected hardware; screen-reader summary conveys the canvas state.
- **Exit:** anonymous offline browser user can explore the complete pipeline.

### VF-403 · Release and performance qualification · 5 points

- **Owner / dependencies:** QA and Build environment team; VF-203, VF-401, VF-402.
- **Inputs:** clean source bundle, exact Node/package versions, target Windows and GPU/monitor profile.
- **Steps / outputs:** clean install, typed checks, tests, package and make; clean-machine ZIP extraction/start/removal (install/uninstall if a later installer is added); 4K interaction frame-time report with p50/p95 and DRS floor.
- **Validation:** verify phase links at actual Pages subpath, accessibility/reduced motion, background resume, offline behavior, package manifest and signing.
- **Failure audit:** no universal FPS claim; benchmark records hardware, dimensions, DPR, browser, interaction, duration and any throttling.
- **Exit:** Build team signs off or records failed gate with owner; no implied publication from local files.

### VF-404 · Operations handoff and publication · 3 points

- **Owner / dependencies:** lead architect and Build environment team; VF-403.
- **Inputs:** final source, validation, handoff checklist and attribution.
- **Steps / outputs:** source checksums, reproducible command log, known limits, rollback plan and ownership table. Build team imports source, selects branch `/docs`, publishes and records URL.
- **Validation:** independent operator repeats startup, fault recovery, and restore using only the dossier. Verify release URL from outside development machine.
- **Failure audit:** no private notebook outputs, tokens, local profiles, dev servers or dependency folders in public artifact.
- **Exit:** curriculum acceptance plus separately documented publication and Windows/hardware qualification. Development is not authorized to perform the team's VCS steps.

## Dependency path and acceptance evidence

```text
VF-000 → VF-001 → VF-101 → VF-200 → VF-300 → VF-303 → VF-400 → VF-401
   └──→ VF-002 → VF-004 → VF-100       └──→ VF-301 → VF-302     │
                  VF-101 → VF-102     VF-200 → VF-201 → VF-202   │
                                     VF-200 → VF-203          │
                                              VF-400 → VF-402 ─┤
                                              VF-203 ─────────┴→ VF-403 → VF-404
VF-000 + VF-001 + VF-002 → VF-003
```

For every task record: owner, dependency versions, environment, failing command and reason, passing command and output, negative cases, screenshots where useful, residual risk, and reviewer. Keep logs free of payloads that could contain secrets. Test assets, notebooks, interface documentation, and production implementation are reviewable together. Windows, hardware, 4K performance, code-signing and Pages gates are owned by the corresponding environment operators.
