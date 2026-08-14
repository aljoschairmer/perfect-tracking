import type { ApiEnvelope, LiveInitSnapshot, LiveUpdateSnapshot, PoiSnapshot, Race, RaceSummary, ResultsSnapshot, RouteTrack, RouteTrackWithId, StationPage, Strecke, StreckeDetail, ParticipantPage } from "./types.js";
export interface PerfectTrackingOptions {
    /** Override the API base URL (e.g. for testing). Defaults to {@link BASE_URL}. */
    baseUrl?: string;
    /** Custom fetch implementation (defaults to global fetch). */
    fetch?: typeof fetch;
}
export interface WatchLiveOptions {
    /** Milliseconds between polls. Defaults to {@link POLL_INTERVAL_MS} (20s, same as the web app). */
    intervalMs?: number;
    /** Stop watching when this signal aborts. */
    signal?: AbortSignal;
}
/**
 * Client for the perfect-tracking.com live race tracking API.
 *
 * Unofficial — reverse-engineered from the public Angular frontend, which
 * itself just polls this same JSON API (see README.md). All endpoints are
 * plain `GET /api/{Controller}/{Action}/{id}` requests returning `{ data, time }`.
 *
 * @example
 * const client = new PerfectTracking();
 * const race = await client.getRace("raa2026");
 * const live = await client.getLiveInitAll(race.id);
 */
export declare class PerfectTracking {
    private baseUrl;
    private fetchImpl;
    constructor(opts?: PerfectTrackingOptions);
    /**
     * Raw request against any endpoint, returning the full `{ data, time }`
     * envelope. The typed methods below unwrap it for you; reach for this when
     * you need the server clock from an endpoint that doesn't already carry it,
     * or to call a route this client doesn't wrap yet.
     */
    request<T>(path: string, signal?: AbortSignal): Promise<ApiEnvelope<T>>;
    private get;
    /**
     * Like {@link get}, but folds the envelope's server clock into the payload as
     * `serverTime`. Used for the polled endpoints, where how old the data is
     * matters as much as the data — the local receive time can't tell you whether
     * a position is fresh or the server itself is lagging.
     */
    private getStamped;
    /** All public races (`Race/Races`). */
    listRaces(signal?: AbortSignal): Promise<RaceSummary[]>;
    /** One race by its URL slug, e.g. `"raa2026"` (`Race/Race/{sname}`). */
    getRace(sname: string, signal?: AbortSignal): Promise<Race>;
    /** Stations for one route variant (`Race/DataStrecke/{streckeId}`). */
    getStrecke(streckeId: number, signal?: AbortSignal): Promise<StreckeDetail>;
    /** Stations for every route variant of a race (`Race/DataStreckeAll/{raceId}`). */
    getStreckeAll(raceId: number, signal?: AbortSignal): Promise<{
        routes: Strecke[];
    }>;
    /**
     * The raw GPS track for one route variant (`Race/DataRoute/{streckeId}`).
     * Large — routes can carry tens of thousands of {@link RoutePoint}s.
     */
    getRoute(streckeId: number, signal?: AbortSignal): Promise<RouteTrack>;
    /** The raw GPS track for every route variant of a race (`Race/DataRouteAll/{raceId}`). */
    getRouteAll(raceId: number, signal?: AbortSignal): Promise<{
        routes: RouteTrackWithId[];
    }>;
    /** Points of interest for the live map (`Race/DataPois/{raceId}`). The app polls this every 20s. */
    getPois(raceId: number, signal?: AbortSignal): Promise<PoiSnapshot>;
    /** Results for one route variant (`Ergebnisse/Data/{streckeId}`). Rows need {@link parseResultRow}. */
    getResults(streckeId: number, signal?: AbortSignal): Promise<ResultsSnapshot>;
    /** Results for every route variant of a race (`Ergebnisse/DataAll/{raceId}`). */
    getResultsAll(raceId: number, signal?: AbortSignal): Promise<ResultsSnapshot>;
    /** A participant/team's own page: splits at every station (`Race/DataPageTeilnehmer/{id}`). */
    getParticipantPage(participantId: number, signal?: AbortSignal): Promise<ParticipantPage>;
    /** A station/checkpoint's own page: leaderboard of who has passed it (`Race/DataPageStation/{id}`). */
    getStationPage(stationId: number, signal?: AbortSignal): Promise<StationPage>;
    /** Initial live snapshot for one route variant (`Live/DataLive/{streckeId}`). */
    getLiveInit(streckeId: number, signal?: AbortSignal): Promise<LiveInitSnapshot>;
    /** Initial live snapshot for the whole race (`Live/DataLiveAll/{raceId}`). Call this once, then {@link watchLive}. */
    getLiveInitAll(raceId: number, signal?: AbortSignal): Promise<LiveInitSnapshot>;
    /**
     * One incremental live-position poll (`Live/DataLiveUpdateAll/{raceId}`).
     * The result carries `serverTime`, so you can tell a stale feed from a slow
     * request. Prefer {@link watchLive} for continuous tracking.
     */
    getLiveUpdate(raceId: number, signal?: AbortSignal): Promise<LiveUpdateSnapshot>;
    /**
     * Continuously poll live positions, mirroring how the web app itself refreshes
     * the map: fetch, wait {@link WatchLiveOptions.intervalMs} (default 20s), repeat —
     * so a slow response never overlaps the next poll.
     *
     * @example
     * for await (const update of client.watchLive(raceId, { signal: controller.signal })) {
     *   for (const p of update.update) console.log(p.id, p.speed, p.rang);
     * }
     */
    watchLive(raceId: number, opts?: WatchLiveOptions): AsyncGenerator<LiveUpdateSnapshot>;
    /** Whether a race counts as "live" right now — mirrors the app's own check. */
    isRaceLive(race: Pick<Race, "test" | "ustoptime">, now?: Date): boolean;
}
//# sourceMappingURL=client.d.ts.map