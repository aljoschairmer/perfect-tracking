import { parse as parseHtml } from "node-html-parser";
import type {
  ParsedResult,
  ParticipantStationRow,
  ResultRow,
  StationResultRow,
} from "./types.js";

/**
 * The API embeds status as a raw `<span class="badge race">Race</span>` HTML
 * fragment inside otherwise-clean JSON. We run it through a real HTML parser
 * (rather than a tag-stripping regex) so malformed/nested markup can't leak
 * into the sanitized text, and pull the badge's CSS modifier class (e.g.
 * "race", "finished") along with the plain-text label.
 */
export interface SanitizedBadge {
  /** Plain-text label with all markup and extra whitespace removed. */
  text: string;
  /** The badge's color/status modifier class, e.g. "race", "dnf", "finished". */
  colorClass: string | null;
}

export function sanitizeBadge(html: string): SanitizedBadge {
  const root = parseHtml(html);
  const span = root.querySelector("span.badge");
  const text = (span ?? root).textContent.replace(/\s+/g, " ").trim();
  const classes = span?.classList.value ?? [];
  const colorClass = classes.find((c) => c !== "badge") ?? null;
  return { text, colorClass };
}

/** Sanitize free-text fields (names, locations, ...) that may carry stray markup or whitespace. */
export function sanitizeText(html: string): string {
  return parseHtml(html).textContent.replace(/\s+/g, " ").trim();
}

function toNumber(s: string): number {
  return Number(s.replace(",", "."));
}

/** Turn a raw {@link ResultRow} tuple (as returned by `Ergebnisse/Data(All)`) into a clean, sanitized object. */
export function parseResultRow(row: ResultRow): ParsedResult {
  const [statusHtml, [name, link], startnummer, location, rank, runtime, pause, avgSpeed, timestamp] = row;
  const badge = sanitizeBadge(statusHtml);
  return {
    status: badge.text,
    statusColor: badge.colorClass,
    name: sanitizeText(name),
    link,
    startnummer,
    location: sanitizeText(location),
    rank,
    runtime,
    pause,
    avgSpeedKmh: toNumber(avgSpeed),
    timestamp,
  };
}

/** Clean object for one row of `Race/DataPageTeilnehmer/{id}` (a participant's own splits). */
export interface ParsedParticipantStation {
  index: number;
  station: string;
  stationLink: string;
  distanceKm: number;
  altitude: number;
  rank: number;
  runtime: string;
  pause: string;
  avgSpeedKmh: number;
  timestamp: string;
}

export function parseParticipantStationRow(row: ParticipantStationRow): ParsedParticipantStation {
  const [index, [station, stationLink], distanceKm, altitude, rank, runtime, pause, avgSpeed, timestamp] = row;
  return {
    index,
    station: sanitizeText(station),
    stationLink,
    distanceKm: toNumber(distanceKm),
    altitude,
    rank,
    runtime,
    pause,
    avgSpeedKmh: toNumber(avgSpeed),
    timestamp,
  };
}

/** Clean object for one row of `Race/DataPageStation/{id}` (a checkpoint's leaderboard). */
export interface ParsedStationResult {
  rank: number;
  status: string;
  statusColor: string | null;
  name: string;
  link: string;
  startnummer: string;
  runtime: string;
  pause: string;
  avgSpeedKmh: number;
  timestamp: string;
}

export function parseStationResultRow(row: StationResultRow): ParsedStationResult {
  const [rank, statusHtml, [name, link], startnummer, runtime, pause, avgSpeed, timestamp] = row;
  const badge = sanitizeBadge(statusHtml);
  return {
    rank,
    status: badge.text,
    statusColor: badge.colorClass,
    name: sanitizeText(name),
    link,
    startnummer,
    runtime,
    pause,
    avgSpeedKmh: toNumber(avgSpeed),
    timestamp,
  };
}
