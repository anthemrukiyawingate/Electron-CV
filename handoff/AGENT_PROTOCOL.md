# VoltForge agent execution and QA protocol

> **[CAPSTONE INTEGRATION TARGET]** Every developer task must produce reviewable evidence that Plato's Main/Renderer boundary remains safe during success, malformed input, timeouts, and lost telemetry.

The [backlog](BACKLOG.md) is the human planning authority. [agent-tasks.json](../scripts/agent-tasks.json) contains one execution packet for every exact `VF-*` task ID. The local harness prepares instructions and runs known validation commands; it does not authenticate to a model or silently launch an external AI service. A supervising operator or the current authorized AI development session consumes the packet. Version control, source transfer, remote repository configuration, signing, and publication belong exclusively to the Build environment team.

## Start a task with no hidden assumptions

Use Linux as the command-and-control environment. Required tools: Python 3.11+, supported Node LTS, and the delivered source/lockfile. Install `npm ci` and the pinned requirements into `.venv` before validations that use them. Offline fixture tests require only Python's standard library; actual notebook execution requires the Jupyter dependencies and permission to open local kernel sockets.

```bash
.venv/bin/python scripts/agent_harness.py list
.venv/bin/python scripts/agent_harness.py prepare VF-200 --output /tmp/VF-200-task.json
.venv/bin/python scripts/agent_harness.py validate VF-200 --output /tmp/VF-200-validation.json
```

Each packet supplies objective, predecessors, input files/environment, exact outputs, implementation steps, failure cases, validation groups, manual gates, and completion criteria. `prepare` emits both required instruction templates and records `agent_launched:false`. Unknown IDs and unknown validation group names fail. Commands are fixed argument lists without a shell; task text cannot inject shell expressions. `validate` runs the commands, bounds each process by 180 seconds (configurable 1–900), retains its actual exit code and output tail, and returns a nonzero status for any failure/timeout/unavailable tool. The validation report distinguishes automatic checks from manual gates; it always requires manual release review.

The harness is intended for Linux, matching the architecture. Windows release checks use the explicit PowerShell commands in the handoff. A Windows package cannot be qualified by this Linux harness alone. A timed-out child process can leave separately spawned services running; inspect and close task-owned development processes after an interrupted check.

## Required developer instruction

> As a Senior AI Developer and QA Auditor, execute [TASK ID]. 1) Define validation steps using Playwright logic. 2) Implement logic adhering to the EajR Signature and strict Context Isolation. 3) Document interfaces. 4) Package for dynamic deployment via Electron Forge. 5) Provide a QA Falsification audit proving safe failure modes across the Main/Renderer IPC boundary.

A task-specific file list and interfaces accompany this template; the instruction is not a substitute for the packet. Do not add generic evaluation, channel, shell, filesystem-path, or arbitrary network capabilities to Renderer. Main validates the invoking frame and data. The two public methods are `window.plato.getSnapshot()` and `window.plato.onSnapshot(callback)`.

## Required frontend instruction

> Role: Senior Graphics Programmer. Task Target: Implement docs/index.html for Phase [X]. Create a single HTML5 document with a requestAnimationFrame loop, Dynamic Resolution Scaling, and lerped UI interactions. Write a modular JavaScript closure that accurately simulates the underlying architectural concept taught in this phase's Jupyter notebook. Ensure 60FPS performance.

The harness specializes the target to the phase's standalone page and makes the performance acceptance measurable: target 60 FPS, then report actual 3840×2160 frame pacing on the target hardware. Browser scheduling cannot promise a locked frame rate. A viewport-sized screenshot is visual evidence, not a hardware benchmark. Keep source text at native CSS resolution while DRS reduces canvas pixel work, bound queues/history, stop unnecessary background work, and support reduced motion.

## Strict TDD and work ownership

1. Read the exact task, interface definitions, and prior dependencies. Name the host and the evidence mode: fixture, TypeScript unit, browser, native Electron, or physical hardware.
2. Write a test for one observable failure before implementation. Run it and save the actual failing reason. A missing module/file is a scaffold red; an assertion observing wrong behavior is a behavioral red. Do not describe one as the other.
3. Implement the smallest complete change. Retain strict typing and isolation; reject unknown values. Every notebook starts with its Capstone Markdown callout, and every script starts with the matching comment/docstring.
4. Run the same test green, then task-appropriate negative cases and integration checks. Capture actual exit status. An unavailable Windows host, MCP adapter, display, credential, or sensor means `not_run`, never `passed`.
5. Review source plus evidence together. Document the accepted schema/API, deadlines, cleanup, deployment commands, and remaining manual gates. Return the source to the Build team; do not create branches or publish it yourself.

