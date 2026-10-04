# Phase 1: Main and Renderer architecture

> **[CAPSTONE INTEGRATION TARGET]** Identify the process that owns each native privilege before driving the Plato dashboard from Linux automation.

Complete backlog tasks VF-002, VF-004, VF-100, and VF-101. Allow 60–90 minutes offline plus a separate two-host rehearsal. The source bundle already contains the reference implementation; new learner changes follow red → green → review. All branch/source-transfer work belongs exclusively to the Build environment team.

## Start offline

From the repository root:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python scripts/notebook_support.py discover
.venv/bin/python scripts/run-notebooks.py --phase architecture --output-dir /tmp/voltforge-notebooks
.venv/bin/jupyter lab --ip=127.0.0.1
```

Open [architecture.ipynb](architecture.ipynb), select the installed environment's Python kernel, and run all cells. If using Jupyter from elsewhere, register `.venv/bin/python -m ipykernel install --user --name voltforge` first and select that kernel. The notebook finds the source root from either its own folder or the repository root. The command-line runner always uses the exact interpreter that launched it, a temporary kernel registration, and offline mode unless `--live` is explicit.

Expected evidence: three discovered `fixture_*` tools with input schemas; simulated window creation; secure Main preferences; an inert renderer text mutation; a discovery timeout with structured JSON logs. These are fixtures, not Windows launch evidence. Inspect the actual `src/main.ts` configuration, then explore [the architecture simulation](../docs/phase-1/index.html).

## Select a live route

| Route | Owns native process? | Main evaluation? | Required setup |
| --- | --- | --- | --- |
| Reviewed electron-driver on Windows | Yes, launches via Playwright Electron | Yes, through the driver's privileged Main tool | Interactive Windows desktop account; built absolute Windows app entry; reviewed stdio command or SSH wrapper |
| Reviewed laststance on Linux, attached to Windows renderer CDP | No, app already running | No | Windows loopback CDP listener; SSH forwarding 127.0.0.1:9222 → 127.0.0.1:9222; pinned adapter |

Follow the root [cross-platform instructions](../README.md). The compiled app entry is `dist/main.js`; the Windows path is an absolute Windows path. `--remote-debugging-port=9222` exposes renderer CDP and does not transform CDP into Main-process evaluation. Neither adapter is an HTTP `/mcp` server.

Create a private local configuration outside `docs/`, for example `/tmp/voltforge-mcp.json`. Start with discovery only:

```json
{
  "adapter": "laststance",
  "command": "/absolute/path/to/npx",
  "args": ["--yes", "@laststance/electron-mcp-server@REVIEWED_VERSION"],
  "timeout_seconds": 5
}
```

Replace the executable with the result of `command -v npx` and `REVIEWED_VERSION` with the exact version reviewed and recorded by your team. Install/cache that pinned adapter before the timed session; an initial npm download can exceed the tool deadline. For electron-driver, set `adapter` to `electron-driver` and select the reviewed Windows stdio launcher, or a local wrapper using SSH to launch it in an account verified to create windows. The wrapper must put only MCP protocol output on stdout; diagnostic logs belong on stderr. Do not infer GUI permissions from a successful SSH login.

```bash
.venv/bin/python scripts/notebook_support.py discover --live --config /tmp/voltforge-mcp.json
```

Read the returned tool descriptions and exact `inputSchema`. Discovery initializes the configured privileged server, but does not call an application tool. Add `capabilities` mappings only after inspecting the catalog:

```json
{
  "renderer": {
    "tool": "EXACT_NAME_FROM_LIST_TOOLS",
    "arguments": {}
  }
}
```

This is the shape of the **capabilities value**, not a full runnable config. Replace the name and fill the arguments required by its actual schema, then place the object under `capabilities` in the discovery config. Placeholder names deliberately do not pretend to be adapter APIs. The broker rejects unknown names and validates the full live schema before calling a tool.

For electron-driver supply all four roles; for laststance supply `renderer` only:

| Role | What to put in the discovered tool's argument schema |
| --- | --- |
| `spawn` | Absolute Windows `dist/main.js` path and documented launch arguments for one owned session |
| `main` | Harmless Main inspection such as app version, window count, and actual BrowserWindow webPreferences; adapt the JavaScript to the tool's documented evaluation context |
| `renderer` | Inspect `typeof require` / `typeof process`, then set an existing label via `textContent` and read it back |
| `stop` | The documented operation to stop the same owned application session |

The phase-1 notebook's live cell uses these mappings. It always attempts `stop` after an owned spawn, including a timed-out spawn, because timeout does not prove the remote launch failed. This requires a dedicated owned session: do not attach cleanup to someone else's running application.

```bash
.venv/bin/python scripts/run-notebooks.py --phase architecture --live \
  --mcp-config /tmp/voltforge-mcp.json --output-dir /tmp/voltforge-live-architecture
```

For an interactive notebook set `VOLTFORGE_LIVE_MCP=1` and `VOLTFORGE_MCP_CONFIG=/tmp/voltforge-mcp.json` before starting Jupyter. Each individual initialize/list/call has a deadline; the session has a cooperative total deadline. SDK cancellation and process cleanup can extend elapsed shutdown time. An unresponsive remote GUI process still requires the Windows owner's inspection/termination. The runner has a finite cell deadline and tears down its kernel, but this is not a guarantee of remotely killing an application.

## Acceptance and failure checks

Record: adapter/version, discovered schema catalog, both host runtimes, who owns each process, window observation, Main result, Renderer result, and cleanup. Repeat with an invalid application path, missing tool mapping, broken tunnel, and occupied debugging port. Never label fixture outputs as live. The native Main and Renderer rows remain pending until observed on Windows.

Transfer question: Why can a privileged CDP harness mutate the DOM while the page still lacks filesystem access? Continue with [Phase 2](../02_Phase2_Context_Bridge_and_Security/README.md).
