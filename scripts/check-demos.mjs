// [CAPSTONE INTEGRATION TARGET] Strictly type-check each zero-build engine mock used to teach the native Plato boundary.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const pages = ['docs/index.html', 'docs/phase-1/index.html', 'docs/phase-2/index.html', 'docs/phase-3/index.html', 'docs/capstone/index.html'];
const temporary = mkdtempSync(join(tmpdir(), 'voltforge-checked-demos-'));
try {
  const sources = pages.map((page, index) => {
    const html = readFileSync(resolve(root, page), 'utf8');
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    if (scripts.length !== 1) throw new Error(`${page}: expected one inline engine script`);
    const destination = join(temporary, `phase-${index}.js`);
    writeFileSync(destination, scripts[0][1]);
    return destination;
  });
  const result = spawnSync(process.execPath, [
    require.resolve('typescript/bin/tsc'), '--allowJs', '--checkJs', '--noEmit', '--strict',
    '--target', 'ES2022', '--lib', 'ES2022,DOM', '--skipLibCheck', ...sources,
  ], { cwd: root, stdio: 'inherit', timeout: 30_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
  else console.log(`Strict checked-JavaScript validation passed for ${pages.length} standalone demos.`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
