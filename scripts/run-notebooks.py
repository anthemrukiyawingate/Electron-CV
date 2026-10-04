"""[CAPSTONE INTEGRATION TARGET] Execute all labs in isolated kernels and retain honest evidence.

Offline mode is forced by default. Sources remain output-free; --output-dir writes
executed copies for review. --live requires one phase and its reviewed MCP config.
"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
NOTEBOOKS = {
    "architecture": ROOT / "01_Phase1_Main_and_Renderer_Architecture/architecture.ipynb",
    "security": ROOT / "02_Phase2_Context_Bridge_and_Security/security.ipynb",
    "ipc": ROOT / "03_Phase3_IPC_and_System_Integration/ipc.ipynb",
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--phase", choices=NOTEBOOKS)
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--live", action="store_true")
    parser.add_argument("--mcp-config", type=Path)
    args = parser.parse_args()
    if args.live and (not args.phase or not args.mcp_config):
        parser.error("--live requires --phase and --mcp-config for that phase's reviewed tool mappings")
    try:
        import nbformat
        from nbclient import NotebookClient
    except ImportError:
        print(json.dumps({"event": "notebook.unavailable", "message": "Install requirements.txt into .venv and run with .venv/bin/python"}), file=sys.stderr)
        return 1
    environment = os.environ.copy()
    failed = False
    with tempfile.TemporaryDirectory(prefix="voltforge-notebooks-") as temporary:
        temp = Path(temporary)
        kernel = temp / "kernels" / "voltforge-runtime"
        kernel.mkdir(parents=True)
        (kernel / "kernel.json").write_text(json.dumps({
            "argv": [sys.executable, "-m", "ipykernel_launcher", "-f", "{connection_file}"],
            "display_name": "VoltForge isolated runner", "language": "python"}), encoding="utf-8")
        os.environ["JUPYTER_PATH"] = str(temp) + os.pathsep + environment.get("JUPYTER_PATH", "")
        os.environ["JUPYTER_RUNTIME_DIR"] = str(temp / "runtime")
        os.environ["IPYTHONDIR"] = str(temp / "ipython")
        if args.live:
            os.environ["VOLTFORGE_LIVE_MCP"] = "1"
            os.environ["VOLTFORGE_MCP_CONFIG"] = str(args.mcp_config.resolve())
        else:
            os.environ.pop("VOLTFORGE_LIVE_MCP", None)
            os.environ.pop("VOLTFORGE_MCP_CONFIG", None)
        try:
            for phase, path in NOTEBOOKS.items():
                if args.phase and phase != args.phase:
                    continue
                start = time.monotonic()
                try:
                    notebook = nbformat.read(path, as_version=4)
                    nbformat.validate(notebook)
                    if notebook.cells[0].cell_type != "markdown" or "[CAPSTONE INTEGRATION TARGET]" not in notebook.cells[0].source:
                        raise ValueError("notebook must start with its Capstone integration callout")
                    client = NotebookClient(notebook, timeout=270 if args.live else 30,
                                            startup_timeout=30, shutdown_kernel="immediate",
                                            kernel_name="voltforge-runtime", allow_errors=False,
                                            resources={"metadata": {"path": str(path.parent)}})
                    executed = client.execute()
                    if args.output_dir:
                        args.output_dir.mkdir(parents=True, exist_ok=True)
                        nbformat.write(executed, args.output_dir / path.name)
                    print(json.dumps({"event": "notebook.passed", "phase": phase,
                                      "mode": "live" if args.live else "offline-fixture",
                                      "code_cells": sum(cell.cell_type == "code" for cell in notebook.cells),
                                      "duration_seconds": round(time.monotonic() - start, 3)}))
                except Exception as error:
                    failed = True
                    print(json.dumps({"event": "notebook.failed", "phase": phase,
                                      "error_type": type(error).__name__, "message": str(error)}), file=sys.stderr)
        finally:
            os.environ.clear()
            os.environ.update(environment)
    return int(failed)


if __name__ == "__main__":
    raise SystemExit(main())
