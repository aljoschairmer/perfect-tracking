import { badgeClasses, htmlToText } from "./html.js";
export function sanitizeBadge(html) {
    const colorClass = badgeClasses(html).find((c) => c !== "badge") ?? null;
    return { text: sanitizeText(html), colorClass };
}
/** Sanitize free-text fields (names, locations, ...) that may carry stray markup or whitespace. */
export function sanitizeText(html) {
    return htmlToText(html).replace(/\s+/g, " ").trim();
}
function toNumber(s) {
    return Number(s.replace(",", "."));
}
/** Turn a raw {@link ResultRow} tuple (as returned by `Ergebnisse/Data(All)`) into a clean, sanitized object. */
export function parseResultRow(row) {
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
export function parseParticipantStationRow(row) {
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
export function parseStationResultRow(row) {
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
//# sourceMappingURL=parse.js.map