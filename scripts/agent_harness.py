"""[CAPSTONE INTEGRATION TARGET] Prepare bounded AI tasks and record real QA evidence.

This harness emits task packets for an authenticated developer/agent to consume.
It never invokes a model, installs packages, publishes, or manages version control.
Validation runs explicit local checks without a shell and records actual exit codes.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "scripts" / "agent-tasks.json"
DEVELOPER_TEMPLATE = (
    "As a Senior AI Developer and QA Auditor, execute {task_id}. "
    "1) Define validation steps using Playwright logic. "
    "2) Implement logic adhering to the EajR Signature and strict Context Isolation. "
    "3) Document interfaces. "
    "4) Package for dynamic deployment via Electron Forge. "
    "5) Provide a QA Falsification audit proving safe failure modes across the Main/Renderer IPC boundary."
)
FRONTEND_TEMPLATE = (
    "Role: Senior Graphics Programmer. Task Target: Implement {demo} for Phase {phase}. "
    "Create a single HTML5 document with a requestAnimationFrame loop, Dynamic Resolution Scaling, "
    "and lerped UI interactions. Write a modular JavaScript closure that accurately simulates the "
    "underlying architectural concept taught in this phase's Jupyter notebook. Target 60 FPS; "
    "measure at 3840×2160 on the target hardware and report actual frame pacing."
)
CHECKS = {
    "curriculum": [sys.executable, "-m", "unittest", "discover", "-s", "tests", "-p", "test_curriculum.py", "-v"],
    "types": ["npm", "run", "check"],
    "unit": ["npm", "test"],
    "build": ["npm", "run", "build"],
    "notebooks": [sys.executable, "scripts/run-notebooks.py"],
    "demos": ["node", "--test", "tests/demo-red.test.mjs"],
}


def load_tasks():
    document = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if document.get("schema_version") != 1 or not isinstance(document.get("tasks"), list):
        raise ValueError("invalid task manifest")
    tasks = {}
    required = {"id", "sprint", "phase", "title", "objective", "prerequisites", "inputs", "outputs",
                "steps", "failure_cases", "checks", "manual_gates", "demo", "definition_of_done"}
    for task in document["tasks"]:
        if set(task) != required or task["id"] in tasks:
            raise ValueError("task missing required fields, has unsupported fields, or duplicate ID")
        if not task["checks"] or any(check not in CHECKS for check in task["checks"]):
            raise ValueError("task contains unsupported or missing validation checks")
        for key in ("prerequisites", "inputs", "outputs", "steps", "failure_cases", "manual_gates"):
            if not isinstance(task[key], list) or not all(isinstance(item, str) for item in task[key]):
                raise ValueError(f"task {task['id']} requires a list of strings for {key}")
        tasks[task["id"]] = task
    for task in tasks.values():
        if any(dependency not in tasks for dependency in task["prerequisites"]):
            raise ValueError("task has unknown dependency")
    visiting, visited = set(), set()
    def visit(task_id):
        if task_id in visiting:
            raise ValueError("cyclic task dependency")
        if task_id in visited:
            return
        visiting.add(task_id)
        for dependency in tasks[task_id]["prerequisites"]:
            visit(dependency)
        visiting.remove(task_id)
        visited.add(task_id)
    for task_id in tasks:
        visit(task_id)
    return tasks


def prepare(task):
    return {
        "task": task,
        "developer_instruction": DEVELOPER_TEMPLATE.format(task_id=task["id"]),
        "frontend_instruction": FRONTEND_TEMPLATE.format(demo=task["demo"], phase=task["phase"]),
        "execution_policy": {
            "mode": "reviewable-task-packet",
            "agent_launched": False,
            "vcs_owner": "Build environment team exclusively",
            "tdd": "Record a meaningful failing test before implementation, then green evidence and safe failure audit.",
            "manual_gates": "A passing automated check does not satisfy Windows, hardware, GUI, signing, or publication gates.",
        },
    }


def validate(task, *, timeout_seconds):
    rows = []
    for check in task["checks"]:
        command = CHECKS[check]
        start = time.monotonic()
        row = {"check": check, "command": command}
        try:
            # No shell: task manifests select known checks, never interpolate commands.
            result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True,
                                    timeout=timeout_seconds, check=False)
            row.update(status="passed" if result.returncode == 0 else "failed", exit_code=result.returncode,
                       stdout=result.stdout[-30_000:], stderr=result.stderr[-30_000:])
        except subprocess.TimeoutExpired as exc:
            row.update(status="timeout", exit_code=None,
                       stdout=(exc.stdout or b"").decode(errors="replace")[-30_000:] if isinstance(exc.stdout, bytes) else (exc.stdout or "")[-30_000:],
                       stderr=(exc.stderr or b"").decode(errors="replace")[-30_000:] if isinstance(exc.stderr, bytes) else (exc.stderr or "")[-30_000:])
        except OSError as exc:
            row.update(status="unavailable", exit_code=None, stdout="", stderr=str(exc))
        row["duration_seconds"] = round(time.monotonic() - start, 3)
        rows.append(row)
        print(json.dumps({"event": "harness.check", "task": task["id"], "check": check,
                          "status": row["status"], "duration_seconds": row["duration_seconds"]}), file=sys.stderr)
    passed = all(row["status"] == "passed" for row in rows)
    return {"task": task["id"], "automated_status": "passed" if passed else "failed", "checks": rows,
            "manual_gates": [{"gate": gate, "status": "not_run"} for gate in task["manual_gates"]],
            "release_status": "requires_manual_review", "agent_launched": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=("list", "prepare", "validate"))
    parser.add_argument("task", nargs="?")
    parser.add_argument("--output", type=Path, help="Optional task packet or validation JSON path")
    parser.add_argument("--timeout-seconds", type=int, default=180)
    args = parser.parse_args()
    try:
        tasks = load_tasks()
        if args.operation == "list":
            value = [{"id": task["id"], "title": task["title"], "prerequisites": task["prerequisites"]}
                     for task in tasks.values()]
        else:
            if args.task not in tasks:
                parser.error(f"unknown task: {args.task}; use list for valid task IDs")
            if not 1 <= args.timeout_seconds <= 900:
                parser.error("--timeout-seconds must be between 1 and 900")
            task = tasks[args.task]
            value = prepare(task) if args.operation == "prepare" else validate(task, timeout_seconds=args.timeout_seconds)
        serialized = json.dumps(value, indent=2, ensure_ascii=False) + "\n"
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(serialized, encoding="utf-8")
        print(serialized, end="")
        return 1 if isinstance(value, dict) and value.get("automated_status") == "failed" else 0
    except (OSError, ValueError) as exc:
        print(json.dumps({"event": "harness.error", "message": str(exc)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