When the user authorizes parallel agents, assign disjoint files before dispatch: Electron/contracts, standalone demos, notebooks/harness, and root integration documents. Agree on exact API and telemetry schema through the supervisor. Shared schema changes require coordination. Do not overwrite another agent's files or manufacture remote deployment. Model credentials are never part of a task packet.

## Validation groups and their limits

| Group | Actual command | What it establishes |
| --- | --- | --- |
| `curriculum` | `python -m unittest discover -s tests -p test_curriculum.py -v` | Fixture contracts, bounded calls, task selection and failure handling |
| `types` | `npm run check` | Strict Main/Renderer/source compilation |
| `unit` | `npm test` | The repository's actual automated unit/integration suite |
| `build` | `npm run build` | Compiled Electron assets and sandbox-compatible preload |
| `notebooks` | `python scripts/run-notebooks.py` | All three notebooks execute offline in isolated kernels |
| `demos` | `node --test tests/demo-red.test.mjs` | Static standalone-demo artifact contracts; not browser behavior |

Additionally run `npm run test:docs` for the actual Playwright browser suite, following its configured local server setup. Native Electron smoke tests, Windows packaging, physical producer rehearsal, target 4K performance, signing, and Pages publication each need their own evidence. See [VALIDATION.md](VALIDATION.md) for what was actually run in this delivery.

## Falsification matrix

| Boundary | Legal behavior | Injection/failure | Expected safe outcome |
| --- | --- | --- | --- |
| Renderer → preload | Named snapshot/subscription methods | Raw IPC/channel/eval attempt | No generic capability exists |
| Preload → Main | Exact bounded requestId from trusted frame | Unknown fields, malformed ID, foreign/child frame | `INVALID_REQUEST` or `UNTRUSTED_SENDER`, no privileged work |
| Invoke/reply | Typed envelope before 2000 ms | Slow/unavailable Main, late reply, destroyed window | Finite failure/retry; late reply cannot replace newer state; timers clean up |
| MCP | Discovered schema-valid tool call | Guessed name, bad schema, tool isError, lost transport | Rejection or bounded error; fixture never relabeled live |
| Telemetry → Main | Versioned validated packet | Unknown version, NaN, duplicate tracks, too many tracks, malformed OSC, oversized frame | Reject before rendering; last valid receipt time unchanged |
| Sequence/freshness | Increasing sequence, recent receipt | Replay, out-of-order, producer stall | Ordering rejection within retained sources; stale >1500 ms; disconnected >5000 ms |
| Renderer DOM | Text and bounded visual state | HTML-like sensor/learner text | Text remains inert; no evaluation |
| Lifecycle | Owned start/stop and unsubscribe | Repeated runs, cancellation, occupied ports | Explicit failure, cleanup, retained ownership evidence |

The sequence cache holds 32 source IDs and is not cryptographic replay protection. Snapshot hardware flags report producer data; a listening socket is not proof that the camera or projector is functioning.

## Traces and review records

Helper traces are newline-delimited JSON with event names, timestamp, correlation identifier, and safe metadata. IPC events include `ipc.invoke`, `ipc.resolve`, `ipc.timeout`, `ipc.rejected`, and `ipc.error`. MCP events include `mcp.initialize.*`, `mcp.discover.*`, `mcp.call.*`, and `mcp.session.timeout`. Do not log raw payloads, tool source, passwords, keys, cookies, or tokens. A task report may retain test output; review it before sharing, especially for live MCP results.

Use this evidence shape in a private review record:

```json
{
  "task": "VF-301",
  "owner": "assigned developer",
  "environment": "Linux offline fixtures",
  "versions": {"python": "record actual", "node": "record actual"},
  "red": {"command": "record exact command", "status": "observed failure", "reason": "record actual reason"},
  "green": {"command": "record exact command", "exit_code": 0, "evidence_path": "local report"},
  "negative_cases": ["timeout", "invalid request", "stale", "out-of-order"],
  "manual_gates": [{"name": "Windows native IPC", "status": "not_run"}],
  "reviewer": "pending"
}
```

For live MCP, follow [Phase 1's exact discovery/configuration flow](../01_Phase1_Main_and_Renderer_Architecture/README.md). Use a phase-specific mapping for security and IPC. Every call has a timeout; SDK cleanup is cooperative and a hung remote process may still need its owner's termination. Keep local executed notebook copies outside public `docs/`; source notebooks stay output-free. End each task by identifying its demonstrated behaviors and its unexecuted gates separately.
