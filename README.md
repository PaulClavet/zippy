# Zippy ⚡

A fast, web-based, **wormhole-aware route planner for EVE Online** — an open-source
reimagining of [Short Circuit](https://github.com/secondfry/shortcircuit/) (and the
original _Pathfinder_) as a modern web app.

EVE's in-game autopilot only knows stargates. Zippy builds the **whole** graph — every
stargate from the Static Data Export _plus_ live wormhole connections from mappers — and
runs shortest-path over it, so it can route you through holes the game never will.

## Features

- **Shortest-path routing** across stargates **and** wormholes (Dijkstra).
- **Security preferences** — per-band weights (High/Low/Null/W-space, 1–100) or presets
  (_Shortest_, _Prefer safer_, _Safest_, _Prefer low/null_).
- **Wormhole restrictions** — minimum ship size, ignore end-of-life holes, ignore
  mass-critical holes, ignore stale signatures older than _N_ hours.
- **Avoidance list** — route around specific systems (regions too, via the API); **Zarzakh
  is auto-avoided** unless it's your source/destination.
- **Live wormhole data**:
  - **Eve-Scout** — public Thera & Turnur connections, zero setup.
  - **Tripwire** — connect with your Tripwire account to pull your chain.
- **EVE SSO integration** — read your current location to set the source, and **breadcrumb
  the route into the in-game autopilot** (a waypoint on each K-space anchor; wormhole jumps
  are flown manually).
- **Fleet-friendly output** — a copy-paste one-liner:
  `Zippy: Jita --3 gates--> Nourvukaiken ~~>[ABC-123 K162] J123456 --1 gate--> Amamake`

## Quick start

```bash
pnpm install
pnpm sde:build      # download the EVE SDE & build the star map (~0.5 MB, one-time)
pnpm dev            # http://localhost:3000
```

`pnpm sde:build` fetches the current [Fuzzwork](https://www.fuzzwork.co.uk/dump/) dumps and
writes `lib/sde/data/starmap.json` (8,490 systems, ~6,989 gate connections). Until you run
it, Zippy falls back to a tiny 9-system demo map.

### Enabling EVE login (optional)

Location + autopilot need an EVE application. Register one at
[developers.eveonline.com](https://developers.eveonline.com/):

- **Callback URL:** `http://localhost:3000/api/auth/callback`
- **Scopes:** `esi-location.read_location.v1`, `esi-ui.write_waypoint.v1`

Then copy `.env.example` to `.env.local` and fill in `EVE_CLIENT_ID` / `EVE_CLIENT_SECRET`.
Without these, everything except location/autopilot works.

## How it works

```
lib/graph/      Star-map graph + Dijkstra pathfinder (pure, framework-free)
lib/sde/        SDE loader + system search (reads the generated starmap.json)
lib/mappers/    Eve-Scout + Tripwire clients → wormhole connections
lib/esi/        EVE SSO OAuth, JWT decode, ESI client, cookie session
lib/eve/        Domain glue: constants, planner, navigation/formatting, colors
app/api/        Route handlers (search, route, mappers, auth, esi)
components/      React UI (route planner, autocomplete, results table)
scripts/        build-sde.mjs — SDE download & compaction
```

The graph is the engine; ESI is I/O at the edges. A base gate-only map is built once and
cached; live wormholes are layered onto a clone per request (`cloneStarMap` +
`applyWormholes`) so the shared base is never mutated.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm test` | Vitest unit tests |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm sde:build` | Rebuild the star map from the SDE |

## Testing

`pnpm test` covers the pathfinder (security weights, avoidance, wormhole size/EOL/mass
filters), the navigation/fleet formatter, the Eve-Scout & Tripwire parsers (against real
captured payloads), the planner (Zarzakh auto-avoid, region avoidance, waypoint anchors),
and a live SDE routing check (Jita → Amarr).

## Roadmap

- Visual star map / route overlay.
- Smarter autopilot control — port Hypatia's caution-slider tricks to force the in-game
  route along Zippy's exact path.
- JWKS signature verification for access tokens.
- Region avoidance + multi-character in the UI.
- Persisted, auto-refreshing chains.

## Credits & license

Inspired by **Short Circuit** by secondfry and the original **Pathfinder** (2016 EVE CREST
API Challenge winner). Wormhole static sizes are derived from Short Circuit's `statics.csv`.
Live data from [Eve-Scout](https://eve-scout.com/) and [Tripwire](https://tripwire.eve-apps.com/).

Copyright © 2026 Paul Clavet and Zippy contributors. Licensed under the **GNU AGPL-3.0-or-later**
(see [LICENSE](./LICENSE)) — if you run a modified version on a network server, you must offer
its source to users. EVE Online is a trademark of CCP hf.; Zippy is not affiliated with or
endorsed by CCP.
