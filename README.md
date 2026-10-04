# VoltForge: An AI-Driven Electron Curriculum

> **[CAPSTONE INTEGRATION TARGET]** Learn to build Plato: a native, sandboxed desktop dashboard that turns a TouchDesigner/Godot physical-shadow pipeline into validated telemetry, explicit hardware status, and responsive visual feedback.

VoltForge is a five-sprint learning system for a Linux command-and-control node and a Windows Electron execution workstation. It combines executable Jupyter laboratories, typed Electron interfaces, failure-oriented tests, and a zero-build public simulation lab. The browser lab teaches the architecture using simulated processes; the Electron application implements the actual security boundary.

## Acknowledgements and licensing

Curriculum design acknowledgement: **etherwAre**. The original Capstone project concept is by **Tee Ken Ng, [@TeeKenNG on TikTok](https://www.tiktok.com/@teekenng)**, adapted here as a cyber-physical desktop dashboard. This acknowledgement does not imply endorsement or license any original video, artwork, or other third-party assets. The source and curriculum in this repository are provided under the [MIT License](LICENSE); third-party packages retain their own licenses.

## Start here

1. Open `docs/index.html` directly in a modern browser for the standalone simulation lab. Each phase also has its own self-contained `index.html`.
2. Install a currently supported Node.js LTS release: **Node 22.13+ is required** by the selected Forge 8 tools; Node 24 LTS is recommended. This implementation raises the original Node 20+ baseline to satisfy its actual toolchain. Use the same major version on both machines.
3. In this directory run `npm ci` after receiving the complete source bundle and lockfile, then `npm run check`, `npm test`, and `npm run build`.
4. On a workstation with a graphical desktop, run `npm start` to launch Plato. Run `npm run telemetry:simulate` in a separate terminal to feed local WebSocket telemetry. See the Capstone guide for the exact packet schema and OSC mapping.
5. On Linux install the notebook requirements in a virtual environment and run the notebooks in phase order. Start in offline mode, then opt into the Windows MCP session as described below.

Actual validation results and platform limitations are recorded in [VALIDATION.md](handoff/VALIDATION.md). A successful unit test does not establish Windows packaging, physical hardware integration, or a universal 60 FPS guarantee.

## Repository map

```text
Electron-CV/
├── README.md
├── LICENSE
├── handoff/                          # operational documents inside the repository
│   ├── BACKLOG.md
│   ├── DEVOPS_HANDOFF.md
│   ├── VALIDATION.md
│   ├── AGENT_PROTOCOL.md
│   └── TRACKED_PATHS_TO_REMOVE.txt
├── docs/                             # GitHub Pages target; no build required
│   ├── index.html                    # interactive mission control / architecture lab
│   ├── phase-1/index.html             # OS / main / renderer boundary
│   ├── phase-2/index.html             # context bridge payload challenge
│   ├── phase-3/index.html             # asynchronous IPC queue and failure lab
│   └── capstone/index.html            # Plato physical-shadow telemetry simulation
├── 01_Phase1_Main_and_Renderer_Architecture/
│   ├── README.md
│   └── architecture.ipynb
├── 02_Phase2_Context_Bridge_and_Security/
│   ├── README.md
│   └── security.ipynb
├── 03_Phase3_IPC_and_System_Integration/
│   ├── README.md
│   └── ipc.ipynb
├── Projects/
│   ├── mini_projects/                # scoped lab briefs and acceptance exercises
│   └── CAPSTONE_Plato_Dashboard_Electron/
│       └── README.md                 # schema, physical pipeline, and integration
├── src/                              # shared Electron reference implementation
│   ├── main.ts
│   ├── preload.ts
│   ├── renderer.ts
│   └── shared/                       # typed, validated IPC contract
├── scripts/                          # build, telemetry, notebook/MCP utilities
├── tests/                            # falsification and browser acceptance tests
├── requirements.txt
├── package.json
├── package-lock.json
├── forge.config.ts
└── tsconfig*.json                    # strict main/preload/renderer compilation
```

Generated `dist/`, `out/`, `.venv/`, `node_modules/`, screenshots, and local credentials are development outputs, not the public demo. The root application is the shared executable Capstone reference; phase folders progressively teach its components.

## EajR Signature

- Write application logic in strict TypeScript. The public lab uses checked, vanilla JavaScript embedded in individual HTML documents so it remains zero-build. Notebook orchestration uses Python.
- Every authored notebook starts with a Markdown **[CAPSTONE INTEGRATION TARGET]** callout. Every script carries the same callout in its opening comment/docstring.
- All privileged application operations live in Main. Each BrowserWindow uses `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`. Expose a small, named `contextBridge` API; never expose raw `ipcRenderer`, arbitrary channel names, filesystem paths, shell commands, or evaluation functions to Renderer.
- Validate exact payload schemas and the invoking frame in Main. A bridge is an authority boundary, not a magic sanitizer. Reject unknown fields and operations; display untrusted strings with `textContent`.
- Apply finite deadlines to IPC and MCP operations; return typed failure envelopes and structured JSON logs. A client timeout releases the UI, but does not automatically cancel an operation already executing in another process.
- Show loading, empty, disconnected, stale, rejected, and retry states. Bound queues and histories. Clear timers/listeners when they are no longer needed.

These controls implement the project's policy using the [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security).

## Cross-platform setup

### Windows execution workstation

Use a normal, non-administrator desktop account for daily development. Install Node.js LTS from the [official distribution](https://nodejs.org/en/download), or use PowerShell with Windows Package Manager:

```powershell
winget install OpenJS.NodeJS.LTS
# Reopen PowerShell after installation.
node --version
npm --version
Set-Location C:\Work\Curriculum-Electron
npm ci
npm run check
npm test
npm start
```

Electron is a local development dependency; a separate global Electron installation is unnecessary. Keep the lockfile supplied by the Build environment team. The initial binary download requires access to Electron's release distribution and the npm registry. If a corporate proxy intercepts TLS, configure a trusted CA according to local policy; do not disable certificate verification.

For renderer automation, start the development application with a loopback CDP listener:

```powershell
npm run build
npx electron . --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222
```

Leave that terminal running. In a **second PowerShell terminal**, inspect the listener:

```powershell
Invoke-RestMethod http://127.0.0.1:9222/json/version -TimeoutSec 5
Get-NetTCPConnection -LocalPort 9222 | Format-Table LocalAddress,LocalPort,State
```

Verify the actual bound address; flags alone are not a network security policy. Do not open inbound firewall ports 9222 or 9229. Start ordinary releases without debugging flags. CDP is privileged and unauthenticated: only tunnel it between trusted accounts.

Renderer CDP cannot evaluate Electron Main-process JavaScript. For the controlled Main laboratory use the local Playwright Electron launcher / `electron-driver` MCP process on Windows. Main inspection uses a different V8 inspector endpoint (`--inspect=127.0.0.1:9229`); it is not required for the CDP renderer path. See [Electron Main debugging](https://www.electronjs.org/docs/latest/tutorial/debugging-main-process) and [Playwright ElectronApplication](https://playwright.dev/docs/api/class-electronapplication). The public Renderer never gains a general evaluation API.

### Linux command-and-control node

Install the same Node LTS major and Python 3.11+ with virtual-environment support. On Debian/Ubuntu the OS prerequisites can be installed by the workstation administrator:

```bash
sudo apt-get update
sudo apt-get install python3 python3-venv openssh-client
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m ipykernel install --user --name voltforge --display-name 'Python (VoltForge)'
.venv/bin/jupyter lab --ip=127.0.0.1
```

Choose the VoltForge kernel. Jupyter's token stays local; do not bind it to the LAN. The first notebook cell locates the workspace regardless of the notebook's current directory. Notebook execution defaults to offline fixtures. Live cells are explicitly enabled and have bounded waits.

Install Claude Code using its [official installation instructions](https://code.claude.com/docs/en/setup). For a reviewable Linux installer flow:

```bash
curl -fsSL https://claude.ai/install.sh -o /tmp/voltforge-claude-install.sh
# Review the downloaded installer and use your organization's approved release.
bash /tmp/voltforge-claude-install.sh
claude --version
claude doctor
```

Authenticate interactively using your own account. This repository contains no API keys or preauthenticated agent configuration. MCP and model access remain separate from the offline curriculum.

### Secure Linux → Windows routing

Have the Windows administrator enable OpenSSH Server, restrict inbound TCP 22 to the Linux node/private management network, and install the Linux user's public SSH key for a dedicated Windows development account. Verify the SSH host fingerprint out of band before accepting it. Keep TouchDesigner, Godot, Electron, and any launcher MCP process in the same interactive Windows user session; a service/SSH session may be unable to display a GUI.

For attaching to an Electron UI already running on the Windows desktop, create a local tunnel on Linux:

```bash
ssh -N -T -o ExitOnForwardFailure=yes -o ServerAliveInterval=15 \
  -o ServerAliveCountMax=3 -L 127.0.0.1:9222:127.0.0.1:9222 \
  WINDOWS_USER@WINDOWS_PRIVATE_IP
```

In another Linux terminal:

```bash
curl --fail --max-time 5 http://127.0.0.1:9222/json/version
```

The resulting browser WebSocket endpoint must remain reachable through the tunnel. Keeping local and remote ports both at 9222 avoids rewriting the loopback authority returned by discovery. If port 9222 is already occupied, stop the conflicting local service or explicitly rewrite only the endpoint host/port in a trusted client configuration. Never forward a discovered arbitrary hostname automatically.

```text
Linux Jupyter / Claude
  ├─ stdio MCP client → local laststance MCP → 127.0.0.1:9222
  │                                           │ SSH TCP tunnel
  │                                           ▼
  │                             Windows 127.0.0.1:9222 → renderer CDP
  └─ optional SSH stdio → Windows electron-driver → owned Electron session
                                                 → Main + Renderer
Physical pipeline → Windows loopback OSC/WS → validated Main → contextBridge → UI
```

MCP is a protocol, not a synonym for an HTTP server. The two recommended upstream servers use **stdio** for MCP. Do not invent an HTTP `/mcp` endpoint for them. CDP discovery is HTTP and subsequent browser control is WebSocket. For a future Streamable HTTP MCP service, separately configure authentication, TLS, allowed origins, and request deadlines.

### Choose and pin an MCP adapter

**Existing Windows app / renderer CDP:** install a reviewed release of [laststance/electron-mcp-server](https://github.com/laststance/electron-mcp-server) in a dedicated tools directory on Linux. It discovers CDP ports 9222–9225. Resolve a version once, record it in the handoff, and use that exact version instead of `latest` for classroom reproducibility:

```bash
npm view @laststance/electron-mcp-server version
# Replace REVIEWED_VERSION with the reviewed numeric release.
claude mcp add --scope user electron-cdp -- \
  npx --yes @laststance/electron-mcp-server@REVIEWED_VERSION
claude mcp list
```

**Owned Electron session / Main evaluation:** install a reviewed version of [mesomya/electron-driver](https://github.com/mesomya/electron-driver) on Windows. It launches the compiled entry through Playwright's Electron API. Its `start_app`/`stop_app` lifecycle is different from attaching to an existing app. Register on Windows with `cmd /c npx ...`, or use SSH as a stdio transport only after confirming the target account can create GUI windows. Use an absolute Windows application path; Linux paths cannot launch Windows binaries. Do not run both launchers against a single owned session.

At connection time call `list_tools()`, inspect `inputSchema`, and record the discovered tool names. Do not copy guessed tool names between adapters or major versions. The notebook helper executes these calls with deadlines, structured error records, and offline fixtures. Tool evaluation is a privileged lab operation; Renderer application APIs remain constrained.

### Physical pipeline and packaging

The Capstone guide defines versioned JSON telemetry and the supported OSC subset. Run the included simulator before attaching hardware. Keep listeners on loopback. For remote producers use an authenticated gateway or a private tunnel; do not expose an unauthenticated telemetry listener to the LAN. OSC/UDP is not carried by the TCP SSH tunnel shown above; bridge OSC to local WebSocket on the Windows host, or supply an explicitly configured UDP-capable secure network.

Use `npm run package` for a platform application bundle and `npm run make` for an **unsigned portable ZIP**. Build Windows artifacts **on Windows**; validate extraction, startup, and removal on a clean Windows machine. An installer and its install/uninstall qualification require the Build team to add an installer maker. See [Forge configuration](https://www.electronforge.io/config/typescript-configuration). Code signing credentials belong to the Build team and are supplied out of band. No auto-update feed or production signing identity is embedded here.

## Sprint sequence and agent execution

| Sprint | Outcome | Learner evidence |
| --- | --- | --- |
| 0 | Reproducible infrastructure and typed Forge application | version manifest, clean install, red/green test evidence |
| 1 | Main/Renderer architecture and MCP automation | spawn/inspect window; renderer DOM change; boundary explanation |
| 2 | Narrow preload API and validated authority | rejected payload matrix; trusted-frame tests; bridge challenge |
| 3 | Asynchronous request/reply and recovery | correlation IDs, bounded timeouts, stale data and recovery |
| 4 | Plato dashboard and operational release handoff | simulator → Main → Renderer evidence, hardware checklist, package smoke test |

The complete, dependency-ordered task cards are in [BACKLOG.md](handoff/BACKLOG.md). Each specifies inputs, exact outputs, validation, failure cases, and a completion gate. The [agent execution protocol](handoff/AGENT_PROTOCOL.md) supplies the instruction templates and reproducible QA steps for all 21 task cards. Prepare a card with `.venv/bin/python scripts/agent_harness.py prepare VF-200` and validate it with `.venv/bin/python scripts/agent_harness.py validate VF-200`. Tests must be written and observed failing before the corresponding implementation; record limitations rather than inventing test evidence.

> **Developer deployment instruction:** As a Senior AI Developer and QA Auditor, execute [TASK ID]. 1) Define validation steps using Playwright logic. 2) Implement logic adhering to the EajR Signature and strict Context Isolation. 3) Document interfaces. 4) Package for dynamic deployment via Electron Forge. 5) Provide a QA Falsification audit proving safe failure modes across the Main/Renderer IPC boundary.

> **Frontend deployment instruction:** Role: Senior Graphics Programmer. Task Target: Implement the standalone HTML demo for Phase [X]. Create a single HTML5 document with a requestAnimationFrame loop, Dynamic Resolution Scaling, and lerped UI interactions. Write a modular JavaScript closure that accurately simulates the architectural concept taught in the phase notebook. Target 60 FPS and measure performance on the actual hardware.

## Public interactive laboratory

The four standalone phase pages use a deep `#0D1117` palette, cyan/purple signal paths, responsive controls, eased animation, and bounded simulation state. They require no npm install, external fonts, CDN, or service credentials. Their displayed telemetry is simulated. The phase 2 game rejects data using an explicit schema; it never evaluates attacker text. The phase 3 lab visualizes requests, pending promises, rejection, and deadlines.

“4K / 60 FPS” is a rendering target: `requestAnimationFrame` follows browser and monitor scheduling, so a browser cannot promise a locked frame rate. Dynamic canvas resolution reduces pixel work under load; text stays at native CSS resolution. Measure frame pacing at 3840×2160 on the target workstation, with reduced-motion and background-tab behavior included in acceptance. The validation dossier distinguishes test-run samples from a hardware guarantee.

## Branching and GitHub Pages: Build environment team ownership

**All version-control actions, source transfer, remote configuration, and publication belong exclusively to the Build environment team.** Development delivers files and validation evidence. The following is the team's runbook; learners request the corresponding branch from that team rather than running Git commands in this development workspace.

1. Build team imports the reviewed source and lockfiles into the target repository and records the release identifier.
2. Team creates `sprint-0-infrastructure`, then the learning branches `phase-1-architecture`, `phase-2-security`, `phase-3-ipc`, and `phase-4-capstone` from the agreed baseline. Learners receive their assigned branch through the team's standard process.
3. Learners complete the relevant notebook, demo challenge, and tests, then return their evidence and source changes to the Build team for review and integration.
4. To publish, a repository administrator selects **Settings → Pages → Build and deployment → Source: Deploy from a branch**, selects the intended learning/release branch and **`/docs`**, then saves.
5. Pages deploys from the branch explicitly selected in Settings. Switching a local active branch does **not** switch the publishing source. When a phase branch becomes the intended public version, the Build team must update that setting.
6. Verify the Pages deployment result and all four relative phase links at the actual repository subpath. The `.nojekyll` marker preserves the static artifact. Record the public URL in the handoff.
7. Roll back by selecting the previously validated source branch/revision using the team's release process; retest navigation and interaction after deployment.

The authoritative UI procedure is [GitHub's branch publishing guide](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site). No remote repository or Pages deployment is configured by this development delivery.

## Completion and support

Use [DEVOPS_HANDOFF.md](handoff/DEVOPS_HANDOFF.md) for ports, ownership, troubleshooting, secrets, rollback, and the release checklist. Use [VALIDATION.md](handoff/VALIDATION.md) to distinguish locally demonstrated behavior from checks requiring the Windows workstation, actual physical hardware, or the Build team's release environment.

## Intake return 2 — source-only layout

The current correction record is [handoff/INTAKE_RETURN_2.md](handoff/INTAKE_RETURN_2.md). The Build team applies the relative paths in [the removal manifest](handoff/TRACKED_PATHS_TO_REMOVE.txt) to its tracked tree; adding `.gitignore` alone does not untrack files. No history rewrite is requested. Run `python -B scripts/release_hygiene.py` and `python -B -m unittest discover -s tests -p "test_*.py" -v` from this repository. With `.git` present, the release gate checks the actual index, including tracked files deleted from disk. Without Git metadata, it explicitly checks the delivered source tree. Keep virtual environments, `node_modules/`, `dist/`, `out/`, and test captures outside the returned source archive. Historical Linux binary evidence in the validation document is not part of this source-only handoff.
