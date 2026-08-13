import type { LiveGroup, LiveParticipant, LiveUpdateEntry, StationDetail } from "perfect-tracking-client";

/** A participant merged with their most recent live update. */
export interface Rider {
  id: number;
  name: string;
  link: string;
  startnummer?: string;
  color: number;
  groupId: number;
  groupName: string;
  strecke: number;
  update?: LiveUpdateEntry;
}

/**
 * The API deliberately splits static entrant data (fetched once) from the
 * positional deltas (polled). Joining them here keeps that split invisible to
 * the UI, and means a poll that omits a rider leaves their last known position
 * standing instead of blanking the row.
 */
export function mergeRiders(
  participants: LiveParticipant[],
  groups: LiveGroup[],
  updates: Map<number, LiveUpdateEntry>
): Rider[] {
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  return participants.map((p) => ({
    id: p.id,
    name: p.name,
    link: p.link,
    startnummer: p.startnummer,
    color: p.color,
    groupId: p.gruppe,
    groupName: groupName.get(p.gruppe) ?? "—",
    strecke: p.strecke,
    update: updates.get(p.id),
  }));
}

/**
 * Bucket order for the board: finishers hold the podium, then the racing
 * field, then the out-of-time/DNF/DSQ/DNS tail. Without this, a finisher and
 * a DNF both count as "not racing" and end up shuffled together at the bottom.
 */
export function statusOrder(status: number | undefined): number {
  switch (status) {
    case 2:
      return 0; // Finished
    case 1:
      return 1; // Race
    case 5: // IOFCL
    case 6:
      return 2; // OTL
    case 3:
      return 3; // DNF
    case 8:
      return 4; // DSQ
    case 4:
      return 5; // DNS
    default:
      return 6; // Pre Race / no update yet
  }
}

/** Whether a rider takes part in the running placement count. */
export function inRanking(rider: Rider): boolean {
  return statusOrder(rider.update?.status) <= 1;
}

/**
 * How the racing field is ordered within its bucket. `rang` from the API is
 * only meaningful inside one start group, so none of these lean on it:
 * distance, pace and net time are the measures that stay comparable across a
 * mixed field with staggered starts.
 */
export type SortMode = "strecke" | "tempo" | "ziel" | "netto";

export const SORT_LABELS: Record<SortMode, string> = {
  strecke: "Strecke",
  tempo: "Ø Tempo",
  ziel: "Zielzeit",
  netto: "Netto @ Station",
};

export interface SortContext {
  progress: (rider: Rider) => number | undefined;
  /** Net time in seconds at the comparison station (mode "netto"). */
  netSec?: (rider: Rider) => number | undefined;
  /** Comparable key for the organiser's ETA (mode "ziel"). */
  zielKey?: (rider: Rider) => number | undefined;
}

/**
 * Finishers always sort by their final time — that's the actual result and no
 * display mode should reorder it. Everyone else sorts by the chosen mode, with
 * course progress as the tie-break so unranked riders still line up sensibly.
 */
export function compareRiders(a: Rider, b: Rider, mode: SortMode, ctx: SortContext): number {
  const orderA = statusOrder(a.update?.status);
  const orderB = statusOrder(b.update?.status);
  if (orderA !== orderB) return orderA - orderB;
  if (orderA === 0) {
    const byTime = (a.update?.runtimesec ?? Infinity) - (b.update?.runtimesec ?? Infinity);
    if (byTime) return byTime;
  } else {
    let byMode = 0;
    if (mode === "tempo") {
      byMode = (avgSpeedKmh(b, ctx.progress) ?? -1) - (avgSpeedKmh(a, ctx.progress) ?? -1);
    } else if (mode === "ziel") {
      byMode = (ctx.zielKey?.(a) ?? Infinity) - (ctx.zielKey?.(b) ?? Infinity);
    } else if (mode === "netto") {
      byMode = (ctx.netSec?.(a) ?? Infinity) - (ctx.netSec?.(b) ?? Infinity);
    }
    // Infinity - Infinity is NaN, which is falsy — exactly the fall-through we want.
    if (byMode) return byMode;
  }
  const byProgress = (ctx.progress(b) ?? -1) - (ctx.progress(a) ?? -1);
  return byProgress || a.name.localeCompare(b.name);
}

/** Distance covered, derived from the rider's index into their route's track. */
export function riderDistanceKm(rider: Rider, track: [number, number, number, number][] | undefined): number | undefined {
  const point = rider.update?.point;
  if (point == null || !track) return undefined;
  return track[Math.min(point, track.length - 1)]?.[2];
}

/**
 * Average over the whole race so far. Unlike the momentary `speed` field this
 * is start-time independent, which makes it the one pace figure that stays
 * comparable across staggered starts.
 */
export function avgSpeedKmh(rider: Rider, progress: (rider: Rider) => number | undefined): number | undefined {
  const km = progress(rider);
  const sec = rider.update?.runtimesec;
  if (km == null || !sec) return undefined;
  return km / (sec / 3_600);
}

/** The `way` field is a German-formatted kilometre string ("74,68"). */
export function stationKm(station: StationDetail): number {
  return Number(station.way.replace(",", "."));
}

/** Next timing station ahead of a rider, with the distance still to cover. */
export function nextStation(
  km: number | undefined,
  stations: StationDetail[] | undefined
): { station: StationDetail; restKm: number } | undefined {
  if (km == null || !stations) return undefined;
  for (const station of stations) {
    const way = stationKm(station);
    if (way > km + 0.05) return { station, restKm: way - km };
  }
  return undefined;
}

/** The station a rider last passed, resolved from the live update's station id. */
export function lastStation(rider: Rider, stations: StationDetail[] | undefined): StationDetail | undefined {
  const id = rider.update?.station;
  if (id == null) return undefined;
  return stations?.find((station) => station.id === id);
}
