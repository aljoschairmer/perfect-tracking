const ESCAPES = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
};
function escapeXml(value) {
    return value.replace(/[&<>"']/g, (char) => ESCAPES[char]);
}
/**
 * Render a route track as GPX 1.1 — loadable in any bike computer, Strava,
 * Komoot or GIS tool.
 *
 * The API's track is `[lat, lon, km, elevation]`, so elevation comes along for
 * free and the result is a real elevation-aware route rather than a bare line.
 * No timestamps are written: these are course definitions, not ride recordings,
 * and a `<time>` would make devices treat them as such.
 */
export function toGpx(track, opts = {}) {
    const { name = "Route", description, waypoints = [], everyNth = 1, precision = 5 } = opts;
    const step = Math.max(1, Math.floor(everyNth));
    const fix = (n) => n.toFixed(precision);
    const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<gpx version="1.1" creator="perfect-tracking-client" xmlns="http://www.topografix.com/GPX/1/1">',
        "  <metadata>",
        `    <name>${escapeXml(name)}</name>`,
    ];
    if (description)
        lines.push(`    <desc>${escapeXml(description)}</desc>`);
    lines.push("  </metadata>");
    for (const point of waypoints) {
        lines.push(`  <wpt lat="${fix(point.lat)}" lon="${fix(point.lon)}">`);
        if (point.ele != null)
            lines.push(`    <ele>${point.ele.toFixed(1)}</ele>`);
        lines.push(`    <name>${escapeXml(point.name)}</name>`);
        if (point.description)
            lines.push(`    <desc>${escapeXml(point.description)}</desc>`);
        lines.push("  </wpt>");
    }
    lines.push("  <trk>", `    <name>${escapeXml(name)}</name>`, "    <trkseg>");
    for (let i = 0; i < track.length; i += step) {
        const [lat, lon, , ele] = track[i];
        lines.push(`      <trkpt lat="${fix(lat)}" lon="${fix(lon)}"><ele>${ele.toFixed(1)}</ele></trkpt>`);
    }
    // Always close on the real finish, whatever the sampling step landed on.
    const last = track.at(-1);
    if (last && (track.length - 1) % step !== 0) {
        lines.push(`      <trkpt lat="${fix(last[0])}" lon="${fix(last[1])}"><ele>${last[3].toFixed(1)}</ele></trkpt>`);
    }
    lines.push("    </trkseg>", "  </trk>", "</gpx>", "");
    return lines.join("\n");
}
/** Turn timing stations into GPX waypoints, resolving each one's position on the track. */
export function stationWaypoints(stations, track) {
    return stations
        .map((station) => {
        const point = track[Math.min(station.point, track.length - 1)];
        if (!point)
            return null;
        return {
            lat: point[0],
            lon: point[1],
            ele: station.altitude,
            name: station.name,
            description: `km ${station.way} · ${station.altitude} m`,
        };
    })
        .filter((w) => w !== null);
}
//# sourceMappingURL=gpx.js.map