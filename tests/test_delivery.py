"""[CAPSTONE INTEGRATION TARGET] Falsify incomplete or misleading curriculum deliveries."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location('delivery_check', Path(__file__).resolve().parents[1] / 'scripts' / 'check-delivery.py')
CHECK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECK)


class DeliveryCheckTests(unittest.TestCase):
    def test_link_resolves_from_its_document_and_rejects_missing_file(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'guide').mkdir()
            page = root / 'guide' / 'README.md'
            page.write_text('[good](../target.md) [web](https://example.com) [bad](lost.md) [local](#intro)')
            (root / 'target.md').write_text('target')
            self.assertEqual(CHECK.check_links(page, root), ['guide/README.md: missing link target lost.md'])

    def test_first_notebook_cell_must_explain_capstone(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'lab.ipynb'
            path.write_text(json.dumps({'nbformat': 4, 'cells': [{'cell_type': 'code', 'source': ['print(1)']}]}))
            self.assertTrue(CHECK.check_notebook(path))
            path.write_text(json.dumps({'nbformat': 4, 'cells': [{'cell_type': 'markdown', 'source': ['[CAPSTONE INTEGRATION TARGET] A meaningful application.']}]}))
            self.assertEqual(CHECK.check_notebook(path), [])

    def test_unknown_notebook_format_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'lab.ipynb'
            path.write_text('{invalid json')
            self.assertTrue(CHECK.check_notebook(path))


if __name__ == '__main__':
    unittest.main()
