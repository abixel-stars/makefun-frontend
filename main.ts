// Entry program for makefun-frontend-01 (Node 22, standard library only).
//
// The frontend is the plain static files in app/ beside this file: a browser
// opens app/index.html and the app reads make.fun's public API from there, no
// build step. This program hands the entry in: it copies app/ and
// screenshots/ into the output directory and writes dossier.json there, the
// summary the judge reads, using the kit's vendored library
// (vendor/makefun-frontend.ts, unchanged). The grader runs this file twice
// and both runs must write identical bytes; everything here is deterministic
// (plain file copies plus a dossier built from those files alone).
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function handIn() {
  mkdirSync(outDir, { recursive: true });
  cpSync(join(repoRoot, 'app'), join(outDir, 'app'), { recursive: true });
  const shotsOut = join(outDir, 'screenshots');
  mkdirSync(shotsOut, { recursive: true });
  const shotsIn = join(repoRoot, 'screenshots');
  if (existsSync(shotsIn)) cpSync(shotsIn, shotsOut, { recursive: true });
  // The caps mirror the gate: 3 screenshots at most 256 KiB each, app/ at
  // most 993 files and 16 MiB, dossier text at most 160 KiB.
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 3, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 16777216,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

handIn();
