[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Keso1234/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Keso1234/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# Solmar City

An original 2D top-down open-world crime game, built in vanilla JavaScript and playable in a desktop browser from static files, with no network requests.

You play Kai Marlow, a driver new to a sun-soaked coastal city. Explore the streets on foot or behind the wheel, take jobs, earn cash, and stay one step ahead of the police.

## How to play

- **Move:** WASD to walk and run
- **Drive:** get close to a car and press E to jack it, then drive with WASD
- **Fight:** aim with the mouse and click to shoot; pick up a pistol and an SMG
- **Wanted level:** 1 to 5 stars — the higher it climbs, the harder the police chase you
- **Missions:** 5 story missions with briefings, dialogue, waypoints, and cash rewards
- **Side work:** a repeatable taxi job for extra cash between missions
- **World:** civilian traffic and pedestrians moving around the city
- **Interface:** HUD and a live minimap, plus a start screen and pause menu
- **Progress:** save and load through localStorage
- **Sound:** synthesized WebAudio effects and music — no audio files needed

## Run it

```sh
node serve.ts --port 8080
```

Then open http://localhost:8080 in desktop Chrome.

`main.ts` (Node 22) is the entrypoint. It copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.

## License

MIT, see LICENSE.
