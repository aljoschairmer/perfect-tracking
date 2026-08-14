import { STATUS, type StatusCode } from "perfect-tracking-client";

import { config } from "./config.js";
import type { Course } from "./course.js";
import type { Sample } from "./store.js";

export interface RiderReport {
  id: number;
  name: string;
  bib?: string;
  km: number;
  restKm: number;
  restHm: number;
  elapsedH: number;
  avgKmh: number;
  /** Distance covered since the start of the report window. */
  windowKm: number;
  windowH: number;
  /** Plain speed over the window — robust, unlike the API's `speed` field. */
  windowKmh: number;
  /** Terrain-weighted pace over the window, comparable across profiles. */
  windowEffKmh: number;
  moving: boolean;
  /** How long the position has been unchanged, when stopped. */
  stoppedForMin?: number;
  status: number;
  statusLabel: string;
  /** Still in the race — a DNF that has not moved for days is not "stopped". */
  racing: boolean;
  rang: number;
  geo?: string;
  station?: string;
  nextStation?: { name: string; inKm: number };
  /** Finish projection from current form; no fatigue term, so read it as a floor. */
  etaElapsedH?: number;
  etaAt?: Date;
  organiserEta?: string;
}

export interface Analysis {
  serverTime: number;
  windowFrom: number;
  windowTo: number;
  samples: number;
  riders: RiderReport[];
  events: string[];
  /** True when the feed itself stopped advancing, rather than the riders. */
  feedStalled: boolean;
}

export interface PreviousState {
  order: number[];
  moving: Map<number, boolean>;
  station: Map<number, string | undefined>;
  status: Map<number, number>;
}

/**
 * Builds a report from the samples inside the window.
 *
 * Movement is decided on position alone. The API's `speed` field reports 0
 * both for "standing still" and for "no current fix" — verified live, riders
 * doing 18 km/h were reporting 0 — so it is only ever shown, never trusted.
 */
export function analyze(samples: Sample[], course: Course, windowMs: number, previous?: PreviousState): Analysis {
  const now = samples.at(-1);
  if (!now) throw new Error("no samples");

  const from = now.serverTime - windowMs / 1000;
  const window = samples.filter((s) => s.serverTime >= from);
  const first = window[0] ?? now;

  const riders: RiderReport[] = [];
  for (const [id, meta] of course.riders) {
    const last = now.riders[id];
    if (!last) continue;
    const start = window.find((s) => s.riders[id])?.riders[id] ?? last;

    const windowH = (now.serverTime - first.serverTime) / 3600;
    const windowKm = last.km - start.km;

    // Pace comes from its own, longer lookback: the report window may contain
    // nothing but a single climb.
    const paceFrom = now.serverTime - config.paceWindowMs / 1000;
    const paceStart = samples.find((s) => s.serverTime >= paceFrom && s.riders[id])?.riders[id] ?? start;
    const paceStartTime = samples.find((s) => s.serverTime >= paceFrom && s.riders[id])?.serverTime ?? first.serverTime;
    const paceH = (now.serverTime - paceStartTime) / 3600;
    const paceKm = last.km - paceStart.km;
    const effKm = course.effectiveKm(paceStart.point, last.point);

    // Trailing run of samples with an unchanged position.
    let still = 0;
    for (let i = samples.length - 1; i > 0; i--) {
      const a = samples[i - 1].riders[id];
      const b = samples[i].riders[id];
      if (!a || !b || a.point !== b.point) break;
      still++;
    }
    const moving = still < config.stoppedAfterSamples;
    const stoppedSince = still > 0 ? samples[samples.length - 1 - still]?.serverTime : undefined;

    const elapsedH = last.runtimeSec / 3600;
    const restKm = course.totalKm - last.km;
    const effPace = paceH > 0 && effKm > 0 ? effKm / paceH : 0;
    const remainingEff = course.remainingEffectiveKm(last.point);
    const statusLabel = STATUS[last.status as StatusCode]?.name ?? String(last.status);
    const racing = last.status === 1;

    // Extrapolating a 500 km remainder needs more than a couple of samples;
    // without enough observed riding the honest output is nothing at all.
    const enough = racing && paceH >= config.minProjectionH && paceKm >= config.minProjectionKm && effPace > 1;
    const etaElapsedH = enough ? elapsedH + remainingEff / effPace : undefined;
    const startedAt = now.serverTime - last.runtimeSec;

    const next = course.nextStation(last.km);
    riders.push({
      id,
      name: meta.name,
      bib: meta.bib,
      km: last.km,
      restKm,
      restHm: Math.round(course.ascentBetween(last.point, course.track.length - 1)),
      elapsedH,
      avgKmh: elapsedH > 0 ? last.km / elapsedH : 0,
      windowKm,
      windowH,
      windowKmh: windowH > 0 ? windowKm / windowH : 0,
      windowEffKmh: effPace,
      moving,
      stoppedForMin: moving || !stoppedSince ? undefined : (now.serverTime - stoppedSince) / 60,
      status: last.status,
      statusLabel,
      racing,
      rang: last.rang,
      geo: last.geo,
      station: course.stationAt(last.station)?.name,
      nextStation: next ? { name: next.name, inKm: Number(next.way.replace(",", ".")) - last.km } : undefined,
      etaElapsedH,
      etaAt: etaElapsedH ? new Date((startedAt + etaElapsedH * 3600) * 1000) : undefined,
      organiserEta: last.finishEst,
    });
  }

  riders.sort((a, b) => b.km - a.km);

  return {
    serverTime: now.serverTime,
    windowFrom: first.serverTime,
    windowTo: now.serverTime,
    samples: window.length,
    riders,
    events: diffEvents(riders, previous),
    // Every *racing* rider frozen at once is the feed, not the field — riders
    // who have abandoned never move and would otherwise trigger this forever.
    feedStalled:
      riders.filter((r) => r.racing).length > 2 && riders.filter((r) => r.racing).every((r) => !r.moving),
  };
}

