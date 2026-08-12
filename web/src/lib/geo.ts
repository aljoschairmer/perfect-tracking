import type { RoutePoint } from "perfect-tracking-client";

export interface Projection {
  path: string;
  width: number;
  height: number;
  project: (point: RoutePoint) => { x: number; y: number };
}

/**
 * Equirectangular projection scaled to a fixed drawing box. Good enough for a
 * single-country route and, unlike a real map projection, needs no tile layer
 * or map library — the track itself is the map.
 */
export function projectRoute(track: RoutePoint[], size = 1000, padding = 12): Projection | null {
  if (track.length === 0) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const [lat, lon] of track) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }

  // Longitude degrees shrink toward the poles; without this the track leans.
  const lonScale = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const spanX = Math.max((maxLon - minLon) * lonScale, 1e-6);
  const spanY = Math.max(maxLat - minLat, 1e-6);
  const scale = (size - padding * 2) / Math.max(spanX, spanY);

  const width = spanX * scale + padding * 2;
  const height = spanY * scale + padding * 2;

  const project = ([lat, lon]: RoutePoint) => ({
    x: padding + (lon - minLon) * lonScale * scale,
    // SVG y grows downward, latitude grows upward.
    y: padding + (maxLat - lat) * scale,
  });

  return { path: buildPath(track, project), width, height, project };
}

/**
 * Routes carry tens of thousands of points — far more than a few hundred
 * on-screen pixels can show. Sampling down keeps the path element small
 * without any visible loss, and always keeps the final point so the loop closes.
 */
function buildPath(track: RoutePoint[], project: (p: RoutePoint) => { x: number; y: number }, maxPoints = 1600): string {
  const step = Math.max(1, Math.ceil(track.length / maxPoints));
  const parts: string[] = [];
  for (let i = 0; i < track.length; i += step) {
    const { x, y } = project(track[i]);
    parts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  const last = project(track[track.length - 1]);
  parts.push(`L${last.x.toFixed(1)} ${last.y.toFixed(1)}`);
  return parts.join("");
}

/** Total route length in km — the distance channel of the final track point. */
export function routeLengthKm(track: RoutePoint[]): number {
  return track.at(-1)?.[2] ?? 0;
}

/**
 * Cumulative climb in metres, approximated from the track's elevation channel.
 *
 * Summing every rise counts GPS noise as climbing and roughly doubles the
 * result, so gains below `threshold` are ignored. 25 m was calibrated against
 * the two RAA routes whose official figures are published (2 200 km/30 000 m
 * and 560 km/6 500 m); it lands within a few percent of both. Treat the output
 * as an estimate — it will never exactly match a barometric altimeter.
 */
export function totalAscent(track: RoutePoint[], threshold = 25): number {
  let ascent = 0;
  let reference = track[0]?.[3] ?? 0;
  for (const point of track) {
    const elevation = point[3];
    if (elevation > reference + threshold) {
      ascent += elevation - reference;
      reference = elevation;
    } else if (elevation < reference) {
      reference = elevation;
    }
  }
  return Math.round(ascent);
}
