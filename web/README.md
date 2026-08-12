# perfect tracking — live dashboard

React dashboard built on [`perfect-tracking-client`](../README.md). It uses the
full client surface: race list and detail, live positions, results, route
tracks, stations, points of interest, and the participant/station drill-downs.

```bash
npm install
npm run dev      # http://localhost:5173
```

The workspace links the client from the repository root (`file:..`), so build
the package first (`npm run build` in the root) after changing it.

## Stack

- **Vite + React 19 + TypeScript**
- **Tailwind CSS v4** with the design tokens in `src/index.css`
- **shadcn/ui** primitives, kept in `src/components/ui/` as source
- **TanStack Query** for fetching, caching and the live poll

## How the data flows

`src/lib/queries.ts` is the only place that talks to the client. Every query
forwards TanStack Query's `AbortSignal` into the package, so switching races
cancels the in-flight multi-megabyte route download instead of letting it land
late.

Live tracking is two queries, mirroring how the API splits the data: a static
entrant snapshot (`getLiveInitAll`) fetched once, and the positional deltas
(`getLiveUpdate`) on a 20-second `refetchInterval` — the same cadence the
official site uses, taken from the package's `POLL_INTERVAL_MS`.
`useLiveRace` joins the two so a poll that omits a rider leaves their last
known position standing instead of blanking the row.

### The map

Leaflet with OpenStreetMap raster tiles, the same combination the official
site uses. Dark mode reuses that one tile source through a CSS filter rather
than pulling in a second provider.

Live updates don't carry coordinates — they carry a `point` index into the
route's pre-computed GPS track, which is how the official site places riders.
`TrackMap` draws the track as a polyline and puts each rider at their index.
Leaflet is driven imperatively so a 20-second poll moves existing markers
instead of rebuilding a hundred components.

Set `VITE_TILE_URL` (and optionally `VITE_TILE_ATTRIBUTION`) to use a
different tile provider, or to point at a proxy on networks that can't reach
`tile.openstreetmap.org` directly.

## CORS

The tracking API sends no CORS headers. `vite.config.ts` proxies `/api`
upstream in dev, which keeps the client's `baseUrl` a plain relative `/api/`;
any static host can do the same with a rewrite rule.

## Notes

- German UI copy, matching the source data.
- Elevation gain is an estimate — see the note on `totalAscent` in `src/lib/geo.ts`.
- `rang` from the API is only meaningful *within* a start group, so a mixed
  field is ordered by distance covered instead. `compareRiders` handles both.
