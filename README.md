# Solmar City — make.fun gta6-01 entry

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Keso1234/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Keso1234/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An entry for the [make.fun](https://make.fun) bounty
[gta6-01](https://make.fun/bounty/gta6-01): make GTA 6 — the most
complete open-world crime game possible, playable in a desktop browser
from static files, no network request.

## What it is

**Solmar City** — an original 2D top-down open-world crime game in
vanilla JavaScript (no libraries, no network). You play Kai Marlow, a
driver new to a sun-soaked coastal city. All city, characters,
vehicles, names, story, art, sound and music are original — nothing
from Rockstar Games.

- **On foot and by car:** walk/run (WASD), jack parked or traffic cars
  (E), drive with accel/brake/steering and handbrake.
- **Traffic and pedestrians:** civilian cars drive the road grid,
  brake and honk; pedestrians walk sidewalks and flee when scared.
- **Wanted 1–5 stars:** crimes raise heat; police cars pursue, ram
  and box in; foot cops chase and bust; respray at Lena's Garage.
- **5 story missions** with briefings, dialogue, waypoints and cash
  rewards, plus a repeatable taxi side job.
- **Combat:** mouse aim, pistol + SMG pickup, enemies that shoot back.
- **HUD + minimap:** health/armor, cash, clock, wanted stars,
  speedometer, objective tracker, live circular minimap.
- **Start screen, pause menu, save/load** (localStorage), WebAudio
  synthesized sound and music.

## How to run

```sh
node serve.ts --port 8080
```

Then open `http://localhost:8080` in desktop Chrome. Keyboard + mouse.
Screenshot stagings: `?shot=chase|street|drive|start|port&seed=1337`.

`main.ts` (Node 22) is the entrypoint: it copies `game/` and
`screenshots/` to `/output` and writes `dossier.json` with the vendored
make.fun library (`vendor/makefun-game.ts`).

## License

MIT — see [LICENSE](LICENSE).
