// makefun-frontend-01 entry (Node 22, standard library only).
//
// The frontend is the app/ folder beside this file: plain static files a
// browser opens at app/index.html, reading make.fun's public API. This
// program hands it in: it copies app/ and screenshots/ into the output
// directory and writes dossier.json, the summary the judge reads, using the
// vendored make.fun library. vendor/makefun-frontend.ts stays as the kit
// shipped it: the scorer rebuilds the dossier with its own copy and the two
// must match byte for byte.
//
// Run it outside the grader with MAKEFUN_OUTPUT_DIR standing in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function handIn() {
  mkdirSync(outDir, { recursive: true });
  cpSync(join(root, 'app'), join(outDir, 'app'), { recursive: true });
  const shots = join(root, 'screenshots');
  mkdirSync(join(outDir, 'screenshots'), { recursive: true });
  if (existsSync(shots)) cpSync(shots, join(outDir, 'screenshots'), { recursive: true });
  // The scorer's own caps: at most 3 screenshots of 256 KiB, app/ at most
  // 993 files and directories and 16 MiB, the dossier text at most 160 KiB.
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 3, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 16777216,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

handIn();
