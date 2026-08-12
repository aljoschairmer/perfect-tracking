import type { LiveGroup, LiveParticipant, LiveUpdateEntry } from "perfect-tracking-client";

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
 * Riders still racing always sort above those who aren't.
 *
 * `rang` is only meaningful *within* a start group, so it can't order a mixed
 * field — a board showing several groups would otherwise open with a row of
 * ties for first. Progress along the course is the one comparable measure
 * across groups, so that decides the mixed case and rank decides within one.
 */
export function compareRiders(
  a: Rider,
  b: Rider,
  by: "rank" | "progress",
  progress: (rider: Rider) => number | undefined = () => undefined
): number {
  const activeA = a.update?.status === 1;
  const activeB = b.update?.status === 1;
  if (activeA !== activeB) return activeA ? -1 : 1;

  if (by === "rank") {
    const ra = a.update?.rang ?? Number.MAX_SAFE_INTEGER;
    const rb = b.update?.rang ?? Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
  } else {
    const pa = progress(a) ?? -1;
    const pb = progress(b) ?? -1;
    if (pa !== pb) return pb - pa;
  }
  return a.name.localeCompare(b.name);
}

/** Distance covered, derived from the rider's index into their route's track. */
export function riderDistanceKm(rider: Rider, track: [number, number, number, number][] | undefined): number | undefined {
  const point = rider.update?.point;
  if (point == null || !track) return undefined;
  return track[Math.min(point, track.length - 1)]?.[2];
}
