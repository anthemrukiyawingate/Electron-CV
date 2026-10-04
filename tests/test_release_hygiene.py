"""[CAPSTONE INTEGRATION TARGET] Reject generated tracked files and external handoff dependencies."""
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('release_hygiene', ROOT / 'scripts/release_hygiene.py')
HYGIENE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(HYGIENE)


class ReleaseHygieneTests(unittest.TestCase):
    def test_no_tracked_or_delivered_generated_files(self):
        mode, paths = HYGIENE.release_paths(ROOT)
        self.assertIn(mode, ('git-index', 'source-tree'))
        self.assertEqual(HYGIENE.generated_paths(paths), [])

    def test_deleted_but_still_tracked_artifact_fails(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / '.git').mkdir()
            tracked = b'src/good.py\0gone/__pycache__/bad.pyc\0gone/pkg.egg-info/PKG-INFO\0'
            with patch.object(HYGIENE.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, tracked, b'')):
                mode, paths = HYGIENE.release_paths(root)
            self.assertEqual(mode, 'git-index')
            self.assertEqual(HYGIENE.generated_paths(paths), ['gone/__pycache__/bad.pyc', 'gone/pkg.egg-info/PKG-INFO'])

    def test_generated_policy_covers_every_requested_category(self):
        paths = ['a/__pycache__/b.pyc', 'a.pyc', 'b.pyo', '.pytest_cache/v/cache',
                 '.venv/bin/python', 'env/bin/python', 'node_modules/a/index.js',
                 'out/app.exe', 'artifacts/source.zip', 'runtime/bridge.json', 'dist/a.js', 'build/lib/a.py', 'src/a.egg-info/PKG-INFO',
                 '.godot/imported/cache', 'project/Intermediate/file.obj']
        self.assertEqual(HYGIENE.generated_paths(paths), sorted(paths))
        self.assertEqual(HYGIENE.generated_paths(['src/app.py', 'handoff/VALIDATION.md', 'docs/index.html']), [])

    def test_git_failure_cannot_fall_back_to_a_passing_tree_check(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / '.git').mkdir()
            with patch.object(HYGIENE.subprocess, 'run', return_value=subprocess.CompletedProcess([], 128, b'', b'bad index')):
                with self.assertRaises(RuntimeError):
                    HYGIENE.release_paths(root)

    def test_gitignore_contains_the_complete_release_policy(self):
        patterns = {line.strip() for line in (ROOT / '.gitignore').read_text().splitlines() if line.strip() and not line.startswith('#')}
        self.assertTrue(set(HYGIENE.IGNORE_PATTERNS) <= patterns)

    def test_local_document_links_stay_inside_delivered_root(self):
        self.assertEqual(HYGIENE.document_errors(ROOT), [])

    def test_existing_file_outside_repository_is_still_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            outside = Path(folder)
            root = outside / 'repo'
            root.mkdir()
            (outside / 'secret.md').write_text('not delivered')
            (root / 'README.md').write_text('[bad](../secret.md)')
            self.assertIn('outside repository', '\n'.join(HYGIENE.document_errors(root)))

    def test_handoff_and_license_exist_inside_repository(self):
        self.assertEqual(HYGIENE.handoff_errors(ROOT), [])


if __name__ == '__main__':
    unittest.main()
