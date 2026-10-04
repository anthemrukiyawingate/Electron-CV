"""[CAPSTONE INTEGRATION TARGET] Check curriculum integrity before the Build team takes delivery.

Run from any directory: python scripts/check-delivery.py. This is an artifact check;
runtime, Windows, hardware and publication gates remain separate.
"""
from __future__ import annotations
import json
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED = {'.git', '.codex', '.agents', 'node_modules', '.venv', 'dist', 'out', 'test-results', 'playwright-report', '__pycache__', '.ipynb_checkpoints'}
REQUIRED = (
    'README.md', 'LICENSE', 'handoff/BACKLOG.md', 'handoff/DEVOPS_HANDOFF.md', 'handoff/VALIDATION.md',
    'handoff/AGENT_PROTOCOL.md', 'package.json', 'package-lock.json', 'forge.config.ts', 'requirements.txt',
    'docs/index.html', 'docs/.nojekyll', 'docs/phase-1/index.html', 'docs/phase-2/index.html',
    'docs/phase-3/index.html', 'docs/capstone/index.html',
    '01_Phase1_Main_and_Renderer_Architecture/architecture.ipynb',
    '02_Phase2_Context_Bridge_and_Security/security.ipynb',
    '03_Phase3_IPC_and_System_Integration/ipc.ipynb',
    'Projects/mini_projects/README.md', 'Projects/CAPSTONE_Plato_Dashboard_Electron/README.md',
)


def check_links(path: Path, root: Path = ROOT) -> list[str]:
    """Validate local file targets (anchors and remote links belong to other checks)."""
    errors = []
    source = re.sub(r'```.*?```', '', path.read_text(encoding='utf-8'), flags=re.S)
    for match in re.finditer(r'(?<!!)\[[^\]]+\]\(([^)]+)\)', source):
        target = match.group(1).strip().split(' "')[0].strip('<>')
        parsed = urlsplit(target)
        if parsed.scheme or not parsed.path:
            continue
        destination = (path.parent / unquote(parsed.path)).resolve()
        if not destination.is_relative_to(root.resolve()):
            errors.append(f'{path.parent.name}/{path.name}: link outside repository {target}')
        elif not destination.exists():
            errors.append(f'{path.parent.name}/{path.name}: missing link target {target}')
    return errors


def check_notebook(path: Path) -> list[str]:
    try:
        notebook = json.loads(path.read_text(encoding='utf-8'))
        first = notebook['cells'][0]
        if notebook.get('nbformat') != 4 or first['cell_type'] != 'markdown' or '[CAPSTONE INTEGRATION TARGET]' not in ''.join(first['source']):
            return [f'{path.name}: first cell must be a Markdown capstone callout in a v4 notebook']
        return []
    except (ValueError, KeyError, IndexError, TypeError) as error:
        return [f'{path.name}: malformed notebook ({type(error).__name__})']


def source_files(directory: Path):
    for child in sorted(directory.iterdir()):
        if child.name in EXCLUDED or child.is_symlink():
            continue
        if child.is_dir():
            yield from source_files(child)
        elif child.is_file():
            yield child


def main() -> int:
    errors = [f'missing required artifact: {item}' for item in REQUIRED if not (ROOT / item).is_file()]
    checked = 0
    for path in source_files(ROOT):
        checked += 1
        if path.suffix == '.md':
            errors.extend(check_links(path))
        elif path.suffix == '.ipynb':
            errors.extend(check_notebook(path))
        elif path.suffix in {'.py', '.ts', '.js', '.mjs'}:
            if '[CAPSTONE INTEGRATION TARGET]' not in path.read_text(encoding='utf-8')[:1600]:
                errors.append(f'{path.relative_to(ROOT)}: missing opening capstone callout')
    print(json.dumps({'event': 'delivery_check', 'files_checked': checked, 'ok': not errors, 'errors': errors}, indent=2))
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
