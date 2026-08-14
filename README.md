# perfect-tracking-client

Unofficial client for the [perfect-tracking.com](https://www.perfect-tracking.com/) live race tracking platform — the system behind races like the **Race Around Austria**. Fetch races, live GPS positions, results, routes and points of interest.

```ts
import { PerfectTracking } from "perfect-tracking-client";

const client = new PerfectTracking();
const race = await client.getRace("raa2026");

for await (const update of client.watchLive(race.id)) {
  for (const p of update.update) {
    console.log(p.id, `${p.speed} km/h`, p.geo);
  }
}
```

## How the backend actually works

`race.perfect-tracking.com/race/{slug}/live` is an Angular single-page app (the JS bundle is `main-*.js`, built with the Angular CLI). It has **no WebSocket** — every "live" update is a plain HTTP poll:

- A generic `DataService` calls `GET /api/{path}` and unwraps the response's `.data` field.
- The live map does one `Live/DataLiveAll/{raceId}` fetch on load (groups + participants + an initial position batch), then polls `Live/DataLiveUpdateAll/{raceId}` **every 20 seconds**, via a recursive `setTimeout` — not `setInterval` — so a slow response never overlaps the next request.
- The POI layer polls `Race/DataPois/{raceId}` on the same 20s cadence, independently.
- Routes are pre-computed, dense `[lat, lon, km, elevation]` point arrays (`Race/DataRoute(All)`). Live updates don't carry raw coordinates most of the time — they carry a `point` index into that array (`bindroute: true`), so the client just looks up `route.data[point]`. Only when `bindroute` is false does `position` carry an inline WKT-ish coordinate string.
- Endpoints follow ASP.NET-style `{Controller}/{Action}/{id}` routing and were found by grepping the deobfuscated bundle for `.http.get(` and tracing every method on the Angular `RaceService`.

Full endpoint map (all under `https://race.perfect-tracking.com/api/`):

| Endpoint | What it returns |
| --- | --- |
| `Race/Races` | All public races |
| `Race/Race/{slug}` | One race: route variants ("Strecken"), start/stop times |
| `Race/DataStrecke/{streckeId}` | Detailed stations for one route variant |
| `Race/DataStreckeAll/{raceId}` | Lighter station list, all route variants |
| `Race/DataRoute/{streckeId}` | Raw GPS track for one route variant |
| `Race/DataRouteAll/{raceId}` | Raw GPS tracks, all route variants |
| `Race/DataPois/{raceId}` | Map points of interest (polled every 20s) |
| `Ergebnisse/Data(All)/{id}` | Results table(s) |
| `Race/DataPageTeilnehmer/{id}` | One participant's own station-by-station splits |
| `Race/DataPageStation/{id}` | One checkpoint's leaderboard |
| `Live/DataLive(All)/{id}` | Initial live snapshot: groups + participants |
| `Live/DataLiveUpdateAll/{raceId}` | Incremental position/status deltas (polled every 20s) |


## Install

```bash
npm install perfect-tracking-client
```

Requires **Node 18+** (uses the built-in global `fetch`). Ships as ESM with TypeScript types.

## Library API

### `new PerfectTracking(options?)`

| option | default | description |
| --- | --- | --- |
| `baseUrl` | `https://race.perfect-tracking.com/api/` | override the endpoint (e.g. for tests) |
| `fetch` | global `fetch` | inject a custom fetch implementation |

### Races & routes

```ts
await client.listRaces();                 // RaceSummary[]
await client.getRace("raa2026");           // Race (id, strecken, start/stop times)
await client.getStrecke(streckeId);        // StreckeDetail — one route's stations
await client.getStreckeAll(raceId);        // { routes: Strecke[] }
await client.getRoute(streckeId);          // RouteTrack — one route's GPS track
await client.getRouteAll(raceId);          // { routes: RouteTrackWithId[] }
await client.getPois(raceId);              // { pois: Poi[] }
```

### Live tracking

```ts
await client.getLiveInitAll(raceId);       // LiveInitSnapshot — groups + participants
await client.getLiveUpdate(raceId);        // LiveUpdateSnapshot — one poll (carries serverTime)

for await (const update of client.watchLive(raceId, { signal })) {
  // fires once immediately, then every 20s (like the web app) until aborted
}

client.isRaceLive(race);                   // same "is this race currently live" check the app uses
```

### Results & pages

```ts
await client.getResultsAll(raceId);        // ResultsSnapshot — raw ResultRow[] per group
await client.getParticipantPage(id);       // ParticipantPage — one participant's splits
await client.getStationPage(id);           // StationPage — one checkpoint's leaderboard
```

Several endpoints return fixed-position **row tuples** instead of objects (that's how the API renders them). Use the matching parser to get a clean, sanitized object:

```ts
import { parseResultRow, parseParticipantStationRow, parseStationResultRow } from "perfect-tracking-client";

const results = (await client.getResultsAll(raceId)).gruppen
  .flatMap((g) => g.data.map(parseResultRow));
// { status: "Race", statusColor: "race", name: "Sara Mazzorana", rank: 1, avgSpeedKmh: 22.74, ... }
```

`sanitizeBadge(html)` and `sanitizeText(html)` are exported too, if you need to clean up a raw fragment yourself.

### Data age

Every response is wrapped in `{ data, time }`, where `time` is the server's own
clock. The methods unwrap `data` for you, but the **polled** endpoints
(`getLiveInit`, `getLiveInitAll`, `getLiveUpdate`, `getPois`) also carry that
clock through as `serverTime` — so you can tell a stale feed from a slow
request, which the local receive time can't:

```ts
const update = await client.getLiveUpdate(raceId);
const ageSeconds = Date.now() / 1000 - update.serverTime!;
```

For the envelope of any other endpoint, use the generic escape hatch — it also
lets you call routes this client doesn't wrap yet:

```ts
const { data, time } = await client.request<Race>("Race/Race/raa2026");
```

### GPX export

Route tracks come with elevation, so they export straight to GPX — loadable in
any bike computer, Strava or Komoot. Timing stations become waypoints:

```ts
import { toGpx, stationWaypoints } from "perfect-tracking-client";

const [route, strecke] = await Promise.all([client.getRoute(id), client.getStrecke(id)]);
const gpx = toGpx(route.route, {
  name: "RAA Extreme",
  waypoints: stationWaypoints(strecke.stations, route.route),
  everyNth: 8, // thin a 76k-point track for devices that can't take it
});
```

## CLI

```bash
npx ptrack races
npx ptrack race raa2026
npx ptrack live raa2026 --json
npx ptrack live raa2026 --watch              # keep polling every 20s, like the web app
npx ptrack results raa2026 --strecke 71
npx ptrack pois raa2026
npx ptrack gpx raa2026 --strecke 71 --out raa-extreme.gpx
npx ptrack gpx raa2026 --strecke 71 --every 8 --out lite.gpx   # thinned for devices
```

## Dashboard

[`web/`](web/README.md) is a React dashboard built on this client — live map,
classification, results, route profiles and drill-downs into any participant or
checkpoint. Vite + Tailwind v4 + shadcn/ui + TanStack Query.

```bash
npm run build          # build the client first
cd web && npm install && npm run dev
```

## Notes & caveats

- **Unofficial.** This calls a public JSON API found by reading the app's own JS bundle; perfect-tracking can change routes/shapes at any time. No affiliation with perfect-tracking GmbH.
- **Polling, not push.** There's no WebSocket or SSE here — `watchLive` just replicates the app's own 20-second poll loop. Don't poll faster than that; you won't get fresher data, only more load on their servers.
- The singular endpoints (`Race/DataStrecke/{id}`, `Race/DataRoute/{id}`) and their `*All` counterparts return **different field shapes** for the same conceptual data (e.g. stations carry `altitude`/`link`/`way` only in the singular form) — this is a quirk of the upstream API, reflected as-is in the types (`StationDetail` vs. `Station`).
- Route tracks (`getRoute`/`getRouteAll`) can be several megabytes — tens of thousands of GPS points per route variant. Fetch once and cache; don't poll them.

## Development

```bash
npm install
npm run build      # tsc -> dist/
npm test           # builds, then node:test against saved fixtures
```

Tests run against fixtures in `test/fixtures/` (trimmed real responses) so they're deterministic and offline.

## License

MIT
