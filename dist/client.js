import { BASE_URL, POLL_INTERVAL_MS } from "./constants.js";
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
export class PerfectTracking {
    baseUrl;
    fetchImpl;
    constructor(opts = {}) {
        this.baseUrl = opts.baseUrl ?? BASE_URL;
        if (!opts.fetch && !globalThis.fetch) {
            throw new Error("No fetch implementation available. Use Node >=18 or pass opts.fetch.");
        }
        // Browsers reject `fetch` invoked with any receiver other than the global
        // object, and storing it on `this` would do exactly that.
        this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
    }
    async get(path, signal) {
        const url = `${this.baseUrl}${path}`;
        const res = await this.fetchImpl(url, { signal });
        if (!res.ok) {
            throw new Error(`perfect-tracking request failed: HTTP ${res.status} for ${url}`);
        }
        const body = (await res.json());
        return body.data;
    }
    /** All public races (`Race/Races`). */
    listRaces(signal) {
        return this.get("Race/Races", signal);
    }
    /** One race by its URL slug, e.g. `"raa2026"` (`Race/Race/{sname}`). */
    getRace(sname, signal) {
        return this.get(`Race/Race/${encodeURIComponent(sname)}`, signal);
    }
    /** Stations for one route variant (`Race/DataStrecke/{streckeId}`). */
    getStrecke(streckeId, signal) {
        return this.get(`Race/DataStrecke/${streckeId}`, signal);
    }
    /** Stations for every route variant of a race (`Race/DataStreckeAll/{raceId}`). */
    getStreckeAll(raceId, signal) {
        return this.get(`Race/DataStreckeAll/${raceId}`, signal);
    }
    /**
     * The raw GPS track for one route variant (`Race/DataRoute/{streckeId}`).
     * Large — routes can carry tens of thousands of {@link RoutePoint}s.
     */
    getRoute(streckeId, signal) {
        return this.get(`Race/DataRoute/${streckeId}`, signal);
    }
    /** The raw GPS track for every route variant of a race (`Race/DataRouteAll/{raceId}`). */
    getRouteAll(raceId, signal) {
        return this.get(`Race/DataRouteAll/${raceId}`, signal);
    }
    /** Points of interest for the live map (`Race/DataPois/{raceId}`). The app polls this every 20s. */
    getPois(raceId, signal) {
        return this.get(`Race/DataPois/${raceId}`, signal);
    }
    /** Results for one route variant (`Ergebnisse/Data/{streckeId}`). Rows need {@link parseResultRow}. */
    getResults(streckeId, signal) {
        return this.get(`Ergebnisse/Data/${streckeId}`, signal);
    }
    /** Results for every route variant of a race (`Ergebnisse/DataAll/{raceId}`). */
    getResultsAll(raceId, signal) {
        return this.get(`Ergebnisse/DataAll/${raceId}`, signal);
    }
    /** A participant/team's own page: splits at every station (`Race/DataPageTeilnehmer/{id}`). */
    getParticipantPage(participantId, signal) {
        return this.get(`Race/DataPageTeilnehmer/${participantId}`, signal);
    }
    /** A station/checkpoint's own page: leaderboard of who has passed it (`Race/DataPageStation/{id}`). */
    getStationPage(stationId, signal) {
        return this.get(`Race/DataPageStation/${stationId}`, signal);
    }
    /** Initial live snapshot for one route variant (`Live/DataLive/{streckeId}`). */
    getLiveInit(streckeId, signal) {
        return this.get(`Live/DataLive/${streckeId}`, signal);
    }
    /** Initial live snapshot for the whole race (`Live/DataLiveAll/{raceId}`). Call this once, then {@link watchLive}. */
    getLiveInitAll(raceId, signal) {
        return this.get(`Live/DataLiveAll/${raceId}`, signal);
    }
    /** One incremental live-position poll (`Live/DataLiveUpdateAll/{raceId}`). Prefer {@link watchLive} for continuous tracking. */
    getLiveUpdate(raceId, signal) {
        return this.get(`Live/DataLiveUpdateAll/${raceId}`, signal);
    }
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
    async *watchLive(raceId, opts = {}) {
        const intervalMs = opts.intervalMs ?? POLL_INTERVAL_MS;
        while (!opts.signal?.aborted) {
            yield await this.getLiveUpdate(raceId, opts.signal);
            if (opts.signal?.aborted)
                return;
            await sleep(intervalMs, opts.signal);
        }
    }
    /** Whether a race counts as "live" right now — mirrors the app's own check. */
    isRaceLive(race, now = new Date()) {
        if (race.test)
            return true;
        return race.ustoptime >= now.getTime() / 1000;
    }
}
function sleep(ms, signal) {
    return new Promise((resolve) => {
        const t = setTimeout(resolve, ms);
        signal?.addEventListener("abort", () => {
            clearTimeout(t);
            resolve();
        }, { once: true });
    });
}
//# sourceMappingURL=client.js.map