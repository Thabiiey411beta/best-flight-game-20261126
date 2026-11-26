// Aurora Courier — best-flight-game-20261126 entry program (Node 22+, stdlib only).
//
// The game is plain static files under game/: index.html plus ES modules,
// no libraries, no network requests, nothing to build. This program hands
// it in: it copies game/ and screenshots/ from beside this file into
// /output and writes /output/dossier.json with the kit's vendored library
// (vendor/makefun-game.ts, unchanged), which is the summary the judge reads.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the game locally while developing with `node serve.ts`, then open
// http://localhost:8080.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail fast with a readable message instead of a bare fs error when the
// entry is incomplete: the grader runs this twice and both runs must agree,
// so a half-written output directory is worse than no output at all.
const gameDir = join(here, 'game');
if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('game/index.html is missing; the entry is incomplete');
}
const shotsDir = join(here, 'screenshots');
if (!existsSync(shotsDir) || readdirSync(shotsDir).filter((f) => !f.startsWith('.')).length < 3) {
  throw new Error('screenshots/ needs at least 3 images; the entry is incomplete');
}
const gameBytes = readdirSync(gameDir, { recursive: true })
  .map((f) => join(gameDir, f))
  .filter((f) => statSync(f).isFile())
  .reduce((sum, f) => sum + statSync(f).size, 0);
if (gameBytes > 48 * 1024 * 1024) {
  throw new Error(`game/ is ${gameBytes} bytes, over the scorer's 48 MiB cap`);
}

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps: only text_max_bytes shapes the bytes; the others
// refuse an entry the scorer would refuse (more than 4 screenshots or one
// over 256 KiB; more than 993 files in game/ or 48 MiB of game files in all,
// or a path under game/ over 1000 bytes — game/ counts beside /output's own
// 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