/** What changed since the previous report — the part a periodic worker exists for. */
function diffEvents(riders: RiderReport[], previous?: PreviousState): string[] {
  if (!previous) return [];
  const events: string[] = [];

  for (const rider of riders) {
    const before = previous.station.get(rider.id);
    if (rider.station && before && rider.station !== before) {
      events.push(`${rider.name} hat ${rider.station} passiert`);
    }
    if (previous.status.get(rider.id) !== undefined && previous.status.get(rider.id) !== rider.status) {
      events.push(`${rider.name}: Status ${rider.statusLabel}`);
    }
    if (!rider.racing) continue;

    const wasMoving = previous.moving.get(rider.id);
    if (wasMoving === true && !rider.moving) {
      events.push(`${rider.name} steht (km ${rider.km.toFixed(1)}${rider.geo ? `, ${rider.geo}` : ""})`);
    } else if (wasMoving === false && rider.moving) {
      events.push(`${rider.name} fährt wieder`);
    }
  }

  // Position swaps among riders still in the race, reported once per pair.
  const order = riders.filter((r) => r.racing).map((r) => r.id);
  for (let i = 0; i < order.length; i++) {
    for (let j = i + 1; j < order.length; j++) {
      const a = order[i];
      const b = order[j];
      const wasA = previous.order.indexOf(a);
      const wasB = previous.order.indexOf(b);
      if (wasA >= 0 && wasB >= 0 && wasA > wasB) {
        const nameA = riders.find((r) => r.id === a)?.name;
        const nameB = riders.find((r) => r.id === b)?.name;
        events.push(`${nameA} hat ${nameB} überholt`);
      }
    }
  }

  return events;
}

export function stateOf(analysis: Analysis): PreviousState {
  return {
    order: analysis.riders.filter((r) => r.racing).map((r) => r.id),
    moving: new Map(analysis.riders.map((r) => [r.id, r.moving])),
    station: new Map(analysis.riders.map((r) => [r.id, r.station])),
    status: new Map(analysis.riders.map((r) => [r.id, r.status])),
  };
}
