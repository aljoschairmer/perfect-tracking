import type { RoutePoint, StationDetail } from "./types.js";
export interface GpxWaypoint {
    lat: number;
    lon: number;
    name: string;
    /** Elevation in metres. */
    ele?: number;
    description?: string;
}
export interface GpxOptions {
    /** Track name, e.g. the race and route-variant name. */
    name?: string;
    description?: string;
    /** Extra points of interest — timing stations, aid points, hazards. */
    waypoints?: GpxWaypoint[];
    /**
     * Keep only every nth track point. The source tracks carry tens of thousands
     * of points; some devices choke well below that. 1 (the default) keeps all.
     */
    everyNth?: number;
    /** Coordinate precision. Five decimals is ~1 m — more is noise. */
    precision?: number;
}
/**
 * Render a route track as GPX 1.1 — loadable in any bike computer, Strava,
 * Komoot or GIS tool.
 *
 * The API's track is `[lat, lon, km, elevation]`, so elevation comes along for
 * free and the result is a real elevation-aware route rather than a bare line.
 * No timestamps are written: these are course definitions, not ride recordings,
 * and a `<time>` would make devices treat them as such.
 */
export declare function toGpx(track: RoutePoint[], opts?: GpxOptions): string;
/** Turn timing stations into GPX waypoints, resolving each one's position on the track. */
export declare function stationWaypoints(stations: StationDetail[], track: RoutePoint[]): GpxWaypoint[];
//# sourceMappingURL=gpx.d.ts.map