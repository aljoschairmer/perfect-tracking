import type { StatusCode } from "./constants.js";
/** Envelope every `/api/*` endpoint responds with; `data` is unwrapped by the client. */
export interface ApiEnvelope<T> {
    data: T;
    /** Server unix timestamp (seconds) the response was generated at. */
    time?: number;
}
/**
 * Carried by the polled snapshots, so consumers can show the true age of the
 * data rather than the time their own request happened to come back.
 */
export interface ServerStamped {
    /**
     * Server clock (unix seconds) when the response was generated, taken from the
     * envelope's `time`. Undefined if the endpoint omitted it.
     */
    serverTime?: number;
}
/** One row from `Race/Races` — the public race list. */
export interface RaceSummary {
    id: number;
    sname: string;
    name: string;
    icon: string;
    logo: string;
    info: string;
    link: string;
    open: boolean;
    starttime: string;
    stoptime: string;
    ustarttime: number;
    ustoptime: number;
}
/** A "Strecke" — one route/distance variant of a race (e.g. RAA Extreme vs. RAA 1500). */
export interface StreckeSummary {
    id: number;
    name: string;
    info: string;
    rang: number;
    bindroute: boolean;
}
/** `Race/Race/{sname}` — full race record. */
export interface Race {
    id: number;
    sname: string;
    name: string;
    title: string;
    info: string;
    infolong: string;
    logo: string;
    icon: string;
    map: number;
    test: boolean;
    geotiming: boolean;
    gesamt: unknown;
    ustarttime: number;
    ustoptime: number;
    strecken: StreckeSummary[];
}
/** A checkpoint/station as listed inside `Race/DataStreckeAll/{raceId}`'s `routes`. */
export interface Station {
    id: number;
    name: string;
    /** Index into the matching route's track point array. */
    point: number;
    rank: number;
    type: number;
}
/** One entry of `Race/DataStreckeAll/{raceId}`'s `routes` array. */
export interface Strecke {
    id: number;
    stationen: Station[];
}
/**
 * A checkpoint/station from `Race/DataStrecke/{streckeId}` — the single-route
 * endpoint returns richer per-station fields than {@link Station}.
 */
export interface StationDetail {
    id: number;
    name: string;
    link: string;
    point: number;
    rank: number;
    type: number;
    altitude: number;
    /** Distance from the start, as a German-formatted km string (e.g. `"22,22"`). */
    way: string;
    show: boolean;
}
/** `Race/DataStrecke/{streckeId}` — full station list for a single route variant. */
export interface StreckeDetail {
    stations: StationDetail[];
}
/** `[lat, lon, distanceKm, elevationM]` — one point along a route's track. */
export type RoutePoint = [lat: number, lon: number, km: number, elevation: number];
/** `Race/DataRoute/{streckeId}` — a single route's raw GPS track. */
export interface RouteTrack {
    route: RoutePoint[];
}
/** One entry of `Race/DataRouteAll/{raceId}`'s `routes` array. */
export interface RouteTrackWithId {
    id: number;
    data: RoutePoint[];
}
/** A point of interest shown on the live map (aid station, viewpoint, hazard, ...). */
export interface Poi {
    id: number;
    strecke: number;
    point: number;
    img: string;
    color: number;
    infoshort: string;
    infolong: string;
}
/** One entry in `gruppen` — a category/group participants are bucketed into. */
export interface LiveGroup {
    id: number;
    name: string;
    color: number;
    strecke: number;
}
/** One entry in `teilnehmer` — static participant/team info from the live init snapshot. */
export interface LiveParticipant {
    id: number;
    name: string;
    link: string;
    color: number;
    gruppe: number;
    strecke: number;
    startnummer?: string;
}
/** One entry in `update` — a positional/status delta, polled every {@link POLL_INTERVAL_MS}. */
export interface LiveUpdateEntry {
    id: number;
    /** Index into the route's point array (see {@link RoutePoint}) when `bindroute` is true. */
    point: number;
    /** WKT-ish coordinate string when `bindroute` is false, otherwise `0`. */
    position: string | number;
    speed: number;
    /** Reverse-geocoded location label. */
    geo?: string;
    rang: number;
    runtime: string;
    runtimesec: number;
    status: StatusCode;
    station?: number;
    stationtime?: string;
    finishest?: string;
    finishestn?: number;
    finishesttol?: string;
}
export interface LiveInitSnapshot extends ServerStamped {
    bindroute: boolean;
    extra: unknown[];
    gruppen: LiveGroup[];
    teilnehmer: LiveParticipant[];
    /** Some race payloads also embed an initial `update` batch alongside `teilnehmer`. */
    update?: LiveUpdateEntry[];
}
export interface LiveUpdateSnapshot extends ServerStamped {
    bindroute: boolean;
    extra: unknown[];
    update: LiveUpdateEntry[];
}
/** `Race/DataPois/{raceId}` — polled alongside the live map. */
export interface PoiSnapshot extends ServerStamped {
    pois: Poi[];
}
/**
 * A results-table row as the API renders it: fixed-position fields mixed with
 * an HTML status badge and a `[name, profileLink]` tuple. Use {@link parseResultRow}
 * to get a clean object.
 */
export type ResultRow = [
    statusBadgeHtml: string,
    participant: [name: string, link: string],
    startnummer: string,
    location: string,
    rank: number,
    runtime: string,
    pause: string,
    avgSpeedKmh: string,
    timestamp: string
];
export interface ResultGroup {
    id: number;
    name: string;
    data: ResultRow[];
}
export interface ResultsSnapshot {
    gruppen: ResultGroup[];
}
/** A parsed, clean version of {@link ResultRow}. */
export interface ParsedResult {
    status: string;
    statusColor: string | null;
    name: string;
    link: string;
    startnummer: string;
    location: string;
    rank: number;
    runtime: string;
    pause: string;
    avgSpeedKmh: number;
    timestamp: string;
}
/**
 * A row from a participant's own station-by-station page: no status badge,
 * a `[name, link]` pair for the *station*, plus distance/altitude/rank/etc.
 * Use {@link parseParticipantStationRow} to get a clean object.
 */
export type ParticipantStationRow = [
    index: number,
    station: [name: string, link: string],
    distanceKm: string,
    altitude: number,
    rank: number,
    runtime: string,
    pause: string,
    avgSpeedKmh: string,
    timestamp: string
];
export interface ParticipantPage {
    name: string;
    gruppe: string;
    startnummer: string;
    infoort: string;
    stationen: ParticipantStationRow[];
}
/**
 * A row from a station's leaderboard page: rank, status badge, `[name, link]`
 * for the *participant*, then the same trailing fields as {@link ResultRow}.
 * Use {@link parseStationResultRow} to get a clean object.
 */
export type StationResultRow = [
    rank: number,
    statusBadgeHtml: string,
    participant: [name: string, link: string],
    startnummer: string,
    runtime: string,
    pause: string,
    avgSpeedKmh: string,
    timestamp: string
];
export interface StationResultGroup {
    id: number;
    name: string;
    data: StationResultRow[];
}
export interface StationPage {
    altitude: number;
    gruppen: StationResultGroup[];
}
//# sourceMappingURL=types.d.ts.map