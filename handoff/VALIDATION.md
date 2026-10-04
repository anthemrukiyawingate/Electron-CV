# VoltForge validation record

> Historical record from 2026-10-03. These runtime results were not repeated for intake return2. See [the current correction record](INTAKE_RETURN_2.md) for the corrected source-tree checks. Generated binaries, dependency folders and test captures mentioned below are not included in this handoff.

> **[CAPSTONE INTEGRATION TARGET]** Validate the real Main/Renderer boundary independently from the browser engine mocks and offline notebook fixtures. Preserve the distinction between a demonstrated behavior and a pending release gate.

Implementation date: **2026-10-03**. Development host: Linux x64, Node **24.13.1**, npm **11.8.0**, Python **3.14.8**. Application pins: Electron **44.5.1**, Electron Forge **8.0.1**, TypeScript **5.9.3**, Playwright **1.63.0**. See lockfile for the full JavaScript dependency graph and `requirements.txt` for the Python direct pins.

## Test-first execution evidence

Three developer agents worked with separate file ownership: native Electron/core QA, standalone demo/graphics QA, and notebook/MCP curriculum. The lead integrated the source, authored the backlog/handoff and delivery validator, and exercised the browser UI.

| Area | Initial observed failure | Implementation and subsequent evidence |
| --- | --- | --- |
| Native contracts | Node tests failed to load the missing contract implementation | schema, ordering, OSC, sender policy, deadline and transport tests pass |
| Public pages | each of five missing HTML files caused ENOENT in authored tests | all pages exist; static checks, strict checked JavaScript and browser behaviors pass |
| Notebook helper | unittest import failed because `notebook_support` did not exist | helper and task harness added; curriculum tests pass |
| Delivery validator | unittest import failed because `check-delivery.py` did not exist | missing-link and malformed-notebook assertions pass |
| Integration corrections | tests added for duplicate track IDs and reference freshness/history rules failed before correction | Python fixture now matches the native contract |

The initial missing-module/file failures prove test-first scaffolding, not that every security property was individually mutation-tested. Later behavioral tests exercise actual failure states. A browser selector ambiguity was corrected after a first run; it was a test error, not a passing application result.

## Executed checks

| Check | Result | Scope |
| --- | --- | --- |
| npm dependency installation | Passed | pinned lockfile generated; install audit reported zero vulnerabilities at that time |
| `npm run check` | Passed | strict Main, browser-only Renderer, test/config TypeScript and all five checked-JavaScript demos |
| `npm run test:unit` | **8 passed** | schemas, trusted frame predicate, replay/freshness, rate gates, OSC encoding, deadlines, actual local WS/UDP sockets, oversized frame closure and bind errors |
| `python3 -m unittest discover -s tests -p 'test_*.py' -v` | **21 passed** | 18 curriculum/harness tests and 3 delivery-validator tests |
| `npm run test:static` | Passed, five artifact assertions | no external scripts/CDN, callouts, canvas, reduced-motion and text rendering markers |
| `npm run build` | Passed | bundled Main, sandbox-compatible Preload, Renderer and local assets |
| `npm run test:electron` | Passed | actual sandboxed Electron, valid ingress through visible UI, untrusted window rejection, stale/disconnect/recovery and stalled-Main deadline |
| `npm run package` | Passed on Linux | ASAR application bundle |
| `npm run make` | Passed on Linux | portable ZIP; not an installer |
| Packaged-executable Electron acceptance | Passed on Linux | same full suite against the built executable; sandbox remains enabled |
| In-app browser exploration | Passed | architecture controls, exact-schema acceptance/rejection, IPC correlation/timeout/disconnect, Capstone pause/stale/recovery/fault, responsive navigation |
| `VOLTFORGE_DEMO_URL=http://127.0.0.1:4187 npm run test:docs` | **12 passed** (19.9 s) | behavior, queue cap, retained stale values, responsive/reduced-motion and local frame samples |
| `.venv/bin/python scripts/run-notebooks.py --output-dir /tmp/voltforge-executed-notebooks` | **3 passed / 18 code cells** | architecture 5, security 6, IPC 7; isolated kernels, no errors, no live MCP credentials |
| `python3 scripts/check-delivery.py` | **Passed / 54 source files** | required files, local Markdown links and opening capstone callouts |

Runtime tests require permission to create local sockets and launch graphical processes. Initial sandbox-denied socket creation and dependency network DNS failures were resolved through the environment's approved execution path. The application sandbox itself was **never disabled** to achieve a test pass. The Electron test explicitly asserts that `--no-sandbox` is absent.

