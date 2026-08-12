import { parse as parseHtml } from "node-html-parser";
export function sanitizeBadge(html) {
    const root = parseHtml(html);
    const span = root.querySelector("span.badge");
    const text = (span ?? root).textContent.replace(/\s+/g, " ").trim();
    const classes = span?.classList.value ?? [];
    const colorClass = classes.find((c) => c !== "badge") ?? null;
    return { text, colorClass };
}
/** Sanitize free-text fields (names, locations, ...) that may carry stray markup or whitespace. */
export function sanitizeText(html) {
    return parseHtml(html).textContent.replace(/\s+/g, " ").trim();
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