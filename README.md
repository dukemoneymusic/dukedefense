# DUKE$DEFENSE

A tower-defence shooter across fifteen districts of New York City. You are
defending a giant golden apple from everything living underneath the place,
with real weapons, free placement, and up to four players.

Same core loop as *Carrot Fantasy* — put guns down, hold the route, shoot the
drops for money, boss at the end of every map — with a hand-built 2.5D city
renderer and a proper armour model behind it.

---

## Play it

**Single player:** double-click `index.html`. No build step, no install, no
dependencies, no network. Every texture, building, creature and sound is
generated procedurally in the browser at load.

**Co-op (up to 4 players):**

```bash
node server.js
```

It prints something like:

```
  Local     http://localhost:8177
  Network   http://192.168.1.42:8177   <- friends use this
```

Everyone on your WiFi opens that **Network** address in a browser, hits
**CO-OP · 4 PLAYER**, and one person hosts while the rest join with the
four-letter room code. The server box fills itself in automatically.

Progress and stars save to `localStorage`.

### Playing with a friend who ISN'T on your WiFi

You need a public link. There are two ways.

**Easiest — double-click `PLAY-ONLINE.cmd`.** It starts the server and opens a
free Cloudflare quick tunnel, then prints a line like:

```
https://something-random.trycloudflare.com
```

That's the link — send it to your friend. Both of you open it, tap **CO-OP**,
one **Hosts** and shares the four-letter room code, the other **Joins**. No
sign-up, no install prompt for your friend, no address to type. Keep the two
windows open while you play; close them when you're done. (First run downloads
Cloudflare's tunnel tool once, ~35 MB, from the official Cloudflare release.)

The catch: your PC is the host, so it has to stay on while you play.

**Permanent — deploy it, and the link is always up.** `render.yaml`,
`Procfile` and `package.json` are included and the server honours `PORT` /
`HOST`, so Render / Railway / Fly.io / Heroku all work with no code changes.
Push the folder to a Git repo, connect it, and you get a `https://…` link that
works forever without keeping your PC on. **You create that free account and
click deploy yourself — I can't provision hosting for you.**

Whichever you use, the game figures out the WebSocket address from the link
itself, so there is nothing to configure — your friend just opens it and plays.

### Playing with someone in the same house

Double-click `PLAY-LAN.cmd`, or run `node server.js`, and share the **Network**
address it prints (e.g. `http://192.168.1.153:8177`). Only reachable by people
on the same router.

---

## How it plays

### Emplace anywhere

There are no build pads. Pick a weapon off the tray and set it down **anywhere
that isn't the road or a building.** A green footprint means clear ground, red
means find somewhere else. Baking each district produces a placement mask that
marks the street, every building footprint, the landmark and the apple's
plinth as off-limits.

### Your sidearm

With no weapon selected, **click to shoot**. It won't carry a wave, but it
finishes wounded runners and pays **25% extra bounty** on anything it kills.

### Shoot the drops

Kills and periodic supply drops leave things lying in the street. Shoot them
before they expire:

| Drop | Effect |
|------|--------|
| **Cash** | Straight money, scaling with how deep you are |
| **Ammo crate** | +40% fire rate on every weapon for 8 seconds |
| **Medkit** | Repairs 2 bites on the Apple |

Bosses always drop. This is the main reason to keep panning around the map
instead of staring at one corner.

### Move the camera

The battlefield is **2560 × 1440** — far bigger than the window.

- **Right-drag** (or middle-drag, or one finger on touch) to pan
- **WASD / arrows** to pan
- **Wheel**, or **Q** / **E**, to zoom
- **Click the minimap** (bottom right) to jump

---

## The arsenal

Twelve weapons, three tiers each. The line that matters: **the four heavy
indirect-fire pieces cannot elevate onto air targets.**

