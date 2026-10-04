"""[CAPSTONE INTEGRATION TARGET] Verify source hygiene and self-contained release documents.

With a repository's own .git metadata, inspect its index read-only, including
tracked files deleted from disk. A source-only handoff has no index: inspect all
delivered files instead and explicitly report source-tree mode. No Git writes.
Run with bytecode disabled: python -B scripts/release_hygiene.py.
"""
from __future__ import annotations
import fnmatch
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
from urllib.parse import unquote, urlsplit

IGNORE_PATTERNS = (
    '__pycache__/', '*.py[cod]', '*$py.class', '*.egg-info/', '*.egg-info',
    '.pytest_cache/', '.mypy_cache/', '.ruff_cache/', '.cache/', '.uv-cache/',
    '.ipynb_checkpoints/', '.coverage', '.coverage.*', 'htmlcov/',
    '.venv/', 'venv/', 'env/', '.tox/', '.nox/', 'node_modules/',
    'build/', 'dist/', 'out/', 'artifacts/', 'runtime/', 'test-results/', 'playwright-report/',
    '.godot/', 'Binaries/', 'Intermediate/', 'DerivedDataCache/', 'Saved/',
    '.DS_Store',
)


def generated_paths(paths: list[str]) -> list[str]:
    """Match the shared, unanchored .gitignore policy against repository paths."""
    found = []
    for path in paths:
        parts = PurePosixPath(path).parts
        if any(any(fnmatch.fnmatchcase(part, pattern.rstrip('/')) for part in
                   (parts[:-1] if pattern.endswith('/') else parts))
               for pattern in IGNORE_PATTERNS):
            found.append(path)
    return sorted(set(found))


def tree_files(root: Path):
    for directory, names, files in os.walk(root, followlinks=False):
        names[:] = sorted(name for name in names if name != '.git')
        for name in sorted(files):
            yield Path(directory) / name
        for name in names:
            path = Path(directory) / name
            if path.is_symlink():
                yield path


def release_paths(root: Path) -> tuple[str, list[str]]:
    if (root / '.git').exists():
        try:
            result = subprocess.run(['git', '-C', str(root), 'ls-files', '--cached', '-z'],
                                    capture_output=True, timeout=15, check=False)
        except (OSError, subprocess.TimeoutExpired) as error:
            raise RuntimeError('Cannot inspect repository index; release check cannot pass') from error
        if result.returncode:
            raise RuntimeError('Cannot inspect repository index; release check cannot pass')
        return 'git-index', [path for path in os.fsdecode(result.stdout).split('\0') if path]
    return 'source-tree', [path.relative_to(root).as_posix() for path in tree_files(root)]


def document_errors(root: Path) -> list[str]:
    root = root.resolve()
    errors = []
    for path in tree_files(root):
        relative = path.relative_to(root).as_posix()
        if generated_paths([relative]):
            continue
        if path.is_symlink():
            if not path.resolve().is_relative_to(root):
                errors.append(f'{relative}: symlink outside repository')
            continue
        if path.suffix not in ('.md', '.ipynb'):
            continue
        if path.suffix == '.ipynb':
            try:
                notebook = json.loads(path.read_text(encoding='utf-8'))
                content = '\n'.join(''.join(cell.get('source', [])) for cell in notebook['cells'] if cell.get('cell_type') == 'markdown')
            except (ValueError, KeyError, TypeError):
                errors.append(f'{relative}: invalid notebook')
                continue
        else:
            content = path.read_text(encoding='utf-8')
        content = re.sub(r'```.*?```|~~~.*?~~~', '', content, flags=re.S)
        for raw in re.findall(r'\]\(([^)]+)\)', content):
            target = raw.strip().split(' "')[0].strip('<>')
            parsed = urlsplit(target)
            if parsed.scheme in ('http', 'https', 'mailto', 'data', 'tel') or (not parsed.path and not parsed.scheme):
                continue
            if parsed.scheme:
                errors.append(f'{relative}: unsupported local link {target}')
                continue
            destination = (path.parent / unquote(parsed.path)).resolve()
            if not destination.is_relative_to(root):
                errors.append(f'{relative}: link outside repository: {target}')
            elif not destination.exists():
                errors.append(f'{relative}: missing local link: {target}')
    return errors


def handoff_errors(root: Path) -> list[str]:
    errors = []
    for name in ('README.md', 'LICENSE', '.gitignore', 'handoff/TRACKED_PATHS_TO_REMOVE.txt'):
        if not (root / name).is_file():
            errors.append(f'missing required release file: {name}')
    groups = (
        ('dossier', ('DEVOPS_HANDOFF.md', 'DEVOPS_DOSSIER.md')),
        ('backlog', ('BACKLOG.md', 'SPRINT_BACKLOG.md')),
        ('validation', ('VALIDATION.md', 'VALIDATION_REPORT.md', 'QA_REPORT.md')),
    )
    for label, names in groups:
        if not any((root / 'handoff' / name).is_file() for name in names):
            errors.append(f'missing {label} inside handoff/')
    return errors


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    try:
        mode, paths = release_paths(root)
        errors = [f'generated file in {mode}: {path}' for path in generated_paths(paths)]
        errors.extend(document_errors(root))
        errors.extend(handoff_errors(root))
    except RuntimeError as error:
        print(json.dumps({'status': 'failed', 'error': str(error)}))
        return 1
    print(json.dumps({'status': 'failed' if errors else 'passed', 'mode': mode,
                      'files_checked': len(paths), 'errors': errors}, indent=2))
    return int(bool(errors))


if __name__ == '__main__':
    sys.exit(main())
