# Electron-CV intake return 2

Date: 2026-10-04. Scope: CV-1, CV-3 and CV-9. This is a source-only correction against the delivered repository. Build owns the commit and all publication actions; no history rewrite or Git index mutation is part of this return.

- **CV-1:** Added `.gitignore`, a release hygiene checker and eight regression tests. `TRACKED_PATHS_TO_REMOVE.txt` names the six tracked bytecode files from the incoming index. These files are absent from this corrected source tree. The gate inspects the actual index when Git metadata is present, so deleting a tracked artifact from disk or adding an ignore rule cannot disguise it.
- **CV-3:** Moved the backlog, DevOps dossier, validation record and agent protocol into `handoff/`. Updated README/mini-project links, task-manifest paths, backlog tests and delivery checks. Local document links must resolve inside this repository. The two Playwright configuration files previously left outside the repository are now at its root, matching the existing npm scripts and TypeScript configuration.
- **CV-9:** The corrected handoff contains no `out/`, `dist/`, `node_modules/`, virtual environment, bytecode or runtime cache. Historical binary/screenshot references in the original validation record are historical evidence only; they are not included release artifacts. New native packaging, if requested later, belongs in a separate Build output location.

## Repeated checks

Use Python 3.12 with bytecode disabled; install dependencies outside the delivered tree when needed. The current correction changes release layout and validation, not the Electron runtime.

```text
python -B -m unittest discover -s tests -p 'test_*.py' -v
python -B scripts/check-delivery.py
python -B scripts/release_hygiene.py
```

Before correction, the new source-tree release check failed on broken document links, and the existing curriculum test failed because it required `BACKLOG.md` at the root. After correction: **29 Python tests passed** (the existing 21 plus 8 release-hygiene tests); both delivery checks passed against the corrected source tree. The new checks ran with CPython 3.12 and `PYTHONDONTWRITEBYTECODE=1`. Node, browser, notebook, native-engine and performance suites were not rerun for this layout-only return; the 2026-10-03 [validation record](VALIDATION.md) remains explicitly historical.

The source archive deliberately contains no `.git` directory. Its release-check mode is `source-tree`. After Build integrates the files and removes the manifest paths from tracking, the same command must pass in `git-index` mode before a new release. A source-tree pass is not evidence that Build's existing index has already been cleaned.