| # | Weapon | Cost | Ammo | Engages | Role |
|---|--------|------|------|---------|------|
| 1 | Sidearm Post `9mm` | $90 | Ball | Ground + Air | Cheap, fast, always right to open with |
| 2 | Breach Gun `12G` | $130 | Buckshot | Ground | Cone of buckshot with a hard shove behind it |
| 3 | SMG Nest `SMG` | $160 | Ball | Ground + Air | Tiny reach, absurd cyclic rate |
| 4 | Rifle Post `M4` | $180 | Ball | Ground + Air | Three-round burst, good all-rounder |
| 5 | Cryo Cannon `CRY` | $190 | Cryogenic | Ground + Air | Slows, embrittles, strips armour |
| 6 | Grenade Launcher `GL` | $200 | HE | Ground | Lobbed 40mm splash |
| 7 | Machine Gun Nest `SAW` | $260 | Ball | Ground + Air | Winds up, then doesn't stop |
| 8 | Flamethrower `FLM` | $240 | Incendiary | Ground | Sustained cone, ignores armour, keeps burning |
| 9 | Arc Emitter `ARC` | $300 | Energy | Ground + Air | Chains body to body, ignores armour |
| 10 | Anti-Materiel Rifle `.50` | $300 | AP | Ground + Air | Enormous reach, crits, pierces |
| 11 | Rocket Battery `RKT` | $340 | HE | Ground + Air | Fire-and-forget seekers |
| 12 | Mortar Pit `MTR` | $380 | HE | Ground | Half the map of reach, dead zone at its feet |

### Armour

Armour scales against the **size** of each hit rather than subtracting a flat
amount — `effective = dmg² / (dmg + armour × k)`.

| Ammunition | k | Behaviour |
|------------|---|-----------|
| Buckshot | 3.2 | Shredded by plate |
| Ball | 2.0 | Punished hard by plate |
| Cryogenic | 1.1 | Middling, but it slows |
| HE | 0.8 | ×1.35 vs armour ≥ 6 — the anti-tank answer |
| AP | 0.5 | Mostly straight through |
| Incendiary / Energy | — | Ignores armour entirely |

So a nine-millimetre still chips a Sewer Gator, it just does it badly, while a
mortar round goes most of the way through and the Arc Emitter doesn't care
about plating at all.

---

## The districts

Each has its own ground surface, palette, weather, time of day, landmark,
route layout and roster.

| # | District | Borough | Notes |
|---|----------|---------|-------|
| 1 | Times Square | Midtown | Night, billboard wall, one long S-curve |
| 2 | Central Park | The Ramble | Daylight, turf, Washington Square arch |
| 3 | Brooklyn Bridge | East River | Two lanes converging, boardwalk deck |
| 4 | Wall Street | FiDi | Cobblestone canyon, fog, tight zigzag |
| 5 | Chinatown | LES | Rain, lanterns, two alleys into one square |
| 6 | Coney Island | S. Brooklyn | Boardwalk, Wonder Wheel + Cyclone |
| 7 | Harlem | Uptown | Brownstones, the Apollo, cross-street assault |
| 8 | Grand Central | Concourse | Marble, three ramps, the clock |
| 9 | SoHo | Cast Iron | Belgian block, scaffolding, long spiral |
| 10 | Liberty Island | Harbor | Seawall causeway from both sides |
| 11 | Yankee Stadium | The Bronx | Night game, the frieze, warning-track route |
| 12 | Flushing Meadows | Queens | Autumn, the Unisphere |
| 13 | St. George Terminal | Staten Island | Dense fog, the orange boat |
| 14 | Midtown Rooftops | Above 34th | Thunderstorm, 800 feet up, air-heavy |
| 15 | The Tunnels | Beneath It All | Three tunnel mouths, no daylight, last stand |

---

## Hostiles

Fourteen regulars plus five bosses:

- **Tour Group** splits into three rats when killed
- **Costume Character** heals everything near it
- **Pizza Rat** steals cash when it bites the apple
- **Squirrel** dodges a fraction of incoming fire
- **Bedbug** is immune to slows and freezing
- **Scaffold Golem** regenerates; the **Titan** also carries a shield
- **Sewer Gator** and **Gator Lord** enrage below 40% health
- **Rat King** and **Big Cheese** continuously spawn escorts

**Flyers cut the corners of the street rather than beelining for the apple.**
They arrive faster than anything on the ground but stay contestable — a
straight line to the target would fly them over rooftops no weapon could
reach.

