# VoltForge DevOps handoff dossier

> **[CAPSTONE INTEGRATION TARGET]** Operate the same trust boundaries taught in the labs: keep privileged automation on a protected management path, accept bounded telemetry in Main, and deliver only validated snapshots to Renderer.

## Authority and delivery scope

Development supplies source, static demo pages, typed application, notebook curriculum, reproducible test commands, and local validation evidence. **The Build environment team exclusively owns version control, branch creation, source transfer to GitHub, merges, repository settings, signing, and publication.** This delivery does not run those operations. Separate local implementation readiness from target-host acceptance and public-release readiness.

| Role | Responsibility | Acceptance evidence |
| --- | --- | --- |
| Curriculum architect | phase objectives, attribution, interface consistency | backlog and notebook review |
| Application maintainer | code, tests, bounds, failure UI | compilation and test records |
| Linux operator | Jupyter, Claude, SSH client, MCP client | offline notebook run and live tool inventory |
| Windows operator | desktop session, Electron, receiver, local MCP launcher | native window and loopback listener checks |
| Physical pipeline owner | TouchDesigner/Godot mapping and hardware truth | movement, disconnection, recovery recording |
| Build environment team | source intake, VCS, packaging, signing, Pages | clean build, Windows release checklist, public URL |
| QA reviewer | falsification, accessibility, performance | environment-specific results and residual risk |

## Release inputs and inventory

The source of truth for JavaScript dependency versions is `package-lock.json`. Never replace it with fresh unreviewed `latest` installs during qualification. `npm ci` deliberately fails when the package and lockfile disagree. Python direct dependencies are pinned in `requirements.txt`; capture the resolved transitive inventory with `python -m pip freeze` in the release environment. Third-party MCP adapters are optional lab tools; pin them separately after reviewing the current tool schema.

Required runtime: Node 22.13+ or Node 24 LTS, npm, Python 3.11+, desktop display for native tests. The actual development versions and command results are recorded in `VALIDATION.md`. Development on Linux does not validate a Windows executable. Electron's embedded Node version differs from the system Node used to run build tools.

Before transfer, retain README, license, backlog, handoff, agent protocol, validation, `docs/`, all three phase directories, `Projects/`, `src/`, `scripts/`, `tests/`, package/lockfiles, requirements and compiler/Forge/test configuration. Exclude `node_modules`, `.venv`, `dist`, `out`, caches, credentials, local `.mcp.json`, private logs, `.ipynb_checkpoints`, and notebook outputs containing live data. The Build team may retain generated release/test artifacts in its evidence store separately.

Suggested intake record:

```text
Release identifier: assigned by Build team
Source SHA-256 manifest: generated during intake
Node/npm/Python versions: exact command output
OS / architecture: Linux development, Windows target
Electron / Forge versions: package-lock.json
MCP adapter + version + tool inventory hash: live operator supplies
Hardware / display / GPU / browser: performance operator supplies
Windows ZIP filename + SHA-256 + signing status: Build team supplies
Pages selected branch + /docs + public URL: Build team supplies
Outstanding release gates: VALIDATION.md
```

## Network, process, and privilege map

| Endpoint | Bind / transport | Owner | Allowed caller | Lifecycle |
| --- | --- | --- | --- | --- |
| Jupyter | Linux loopback, normally TCP 8888 | Linux user | local browser or explicit tunnel | stop after lab |
| SSH | Windows private interface, TCP 22 | Windows administrator | approved Linux node/account | key-authenticated management |
| Renderer CDP | Windows loopback TCP 9222; tunneled to Linux loopback | development Electron | trusted local MCP/Playwright | development only |
| Main inspector | Windows loopback TCP 9229 if explicitly enabled | privileged owned test session | trusted debugger | optional, never public |
| MCP | parent/child stdin + stdout | agent host | owning client process | one bounded session |
| Telemetry WebSocket | Windows `127.0.0.1:8765` by default | Electron Main | trusted local native producer | app lifetime |
| OSC | Windows `127.0.0.1:9000`, UDP | Electron Main | trusted local physical pipeline | app lifetime |
| Public demo | static HTTPS after Build team publication | GitHub Pages | anonymous browsers | no telemetry backend |
| Local demo preview | development loopback TCP 4173 | developer | local browser | stop when finished |

`VOLTFORGE_WS_PORT` and `VOLTFORGE_OSC_PORT` override telemetry ports; valid values are 1024–65535. Do not set both transports to a privileged or unrelated service's port. TCP and UDP are distinct even when their numeric ports match. The static demo does not connect to a real receiver.

The WS receiver is intentionally loopback-only and rejects browser-origin clients. Local native processes remain trusted publishers; there is no claim that loopback provides per-user authentication. A remotely hosted producer requires a separately designed authenticated gateway or an authorized secure tunnel. Do not change a binding to `0.0.0.0` to fix connectivity. OSC/UDP has no delivery, ordering, or authentication guarantee; TCP SSH forwarding does not carry UDP.

