// [CAPSTONE INTEGRATION TARGET] Bundle Main, isolated Preload, and browser-only Renderer.
import { build } from 'esbuild';
import { mkdir, copyFile, rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await Promise.all([
  build({ entryPoints: ['src/main.ts'], outfile: 'dist/main.js', bundle: true, platform: 'node', target: 'node22', format: 'cjs', external: ['electron'], sourcemap: true }),
  build({ entryPoints: ['src/preload.ts'], outfile: 'dist/preload.js', bundle: true, platform: 'node', target: 'node22', format: 'cjs', external: ['electron'], sourcemap: true }),
  build({ entryPoints: ['src/renderer.ts'], outfile: 'dist/renderer.js', bundle: true, platform: 'browser', target: 'chrome132', format: 'iife', sourcemap: true }),
  copyFile('src/index.html', 'dist/index.html'),
  copyFile('src/styles.css', 'dist/styles.css'),
]);
console.log(JSON.stringify({ event: 'build_complete', output: 'dist' }));
