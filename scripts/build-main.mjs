import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

const isWatch = process.argv.includes('--watch');
const distDir = 'dist';

// Clean stale tsc artifacts (individual .js/.d.ts files) before bundling,
// but preserve the renderer/ subdirectory built by Vite.
for (const entry of fs.readdirSync(distDir)) {
  if (entry === 'renderer') continue;
  const fullPath = path.join(distDir, entry);
  fs.rmSync(fullPath, { recursive: true, force: true });
}

/** @type {import('esbuild').BuildOptions} */
const commonOptions = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  sourcemap: true,
  external: [
    'electron',
    'better-sqlite3',
    '@anthropic-ai/claude-agent-sdk',
  ],
  outdir: 'dist',
  logLevel: 'info',
};

const entryPoints = [
  { in: 'src/main.ts', out: 'main' },
  { in: 'src/preload.ts', out: 'preload' },
];

if (isWatch) {
  const ctx = await esbuild.context({
    ...commonOptions,
    entryPoints,
  });
  await ctx.watch();
  console.log('[esbuild] watching for changes...');
} else {
  await esbuild.build({
    ...commonOptions,
    entryPoints,
  });
}
