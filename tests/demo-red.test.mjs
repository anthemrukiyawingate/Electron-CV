// [CAPSTONE INTEGRATION TARGET] Verify each standalone learning engine exists and preserves browser-only simulation boundaries.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
for (const path of ['docs/index.html', 'docs/phase-1/index.html', 'docs/phase-2/index.html', 'docs/phase-3/index.html', 'docs/capstone/index.html']) {
  test(`standalone accessible simulation: ${path}`, () => {
    const html = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    assert.match(html, /\[CAPSTONE INTEGRATION TARGET\]/);
    assert.match(html, /requestAnimationFrame/);
    assert.match(html, /prefers-reduced-motion/);
    assert.match(html, /<canvas/);
    assert.match(html, /simulation/i);
    assert.match(html, /aria-live/);
    assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=["']https?:|\beval\s*\(|new\s+Function\s*\(/);
    assert.match(html, /textContent/);
  });
}