### Native falsification details

The real Electron test verifies that Renderer has neither `require` nor `process`, and that the public bridge has exactly `getSnapshot` and `onSnapshot`. A separate hostile window using the same preload receives `UNTRUSTED_SENDER`. Maliciously formed telemetry is rejected; a valid object becomes visible; reported offline hardware is displayed offline; stopping fresh packets produces stale then disconnected state; sending a newer frame restores live state.

The test replaces Main's status handler through privileged Playwright fault injection with a never-settling promise. Preload returns `TIMEOUT` and emits a JSON event containing the request ID. This test does not add a public debug or evaluation API. Pure tests exercise frame/URL authorization predicates; the native hostile-window test is not a comprehensive penetration test of all Electron/Chromium attack surfaces.

Transport tests send real JSON WebSocket messages and OSC datagrams over loopback. They test unknown fields, invalid OSC, browser Origin refusal, an oversized WS message, retained last-valid data and an occupied port. These are real transport checks without physical hardware.

### Rendering observations

The standalone frontmost Chromium sample observed **60 FPS / 16.7 ms mean frame interval / 100% DRS** at both **1440×960** and **3840×2160** in this Linux environment. This is a short local sample, not sustained target-Windows qualification or a guaranteed locked framerate. Browser-in-app background/tool-throttled samples fell substantially below 60 FPS, demonstrating why environment and visibility must be recorded. DRS and time-based state transitions remained available.

Mobile pages were checked at 390×844, including reduced-motion preference. Visual review covered the architecture view and Capstone shadow reconstruction. The public demos are explicitly simulated, use no real hardware endpoint, and expose no privileged capabilities. Phase mock thresholds are displayed in each page and are pedagogical parameters; the native contract uses 1.5-second stale and 5-second disconnected thresholds.

### Generated local artifacts

- Linux portable ZIP: `out/make/zip/linux/x64/Plato-linux-x64-1.0.0.zip` (approximately 118 MiB). SHA-256: `c9691c208677298e2314a39235fee222473fb68ecd1bebfbbf5e665f70f169bb`.
- Native dashboard screenshot: `test-results/electron/plato-live.png`.
- Browser test evidence is generated under `test-results/demos/` and may be replaced by a subsequent test run.
- Notebook execution can generate reviewed copies with `--output-dir /tmp/voltforge-executed-notebooks`; source notebooks remain output-free.

Generated binaries, dependencies, virtual environments and test captures are separate from the source intake and the public `docs/` artifact.

## Repeat on the release host

```bash
npm ci
npm run check
npm run test:unit
npm run test:static
npm run build
npm run test:electron
python3 -m unittest discover -s tests -p 'test_*.py' -v
.venv/bin/python scripts/run-notebooks.py
python3 scripts/check-delivery.py
```

For browser acceptance, install the matching browser using `npx playwright install chromium`, then run `npm run test:docs`. The config starts a loopback server on port 4173. If that port is occupied, run a server on another free port and set `VOLTFORGE_DEMO_URL` to its URL. Do not stop unrelated processes. `PYTHON` may select the Python executable used by the preview server; Windows otherwise uses `python`.

For Linux packaged acceptance after `npm run make`:

```bash
VOLTFORGE_ELECTRON_EXECUTABLE="$PWD/out/Plato-linux-x64/plato" npm run test:electron
```

Use the Windows executable path with the corresponding PowerShell environment variable on the target host. The Build team determines final release names and signing status.

## Required environment gates not completed here

1. Actual Linux → Windows SSH/CDP and optional owned-session MCP rehearsal with reviewed adapter/tool schemas and an authenticated model account.
2. Windows native execution, sandbox acceptance, ZIP creation/extraction and clean-profile smoke test. macOS output is also unqualified.
3. Real TouchDesigner/Godot scene, camera, projector and physical shadow pipeline. Adapter recipes and a tested local simulator are delivered; no physical rig was available.
4. Sustained 4K frame pacing on the target Windows GPU/display, with the performance protocol in the handoff dossier.
5. Build-team source intake, version control, GitHub transfer, Pages branch selection/publication, signing and release approval. **No version-control changes or publication were performed.**

The implementation and local qualification do not imply that these environment-specific gates are passed. The Build team owns the release decision using this record and the [handoff dossier](DEVOPS_HANDOFF.md).
