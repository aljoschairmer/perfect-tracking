import type { ParsedResult, ParticipantStationRow, ResultRow, StationResultRow } from "./types.js";
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
export declare function sanitizeBadge(html: string): SanitizedBadge;
/** Sanitize free-text fields (names, locations, ...) that may carry stray markup or whitespace. */
export declare function sanitizeText(html: string): string;
/** Turn a raw {@link ResultRow} tuple (as returned by `Ergebnisse/Data(All)`) into a clean, sanitized object. */
export declare function parseResultRow(row: ResultRow): ParsedResult;
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
export declare function parseParticipantStationRow(row: ParticipantStationRow): ParsedParticipantStation;
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
export declare function parseStationResultRow(row: StationResultRow): ParsedStationResult;
//# sourceMappingURL=parse.d.ts.map