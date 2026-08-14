import type { PerfectTracking, Race, RoutePoint, StationDetail } from "perfect-tracking-client";

import { config } from "./config.js";

/**
 * The static half of the race: route track, timing stations, entrant list.
 * None of it changes mid-race, so it is fetched once — the track alone is
 * several megabytes.
 */
export class Course {
  private constructor(
    readonly race: Race,
    readonly streckeId: number,
    readonly track: RoutePoint[],
    readonly stations: StationDetail[],
    readonly riders: Map<number, { name: string; bib?: string; group: string; strecke: number }>,
    /** Cumulative smoothed ascent, so any range is one subtraction. */
    private readonly cumUp: Float64Array
  ) {}

  static async load(client: PerfectTracking): Promise<Course> {
    const race = await client.getRace(config.race);
    const variant = race.strecken.find((s) => s.name === config.strecke) ?? race.strecken[0];
    if (!variant) throw new Error(`Race "${config.race}" has no route variants`);

    const [route, strecke, live] = await Promise.all([
      client.getRoute(variant.id),
      client.getStrecke(variant.id),
      client.getLiveInitAll(race.id),
    ]);

    const groups = new Map(live.gruppen.map((g) => [g.id, g.name]));
    const riders = new Map(
      live.teilnehmer
        .filter((t) => t.strecke === variant.id)
        .filter((t) => !config.group || groups.get(t.gruppe) === config.group)
        .map((t) => [t.id, { name: t.name, bib: t.startnummer, group: groups.get(t.gruppe) ?? "—", strecke: t.strecke }])
    );

    return new Course(race, variant.id, route.route, strecke.stations, riders, ascentPrefix(route.route));
  }

  get totalKm(): number {
    return this.track.at(-1)?.[2] ?? 0;
  }

  kmAt(point: number): number {
    return this.track[Math.min(Math.max(point, 0), this.track.length - 1)][2];
  }

  /** Metres of climbing between two track indices. */
  ascentBetween(a: number, b: number): number {
    const lo = Math.min(Math.max(a, 0), this.track.length - 1);
    const hi = Math.min(Math.max(b, 0), this.track.length - 1);
    return Math.max(0, this.cumUp[hi] - this.cumUp[lo]);
  }

  /**
   * Distance weighted by how much climbing it contains, so a pace measured on
   * a descent is comparable with one measured on a col.
   */
  effectiveKm(fromPoint: number, toPoint: number): number {
    const km = this.kmAt(toPoint) - this.kmAt(fromPoint);
    return km + (config.climbEquivalentKm * this.ascentBetween(fromPoint, toPoint)) / 100;
  }

  /** Remaining effective distance from a point to the finish. */
  remainingEffectiveKm(point: number): number {
    return this.effectiveKm(point, this.track.length - 1);
  }

  stationAt(id: number | undefined): StationDetail | undefined {
    return id == null ? undefined : this.stations.find((s) => s.id === id);
  }

  /** The next timing station a rider has yet to reach. */
  nextStation(km: number): StationDetail | undefined {
    return this.stations.find((s) => Number(s.way.replace(",", ".")) > km + 0.05);
  }
}

/**
 * Cumulative ascent with an 8 m hysteresis: raw GPS noise would otherwise
 * roughly double the total. (The 25 m threshold that reproduces published
 * figures is for display; the model only needs a consistent scale.)
 */
function ascentPrefix(track: RoutePoint[], threshold = 8): Float64Array {
  const cum = new Float64Array(track.length);
  let total = 0;
  let reference = track[0]?.[3] ?? 0;
  for (let i = 0; i < track.length; i++) {
    const elevation = track[i][3];
    if (elevation > reference + threshold) {
      total += elevation - reference;
      reference = elevation;
    } else if (elevation < reference - threshold) {
      reference = elevation;
    }
    cum[i] = total;
  }
  return cum;
}
