# VoltForge intake return 6 — Electron-CV only

**From:** VoltForge / Electron-CV conversation · **To:** L.A., through the Build Environment · **Date:** 2026-10-04.

This return handles only the VoltForge item in intake return 6. It adds the requested TypeScript and Electron test evidence for the accepted source. Application code, tests, dependencies and project/repository names are unchanged. No other project was extracted, corrected or included. Build retains version control, upload and historical-bytecode remediation; no Git mutation was performed.

## Source and reproduction

The tested source was extracted directly from this conversation's combined release archive, `Curriculum-Intake-Return-2.zip`, SHA-256 **`94dc2a7c25aea0839ce25a5b319aa69a5aeb95d181185f70872d0ce65997416b`**. Only its `intake-return-2/Electron-CV/` subtree was extracted. All **61** Electron source files matched the archive's source manifest before testing, and all 61 still matched after testing. The source lockfile has SHA-256 `86a551f044147c5390536b3d4f9bcd3154760e4bbb6e0e612c3c28a08c42ae2a`.

Tests ran from that fresh extraction on Linux x64. `npm ci --no-audit --no-fund` installed the pinned dependency graph into the temporary test directory, with a dedicated temporary npm cache. No dependency directory or source from the development tree was substituted. Generated dependencies, `dist/` and `test-results/` stay outside this evidence return.

Host tool versions were **Node 24.13.1**, **npm 11.8.0**, **TypeScript 5.9.3**, **Playwright 1.63.0** and **Electron Forge 8.0.1**. The installed Electron binary itself reported **Electron 44.5.1**, embedded **Node 24.21.0**, **Chromium 152.0.7977.130** and V8 **15.2.124.28-electron.0**. The standalone Node version and Electron's embedded Node version are recorded separately.

## Actual results

| Command | Result | Transcript |
| --- | --- | --- |
| `npm ci --no-audit --no-fund` | Exit 0; 139 packages installed | [Installation](evidence/intake-return-6/install.txt) |
| `npm run check` | Exit 0; Main, Renderer, tests/configs TypeScript checks and all five checked-JavaScript demos passed | [TypeScript](evidence/intake-return-6/typescript.txt) |
| `npm run test:unit` | **8 passed, 0 failed, 0 skipped**; includes real local WebSocket and UDP fixtures | [Unit suite](evidence/intake-return-6/unit.txt) |
| `npm run test:electron` | Build succeeded; **1 passed, 0 failed, 0 skipped**; actual Electron process | [Electron suite](evidence/intake-return-6/electron.txt) |

The Electron test uses `chromiumSandbox: true` and asserts that `--no-sandbox` is absent. It checks the isolated renderer/bridge, untrusted-window rejection, invalid telemetry, visible valid telemetry, hardware state, stale/disconnected/recovery transitions and the stalled-Main timeout. `ELECTRON_RUN_AS_NODE=1` was used only for the separate binary version query; it was unset for the acceptance run. The existing graphical session and local socket access were available through the approved validation execution path.

The [complete transcript](evidence/intake-return-6/TRANSCRIPT.txt) contains commands, UTC start times, output, exit codes and elapsed times. Personal directory prefixes are replaced before persistence with `<user-home>`, `<workspace>` and `<extracted-release>`; terminal colour codes are removed. Outcomes and diagnostics are preserved, including the harmless colour-variable warning emitted by the Electron runner. [VERIFICATION.json](evidence/intake-return-6/VERIFICATION.json) binds the results to the archive and all 61 source hashes. [Node/package versions](evidence/intake-return-6/node-versions.txt) and [actual Electron runtime versions](evidence/intake-return-6/electron-versions.txt) provide the raw version evidence.

To repeat, extract only Electron-CV from the identified archive, enter its root, use Node 24.13.1 and npm 11.8.0, and run:

```sh
npm ci --no-audit --no-fund
npm run check
npm run test:unit
npm run test:electron
```

The Electron suite needs a graphical session and available loopback fixture ports 18765 and 19000. Keep `ELECTRON_RUN_AS_NODE`, `VOLTFORGE_ELECTRON_EXECUTABLE`, `NODE_PATH` and `NODE_OPTIONS` unset for this source-build acceptance. The returned evidence concerns the app built from the archive; it does not claim a packaged installer, a new browser suite, Windows execution or physical hardware qualification. The previously accepted Python result is not represented as a fresh rerun here.

## HTML identifier guidance and integration

The [assignment-pattern scan](evidence/intake-return-6/html-assignment-scan.json) found no assignments to `token`, `secret`, `password` or `key` in the five delivered documentation pages or `src/index.html`. No identifier edit was necessary. This local text scan is recorded with its exact pattern and is not a claim that Build's commit or push guard was run.

This archive contains **additions only** under `Electron-CV/handoff/`. [INTAKE_RETURN_6_MANIFEST.json](INTAKE_RETURN_6_MANIFEST.json) lists each new path and SHA-256, with no modifications or removals. Apply these evidence files to the accepted Electron-CV repository; do not replace its implementation with another conversation's combined return. The companion checksum verifies this evidence archive. Its contents include no build output, dependency directory, Git metadata or compiled bytecode.
