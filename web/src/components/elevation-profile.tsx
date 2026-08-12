import { useMemo } from "react";
import type { RoutePoint } from "perfect-tracking-client";

import { cn } from "@/lib/utils";

const WIDTH = 1000;
const HEIGHT = 140;

export interface ElevationMarker {
  id: number;
  km: number;
  color: number;
  label?: string;
  selected?: boolean;
}

/**
 * Elevation against distance, straight from the route track's third and fourth
 * channels, with each rider sitting on the curve at their own distance.
 *
 * The profile path is drawn with `preserveAspectRatio="none"` so it always
 * fills the width — which also means anything drawn inside the SVG gets
 * stretched with it. The rider dots are therefore overlaid as positioned
 * elements instead, keeping them round at any container size.
 */
export function ElevationProfile({
  track,
  markers = [],
  className,
}: {
  track: RoutePoint[];
  markers?: ElevationMarker[];
  className?: string;
}) {
  const model = useMemo(() => {
    if (track.length < 2) return null;

    let minEl = Infinity;
    let maxEl = -Infinity;
    for (const [, , , elevation] of track) {
      if (elevation < minEl) minEl = elevation;
      if (elevation > maxEl) maxEl = elevation;
    }
    const totalKm = track.at(-1)?.[2] ?? 0;
    if (totalKm <= 0) return null;

    const span = Math.max(maxEl - minEl, 1);
    const y = (elevation: number) => HEIGHT - ((elevation - minEl) / span) * (HEIGHT - 8) - 4;

    const step = Math.max(1, Math.ceil(track.length / 900));
    const points: string[] = [];
    for (let i = 0; i < track.length; i += step) {
      points.push(`${((track[i][2] / totalKm) * WIDTH).toFixed(1)} ${y(track[i][3]).toFixed(1)}`);
    }

    return {
      line: `M${points.join("L")}`,
      area: `M0 ${HEIGHT}L${points.join("L")}L${WIDTH} ${HEIGHT}Z`,
      totalKm,
      minEl: Math.round(minEl),
      maxEl: Math.round(maxEl),
      y,
    };
  }, [track]);

  const placed = useMemo(() => {
    if (!model) return [];
    return markers
      .filter((marker) => marker.km > 0)
      .map((marker) => ({
        ...marker,
        left: (marker.km / model.totalKm) * 100,
        top: (model.y(elevationAtKm(track, marker.km)) / HEIGHT) * 100,
      }));
  }, [markers, model, track]);

  if (!model) return null;

  return (
    <div className={cn("space-y-1", className)}>
      <div className="relative h-28 w-full">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="h-full w-full"
          role="img"
          aria-label="Höhenprofil der Strecke"
        >
          <path d={model.area} fill="var(--muted)" />
          <path
            d={model.line}
            fill="none"
            stroke="var(--muted-foreground)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {placed.map((marker) => (
          <span
            key={marker.id}
            title={marker.label}
            className={cn(
              "absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-background",
              marker.selected && "size-3 ring-2"
            )}
            style={{
              left: `${marker.left}%`,
              top: `${marker.top}%`,
              backgroundColor: `var(--group-${marker.color % 10})`,
              outline: marker.selected ? "2px solid var(--primary)" : undefined,
            }}
          />
        ))}
      </div>

      <div className="flex justify-between label-xs">
        <span>0 km</span>
        <span>
          {model.minEl}–{model.maxEl} m
        </span>
        <span>{Math.round(model.totalKm)} km</span>
      </div>
    </div>
  );
}

/** Elevation at a distance, by binary search — the track's km channel is monotonic. */
function elevationAtKm(track: RoutePoint[], km: number): number {
  let low = 0;
  let high = track.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (track[mid][2] < km) low = mid + 1;
    else high = mid;
  }
  return track[low]?.[3] ?? 0;
}