### Supported automation paths

1. **Attach to existing desktop:** Windows user starts the dev app with loopback CDP; Linux user establishes the SSH forward; local laststance MCP connects to the forwarded browser endpoint. This path controls renderer pages and does not own the Windows app lifecycle.
2. **Owned Main+Renderer session:** Windows-local electron-driver or Playwright launches the compiled Electron entry. It can inspect Main and create windows as privileged testing machinery. Running it over SSH stdio is valid only when the Windows session can create desktop windows; otherwise run the agent host in the interactive Windows desktop.
3. **Offline learning:** Jupyter uses clearly labeled fixtures and the public pages use simulated data. No account, remote service, or host is required.

The upstream adapters are stdio servers. JSON-RPC is the envelope, not a reason to send arbitrary JSON to an invented HTTP endpoint. Tool names and schemas differ by adapter and release: discover, inspect, select, call, record. Main evaluation belongs only to the privileged driver, never to `window.plato`.

## Reproducible operational sequence

### Prepare source and dependencies

From the source root on each machine:

```bash
node --version
npm --version
npm ci
npm run check
npm test
npm run build
```

For offline curriculum on Linux:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m unittest discover -s tests -p 'test_*.py' -v
.venv/bin/python scripts/run-notebooks.py
```

For static preview use `python3 -m http.server 4173 --bind 127.0.0.1 --directory docs`. Open `http://127.0.0.1:4173/`; direct opening of any phase HTML file also works. Public Pages requires only the files under `docs`.

### Native startup and shutdown

Run `npm start` in the workstation's graphical desktop. In a separate terminal run `npm run telemetry:simulate`; check the dashboard's packet/source age and movement. Stop the producer, allow the documented stale deadline to elapse, and confirm the UI marks retained data stale. Restart the producer and confirm recovery. Closing the app must release both telemetry listeners and all UI subscriptions.

Run `npm run test:electron` for the executable's Playwright tests on a graphical host that supports Chromium's sandbox. Do not disable the sandbox or set `nodeIntegration: true` to make a failing test pass. A Linux kernel policy, absent display, missing shared library, or namespace denial is an environmental failed gate requiring an appropriate host.

### CDP discovery and tunnel

Follow the exact Windows and SSH commands in the README. Validate HTTP discovery within five seconds. Validate the returned WebSocket authority is the expected loopback port. Stopping the tunnel must produce a bounded timeout and a recoverable UI/client state. Do not log authentication keys or accept an unexpected SSH fingerprint simply to restore access.

### Package and distribute

Run `npm run package`, then `npm run make` on the target platform. The configured maker creates an unsigned portable ZIP. Keep any later installer maker and code signing in the Build environment. A successful Linux archive is evidence about Linux only. On Windows, test ZIP extraction, standard-user startup, bridge availability, valid telemetry, producer loss, second-instance behavior, close/reopen, and removal in a clean profile. If the Build team adds an installer, separately qualify install/uninstall. Check that default release launch opens no CDP/Main inspector ports.

The reference has no automatic update server or signing secrets. For initial distribution use the Build team's existing signing and distribution channel. Future auto-updates require a separate threat model and rollback exercise; they are not silently enabled by Forge.

## Interface and data handling

`window.plato.getSnapshot()` returns a bounded request/reply result; `window.plato.onSnapshot(callback)` subscribes to validated state and returns cleanup. Read the exact types and limits in `src/shared/` and the [Capstone interface guide](../Projects/CAPSTONE_Plato_Dashboard_Electron/README.md). Renderer receives copied structured data, not a privileged Electron object. Main authorizes the sender using the expected webContents, top-level frame, and exact application document URL.

The reference caps telemetry frames at 16 KiB, shadow object lists at 64, WebSocket clients at four, and applies per-client/global rate limits. These are curriculum defaults, not a sizing guarantee for arbitrary installations. Oversized or invalid data cannot update last-valid telemetry. OSC is a deliberately small documented subset; arbitrary bundles and unknown type tags are rejected rather than guessed.

All telemetry is observational; the reference sends no actuator/hardware-control commands. Producer metadata represents what the producer reports. Socket connectivity alone does not establish camera, projector, sensor, or hardware health. Raw video, identifying imagery, and full physical feeds are not retained by this curriculum.

## Logging and evidence

Authored helpers and runtime components write structured JSON event records. Useful fields include timestamp, event, request ID, result/error code, duration and bounded counts. Full exception internals, credentials, payload contents, user filesystem paths and screenshot data do not belong in normal logs. MCP stdout is reserved for protocol traffic; diagnostics go to stderr.

Separate four outcomes in evidence: **passed**, **failed**, **blocked by environment**, and **not run**. Red evidence from a missing implementation is honest scaffolding evidence; behavioral regressions require assertions of the expected state, not just source-code string matching. Store actual output and the command/environment that produced it.

