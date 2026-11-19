[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Keso1234/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Keso1234/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# Solmar City

Solmar City is an original 2D top-down open-world crime game built in vanilla JavaScript. It runs entirely from static files in a desktop browser, with no network requests.

You play Kai Marlow, a driver new to a sun-soaked coastal city. Explore the streets on foot or behind the wheel, take on jobs, dodge the law, and build your reputation one score at a time.

## How to play

Run the server, then open the game in desktop Chrome:

```bash
node serve.ts --port 8080
```

Then visit http://localhost:8080

## Controls

- **WASD** — Walk, run, and drive
- **E** — Jack a nearby car
- **Mouse** — Aim and shoot

## Features

- Open city to explore on foot and by car, with civilian traffic and pedestrians
- Wanted system from 1 to 5 stars, with police pursuit that escalates as your heat rises
- 5 story missions with briefings, dialogue, waypoints, and cash rewards
- Repeatable taxi side job for extra cash between missions
- Combat with mouse aim, starting with a pistol and an SMG pickup to find
- HUD and live minimap to track your position, objectives, and wanted level
- Start screen and pause menu
- Save and load progress via localStorage
- Synthesized sound effects and music using WebAudio — no audio files needed

## Build

`main.ts` (Node 22) is the entrypoint. It copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.

## License

MIT, see LICENSE.
