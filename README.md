# Aurora Courier — best-flight-game-20261126

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Thabiiey411beta/best-flight-game-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Thabiiey411beta/best-flight-game-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Game](https://img.shields.io/badge/game-offline%20HTML5-green)](game/index.html)

**Aurora Courier** is a complete, original bush-pilot flight game that plays
offline in a desktop browser from its own files — no network requests, no
external fonts, images or libraries, no build step.

## How to play

Serve `game/` with any static server (or `node serve.ts`, then open
http://localhost:8080) and fly:

- **↑ / ↓** — pitch up / down · **← / →** — bank and turn
- **SHIFT** — throttle up · **CTRL** — throttle down
- **Mouse** — steer by pointer position · **P** pause · **M** sound · **R** retry after a crash

Thread the golden rings over Gull Island in order — each ring scores 250
points and tops up fuel — then put the plane down gently on **Runway 09**
(speed under 58 m/s, wings near level) to complete the sortie. Three
sorties: **First Light** (dawn, 6 rings), **Ridge Runner** (day, 8 rings,
storm cells to dodge), **Aurora Night** (night, 10 rings, tight fuel).
Storms damage the airframe, terrain and the lake end a flight, and empty
tanks mean a glide to whatever is below.

## What is in the game

- Chase view over a procedurally generated island: hills, lake, forest,
  runway, drifting clouds, storm cells, and an aurora on the night sortie
- Full glass HUD: altitude, speed and heading, compass strip, artificial
  horizon, throttle / fuel / airframe gauges, ring counter and timer
- Synthesised WebAudio sound: engine hum that follows the throttle, wind,
  ring chimes, landing fanfare and crash — no audio files
- Keyboard, mouse and touch controls; pause, retry and a three-sortie
  campaign with a running total

## Files

| Path | What it does |
| --- | --- |
| `game/index.html` | Page, canvas, HUD shell |
| `game/src/main.js` | Game loop and state wiring |
| `game/src/config.js` | Tuning constants, missions, palettes |
| `game/src/random.js` | Seeded RNG and value noise |
| `game/src/world.js` | Island terrain, runway, rings, storms, trees, clouds |
| `game/src/physics.js` | Flight model, rings, collisions, landings |
| `game/src/render.js` | 3D projection, terrain, aircraft, HUD |
| `game/src/missions.js` | Sortie flow and campaign totals |
| `game/src/audio.js` | WebAudio synth sound bank |
| `game/src/input.js` | Keyboard, mouse and touch input |
| `game/src/shots.js` | Deterministic `?shot=` presets for screenshots |
| `main.ts` | Entry program: copies `game/` + `screenshots/` to `/output`, writes `dossier.json` |
| `serve.ts` | Dev-only static server for `game/` |
| `shots.json` | The four screenshot presets |
| `screenshots/` | 1-play (cover), 2-start, 3-ring, 4-land |

## Entry

Built for the [make.fun best flight game bounty](https://make.fun/bounty/best-flight-game-20261126-0057)
($500, top 50 share). `main.ts` (Node 22+, standard library only) hands the
game in; `vendor/makefun-game.ts` is the kit's copy, unchanged. License: MIT.