## Falsification and recovery playbook

| Trigger | Expected outcome | Diagnosis / recovery |
| --- | --- | --- |
| Node missing or below supported range | install/build fails before launch | install approved LTS; reopen shell; rerun version checks |
| npm registry / Electron download unavailable | explicit install failure | check approved proxy/CA and egress; preserve lockfile; rerun `npm ci` for packages, then invoke Electron to complete its lazy binary download |
| Renderer blank | local UI reports error or startup log | check compiled files, preload bundling, CSP, renderer console; rerun build |
| Bridge unavailable | unavailable/retry state, no privileged fallback | inspect preload load errors and versions; restart after fix |
| Wrong sender / subframe / arbitrary channel | rejected/ignored | verify application URL/frame checks; do not broaden authority |
| Malformed JSON / unknown fields | rejected record, no data mutation | correct producer schema; rerun packet tests |
| Oversized / flooded input | bounded rejection/disconnect | stop producer, fix packet size/rate, reconnect |
| No producer / stopped producer | disconnected/empty or stale data | inspect source process and packet age; restart producer |
| WS/OSC port already owned | explicit transport error, app remains usable | identify owner; stop only intended app or choose allowed override |
| CDP works locally but not through tunnel | finite discovery/attach failure | check SSH bind/forward and endpoint port; never expose CDP publicly |
| Main eval missing on CDP adapter | capability mismatch | select owned-session driver, inspect its current tool schema |
| SSH-launched app has no visible window | session/desktop mismatch | use Windows interactive agent/launcher |
| IPC handler never settles | finite timeout and retry | inspect Main event loop and logs; client timeout does not cancel remote work |
| Notebook hangs | per-call/cell deadline failure | verify chosen kernel, live opt-in, tool schemas, process cleanup |
| Demo sluggish at 4K | DRS lowers canvas backing resolution | record frame times/GPU/DPR; reduce load; do not claim fixed 60 FPS |
| Pages 404 or wrong phase | selected source/path error | Build team checks configured branch + `/docs` and relative URLs |
| UDP producer sends but no data arrives | no fresh sample | verify loopback host, UDP port, supported OSC tags; TCP tunnel is insufficient |

## Performance and accessibility qualification

Use 3840×2160 on the intended Windows display, record browser version, GPU, OS, device-pixel ratio and refresh rate. Run a 60-second sample per phase with repeated controls, including bursts in the IPC graph. Report median and p95 frame interval, sample size, backing resolution range, long frames and peak queue/history counts. Target sustained 60 FPS where hardware supports it; RAF scheduling, background throttling, monitor refresh and software rendering prevent an unconditional guarantee.

Verify 390 px width with no clipped controls or horizontal overflow, keyboard navigation and visible focus, labeled inputs, text alternatives to canvas data, high-contrast status text, reduced-motion setting, pause/resume, background-tab return and browser zoom. Canvas DRS must not blur the DOM text or change simulation outcomes.

## Release gates and rollback

- [ ] Build team records source intake identity and dependency inventory.
- [ ] Clean install, TypeScript checks, behavior tests and offline notebooks pass in release environment.
- [ ] Native sandbox test and telemetry end-to-end test pass on Windows.
- [ ] Both debug endpoints are closed on default release launch; permitted loopback telemetry bindings verified.
- [ ] Real physical pipeline passes movement, disconnection, invalid-data and recovery exercises.
- [ ] Windows portable ZIP extracts/starts/removes in a clean profile; checksums and unsigned/signing status recorded. Install/uninstall applies only if a later installer is added.
- [ ] 4K performance and responsive/accessibility review completed on target hardware.
- [ ] Attributions, MIT file, third-party package notices and absence of secrets reviewed.
- [ ] Build team imports source, manages phase branches, selects Pages `/docs`, verifies URL/subpath and records publication.
- [ ] Independent operator rehearses rollback and signs off remaining limitations.

Keep the previous validated ZIP (or later installer) and source identity in the Build team's release store. For a regression, stop producers and app, retain redacted evidence, restore the prior validated artifact, then repeat startup/telemetry smoke tests. No persistent telemetry database migration is needed by the reference. Restore the previous Pages source using the team's controlled versioning process and verify the public phase links. Do not delete user data or terminate unrelated processes during recovery.

## Primary references

- [Electron security](https://www.electronjs.org/docs/latest/tutorial/security) and [Main debugging](https://www.electronjs.org/docs/latest/tutorial/debugging-main-process).
- [Electron Forge configuration](https://www.electronforge.io/config/typescript-configuration).
- [Playwright ElectronApplication](https://playwright.dev/docs/api/class-electronapplication).
- [laststance Electron MCP](https://github.com/laststance/electron-mcp-server) and [electron-driver](https://github.com/mesomya/electron-driver): verify schemas at the pinned release.
- [Claude Code installation](https://code.claude.com/docs/en/setup).
- [GitHub Pages branch publishing](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
