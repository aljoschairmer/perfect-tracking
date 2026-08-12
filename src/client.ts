import { BASE_URL, POLL_INTERVAL_MS } from "./constants.js";
import type {
  ApiEnvelope,
  LiveInitSnapshot,
  LiveUpdateSnapshot,
  Poi,
  Race,
  RaceSummary,
  ResultsSnapshot,
  RouteTrack,
  RouteTrackWithId,
  StationPage,
  Strecke,
  StreckeDetail,
  ParticipantPage,
} from "./types.js";

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
export class PerfectTracking {
  private baseUrl: string;
  private fetchImpl: typeof fetch;

  constructor(opts: PerfectTrackingOptions = {}) {
    this.baseUrl = opts.baseUrl ?? BASE_URL;
    if (!opts.fetch && !globalThis.fetch) {
      throw new Error("No fetch implementation available. Use Node >=18 or pass opts.fetch.");
    }
    // Browsers reject `fetch` invoked with any receiver other than the global
    // object, and storing it on `this` would do exactly that.
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
  }

  private async get<T>(path: string, signal?: AbortSignal): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await this.fetchImpl(url, { signal });
    if (!res.ok) {
      throw new Error(`perfect-tracking request failed: HTTP ${res.status} for ${url}`);
    }
    const body = (await res.json()) as ApiEnvelope<T>;
    return body.data;
  }

  /** All public races (`Race/Races`). */
  listRaces(signal?: AbortSignal): Promise<RaceSummary[]> {
    return this.get<RaceSummary[]>("Race/Races", signal);
  }

  /** One race by its URL slug, e.g. `"raa2026"` (`Race/Race/{sname}`). */
  getRace(sname: string, signal?: AbortSignal): Promise<Race> {
    return this.get<Race>(`Race/Race/${encodeURIComponent(sname)}`, signal);
  }

  /** Stations for one route variant (`Race/DataStrecke/{streckeId}`). */
  getStrecke(streckeId: number, signal?: AbortSignal): Promise<StreckeDetail> {
    return this.get<StreckeDetail>(`Race/DataStrecke/${streckeId}`, signal);
  }

  /** Stations for every route variant of a race (`Race/DataStreckeAll/{raceId}`). */
  getStreckeAll(raceId: number, signal?: AbortSignal): Promise<{ routes: Strecke[] }> {
    return this.get(`Race/DataStreckeAll/${raceId}`, signal);
  }

  /**
   * The raw GPS track for one route variant (`Race/DataRoute/{streckeId}`).
   * Large — routes can carry tens of thousands of {@link RoutePoint}s.
   */
  getRoute(streckeId: number, signal?: AbortSignal): Promise<RouteTrack> {
    return this.get<RouteTrack>(`Race/DataRoute/${streckeId}`, signal);
  }

  /** The raw GPS track for every route variant of a race (`Race/DataRouteAll/{raceId}`). */
  getRouteAll(raceId: number, signal?: AbortSignal): Promise<{ routes: RouteTrackWithId[] }> {
    return this.get(`Race/DataRouteAll/${raceId}`, signal);
  }

  /** Points of interest for the live map (`Race/DataPois/{raceId}`). The app polls this every 20s. */
  getPois(raceId: number, signal?: AbortSignal): Promise<{ pois: Poi[] }> {
    return this.get(`Race/DataPois/${raceId}`, signal);
  }

  /** Results for one route variant (`Ergebnisse/Data/{streckeId}`). Rows need {@link parseResultRow}. */
  getResults(streckeId: number, signal?: AbortSignal): Promise<ResultsSnapshot> {
    return this.get<ResultsSnapshot>(`Ergebnisse/Data/${streckeId}`, signal);
  }

  /** Results for every route variant of a race (`Ergebnisse/DataAll/{raceId}`). */
  getResultsAll(raceId: number, signal?: AbortSignal): Promise<ResultsSnapshot> {
    return this.get<ResultsSnapshot>(`Ergebnisse/DataAll/${raceId}`, signal);
  }

  /** A participant/team's own page: splits at every station (`Race/DataPageTeilnehmer/{id}`). */
  getParticipantPage(participantId: number, signal?: AbortSignal): Promise<ParticipantPage> {
    return this.get<ParticipantPage>(`Race/DataPageTeilnehmer/${participantId}`, signal);
  }

  /** A station/checkpoint's own page: leaderboard of who has passed it (`Race/DataPageStation/{id}`). */
  getStationPage(stationId: number, signal?: AbortSignal): Promise<StationPage> {
    return this.get<StationPage>(`Race/DataPageStation/${stationId}`, signal);
  }

  /** Initial live snapshot for one route variant (`Live/DataLive/{streckeId}`). */
  getLiveInit(streckeId: number, signal?: AbortSignal): Promise<LiveInitSnapshot> {
    return this.get<LiveInitSnapshot>(`Live/DataLive/${streckeId}`, signal);
  }

  /** Initial live snapshot for the whole race (`Live/DataLiveAll/{raceId}`). Call this once, then {@link watchLive}. */
  getLiveInitAll(raceId: number, signal?: AbortSignal): Promise<LiveInitSnapshot> {
    return this.get<LiveInitSnapshot>(`Live/DataLiveAll/${raceId}`, signal);
  }

  /** One incremental live-position poll (`Live/DataLiveUpdateAll/{raceId}`). Prefer {@link watchLive} for continuous tracking. */
  getLiveUpdate(raceId: number, signal?: AbortSignal): Promise<LiveUpdateSnapshot> {
    return this.get<LiveUpdateSnapshot>(`Live/DataLiveUpdateAll/${raceId}`, signal);
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
  async *watchLive(raceId: number, opts: WatchLiveOptions = {}): AsyncGenerator<LiveUpdateSnapshot> {
    const intervalMs = opts.intervalMs ?? POLL_INTERVAL_MS;
    while (!opts.signal?.aborted) {
      yield await this.getLiveUpdate(raceId, opts.signal);
      if (opts.signal?.aborted) return;
      await sleep(intervalMs, opts.signal);
    }
  }

  /** Whether a race counts as "live" right now — mirrors the app's own check. */
  isRaceLive(race: Pick<Race, "test" | "ustoptime">, now: Date = new Date()): boolean {
    if (race.test) return true;
    return race.ustoptime >= now.getTime() / 1000;
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true }
    );
  });
}