---

## Field support

Three, on independent cooldowns — shared across the squad in co-op:

- **Suppress** `Z` (34s) — slows everything on the map for 5.5s
- **Cryo Burst** `X` (52s) — freezes everything for 3.6s; frozen targets take
  35% extra damage
- **Airstrike** `C` (40s) — aimed; 460 HE in a 150px radius plus a stun

---

## Controls

| Input | Action |
|-------|--------|
| **Click** (nothing selected) | Fire your sidearm / grab a drop |
| **Click** a weapon | Upgrade, retarget, or sell (70% back) |
| `1`–`0`, `-`, `=` | Pick a weapon off the tray |
| **Click** with one armed | Emplace it |
| **Right-drag** / `WASD` | Pan the camera |
| **Wheel** / `Q` `E` | Zoom |
| `Z` `X` `C` | Suppress / Cryo Burst / Airstrike |
| `SPACE` | Pause (single player only) |
| `F` | Cycle 1× / 2× / 3× |
| `N` | Send the next wave early |
| `ENTER` | Chat (co-op) |
| `ESC` / right-click | Cancel |

---

## Co-op notes

- **Shared everything** — one pot of money, one apple, one set of cooldowns.
- **Everyone builds and shoots.** A coloured dot under each weapon shows who
  put it there, and you can see your squad's crosshairs live.
- **The host runs the battle.** Their browser owns the simulation and pushes
  snapshots at 12Hz; everyone else sends commands and interpolates. If the
  host drops, the next player is promoted automatically.
- **Only the host** sends waves and changes speed. There is no pausing.
- Co-op clears award one fewer star than solo.

---

## How it's built

```
index.html          markup + screens
css/game.css        interface
js/core.js          math, seeded RNG, value noise, camera, WebAudio synth, save
js/art.js           procedural textures, extruded buildings, landmarks, placement mask
js/data.js          the arsenal, the vermin, wave generator, fifteen districts
js/render.js        weapon + creature sprites, effects, weather, frame pipeline
js/game.js          simulation: combat, waves, economy, pickups, snapshots
js/net.js           client netcode
js/ui.js            screens, camera input, HUD, tray, lobby, main loop
server.js           static host + co-op relay (zero dependencies)
```

### The renderer

The world is a fixed 2560×1440 plane; the camera shows a slice. The camera
hangs over a nadir *below* the frame, so every volume leans the same way — up
and slightly outward. Each building shows the wall facing the viewer, and
nothing ever grows downward over the street behind it. Buildings that *would*
rise over a piece of playfield get cut down at bake time until they don't.

Levels bake once into three surfaces plus a mask: the lit scene, a multiply
layer for time of day, an additive layer for practical lights, and the coarse
grid of where you may build. The night grade lands on the **scenery only** —
creatures, weapons and effects draw after it, so a rat on an unlit stretch of
asphalt stays legible at 3am in a rainstorm.

### Audio

Entirely synthesised at runtime. Each weapon gets its own report built from a
broadband noise transient over a low-frequency thump — bigger calibre means a
lower thump, a longer tail, and in the .50's case a crack coming back off the
buildings a sixth of a second later. Each district gets a mood driving a pad,
a slow filter LFO, and a sparse arpeggio over a subway-ish pulse. No files.

### Netcode

`server.js` implements RFC 6455 directly rather than pulling in `ws`, because
depending on npm would mean the game stops being "download it and
double-click it". Rooms are four players, created on demand by code, with
automatic host migration.

---

## Balance

Tuned against a scripted player that emplaces along the routes, alternates
lanes, mixes ammunition types and then tiers up — and never uses a single
field-support power. That bot survives **11 of 15** districts, and the four it
loses it reaches waves 9, 11, 14 and 18-of-18 before folding. That leaves the
back half genuinely difficult for a human who does have the powers, can
reposition, and is shooting the drops.

Every district hands you a fresh wallet, so wave 1 stays beatable with tier-1
weapons everywhere. District difficulty comes from the roster, the extra
lanes, and the wave count — not from multiplying turn-one hit points.
