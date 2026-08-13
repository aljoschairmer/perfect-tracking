import { useEffect, useMemo, useRef, useState } from "react";
import type { RoutePoint, StationDetail } from "perfect-tracking-client";

import { stationKm } from "@/lib/live";
import { cn } from "@/lib/utils";

const W = 1000;
const H = 240;
const ML = 42;
const MR = 12;
const MT = 26;
const MB = 24;

export interface ElevationMarker {
  id: number;
  km: number;
  color: number;
  /** Short label drawn above the dot (start number, falls back to nothing). */
  nr?: string;
  label?: string;
  selected?: boolean;
}

interface ElevationProfileProps {
  track: RoutePoint[];
  markers?: ElevationMarker[];
  stations?: StationDetail[];
  onSelectMarker?: (id: number) => void;
  className?: string;
}

/**
 * Elevation against distance, straight from the route track's third and
 * fourth channels — with axes, the timing stations pinned onto the curve, and
 * each rider sitting at their own distance.
 *
 * Everything lives in one SVG with a fixed viewBox (no `preserveAspectRatio:
 * none`), so labels keep their shape at any container width. Zooming changes
 * the drawn km range rather than the viewBox: the elevation scale stays fixed
 * across the whole race, which keeps a climb looking equally steep at any
 * zoom level. Mausrad zoomt entlang der Strecke, Ziehen verschiebt,
 * Doppelklick setzt zurück.
 */
export function ElevationProfile({ track, markers = [], stations, onSelectMarker, className }: ElevationProfileProps) {
  const [view, setView] = useState<{ km0: number; km1: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalKm = track.at(-1)?.[2] ?? 0;

  // The interaction handlers below live outside React's render cycle and read
  // the current state through refs, so they can be attached exactly once.
  const viewRef = useRef(view);
  viewRef.current = view;
  const totalRef = useRef(totalKm);
  totalRef.current = totalKm;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const current = () => viewRef.current ?? { km0: 0, km1: totalRef.current };

    const clamp = (km0: number, km1: number) => {
      const total = totalRef.current;
      const minSpan = Math.max(1, total * 0.02);
      let span = Math.min(total, Math.max(minSpan, km1 - km0));
      const start = Math.min(total - span, Math.max(0, km0));
      if (span >= total - 0.01) return null;
      return { km0: start, km1: start + span };
    };

    /** Fraction 0..1 inside the plot area for a screen x position. */
    const fracAt = (clientX: number) => {
      const rect = el.getBoundingClientRect();
      const px = ((clientX - rect.left) / rect.width) * W;
      return Math.min(1, Math.max(0, (px - ML) / (W - ML - MR)));
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const v = current();
      const f = fracAt(event.clientX);
      const anchor = v.km0 + f * (v.km1 - v.km0);
      // Trackpad-Pinch meldet sich als ctrl+wheel mit sehr kleinem Delta.
      const span = (v.km1 - v.km0) * Math.exp(event.deltaY * (event.ctrlKey ? 0.01 : 0.0018));
      setView(clamp(anchor - f * span, anchor + (1 - f) * span));
    };

    let drag: { x: number; km0: number; km1: number } | null = null;

    const onPointerDown = (event: PointerEvent) => {
      if (!viewRef.current) return; // nothing to pan at full extent
      drag = { x: event.clientX, ...viewRef.current };
      el.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!drag) return;
      const rect = el.getBoundingClientRect();
      const dKm = (((event.clientX - drag.x) / rect.width) * W * (drag.km1 - drag.km0)) / (W - ML - MR);
      setView(clamp(drag.km0 - dKm, drag.km1 - dKm));
    };
    const onPointerUp = () => {
      drag = null;
    };
    const onDoubleClick = () => setView(null);

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("dblclick", onDoubleClick);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("dblclick", onDoubleClick);
    };
  }, []);

  const model = useMemo(() => {
    if (track.length < 2 || totalKm <= 0) return null;

    // The elevation scale spans the whole race, not the visible slice — a
    // climb must look equally steep zoomed in or out.
    let minEl = Infinity;
    let maxEl = -Infinity;
    for (const [, , , elevation] of track) {
      if (elevation < minEl) minEl = elevation;
      if (elevation > maxEl) maxEl = elevation;
    }
    const elSpan = Math.max(maxEl - minEl, 1);

    const km0 = view?.km0 ?? 0;
    const km1 = view?.km1 ?? totalKm;
    const span = km1 - km0;

    const x = (km: number) => ML + ((km - km0) / span) * (W - ML - MR);
    const y = (elevation: number) => MT + (1 - (elevation - minEl) / elSpan) * (H - MT - MB);

    // Only sample the visible slice, plus one point either side so the line
    // doesn't visibly stop short of the plot edge.
    let i0 = indexAtKm(track, km0);
    let i1 = indexAtKm(track, km1);
    i0 = Math.max(0, i0 - 1);
    i1 = Math.min(track.length - 1, i1 + 1);
    const step = Math.max(1, Math.ceil((i1 - i0) / 900));
    const points: string[] = [];
    for (let i = i0; i <= i1; i += step) {
      points.push(`${x(track[i][2]).toFixed(1)} ${y(track[i][3]).toFixed(1)}`);
    }
    const last = `${x(track[i1][2]).toFixed(1)} ${y(track[i1][3]).toFixed(1)}`;
    const line = `M${points.join("L")}L${last}`;
    const area = `${line}L${x(track[i1][2]).toFixed(1)} ${H - MB}L${x(track[i0][2]).toFixed(1)} ${H - MB}Z`;

    return { km0, km1, span, minEl, maxEl, x, y, line, area };
  }, [track, totalKm, view]);

  const staggered = useMemo(() => {
    if (!model) return [];
    const inRange = markers
      .filter((marker) => marker.km > 0 && marker.km >= model.km0 && marker.km <= model.km1)
      .sort((a, b) => a.km - b.km);
    // Dots crowd together on flat sections; cycling the label height keeps
    // neighbouring start numbers from writing over each other.
    let lastX = -Infinity;
    let level = 0;
    return inRange.map((marker) => {
      const cx = model.x(marker.km);
      level = cx - lastX < 26 ? level + 1 : 0;
      lastX = cx;
      return { ...marker, cx, cy: model.y(elevationAtKm(track, marker.km)), labelY: -9 - (level % 3) * 11 };
    });
  }, [markers, model, track]);

  if (!model) return null;

  const elStep = niceStep(model.maxEl - model.minEl, [50, 100, 200, 250, 500, 1000], 5);
  const kmStep = niceStep(model.span, [1, 2, 5, 10, 20, 25, 50, 100, 250, 500], 9);

  const stationMarks: { km: number; name: string; y: number }[] = [];
  {
    // Label only when there's room; the ticks themselves always draw.
    let lastLabelX = -Infinity;
    for (const station of stations ?? []) {
      const km = stationKm(station);
      if (station.rank < 1 || km < model.km0 || km > model.km1) continue;
      const sx = model.x(km);
      stationMarks.push({ km, name: sx - lastLabelX > 52 ? station.name : "", y: model.y(station.altitude) });
      if (sx - lastLabelX > 52) lastLabelX = sx;
    }
  }

  return (
    <div ref={containerRef} className={cn("relative touch-pan-y select-none", view && "cursor-grab", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Höhenprofil der Strecke mit Stationen und Teilnehmerpositionen">
        <clipPath id="profile-clip">
          <rect x={ML} y={0} width={W - ML - MR} height={H} />
        </clipPath>

        {gridValues(model.minEl, model.maxEl, elStep).map((elevation) => (
          <g key={elevation}>
            <line x1={ML} x2={W - MR} y1={model.y(elevation)} y2={model.y(elevation)} stroke="var(--border)" />
            <text x={ML - 5} y={model.y(elevation) + 3} textAnchor="end" fontSize={10} fill="var(--muted-foreground)">
              {elevation}
            </text>
          </g>
        ))}
        <text x={ML - 5} y={MT - 10} textAnchor="end" fontSize={10} fill="var(--muted-foreground)">
          m
        </text>

        <g clipPath="url(#profile-clip)">
          {gridValues(model.km0, model.km1, kmStep).map((km) => (
            <g key={km}>
              <line x1={model.x(km)} x2={model.x(km)} y1={MT} y2={H - MB} stroke="var(--border)" />
              <text x={model.x(km)} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--muted-foreground)">
                {km}
              </text>
            </g>
          ))}

          <path d={model.area} fill="var(--muted)" />
          <path d={model.line} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.2} />

          {stationMarks.map((mark) => (
            <g key={mark.km}>
              <line
                x1={model.x(mark.km)}
                x2={model.x(mark.km)}
                y1={mark.y}
                y2={mark.y - 7}
                stroke="var(--muted-foreground)"
              />
              {mark.name && (
                <text
                  x={model.x(mark.km)}
                  y={mark.y - 10}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--muted-foreground)"
                >
                  {mark.name}
                </text>
              )}
            </g>
          ))}

          {staggered.map((marker) => (
            <g
              key={marker.id}
              transform={`translate(${marker.cx.toFixed(1)} ${marker.cy.toFixed(1)})`}
              onClick={() => onSelectMarker?.(marker.id)}
              className={onSelectMarker ? "cursor-pointer" : undefined}
            >
              <title>{marker.label ?? marker.nr}</title>
              <circle
                r={marker.selected ? 7 : 5}
                fill={`var(--group-${marker.color % 10})`}
                stroke={marker.selected ? "var(--primary)" : "var(--background)"}
                strokeWidth={marker.selected ? 2.5 : 1.5}
              />
              {marker.nr && (
                <text y={marker.labelY} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--foreground)">
                  {marker.nr}
                </text>
              )}
            </g>
          ))}
        </g>

        <text x={W - MR} y={H - 8} textAnchor="end" fontSize={10} fill="var(--muted-foreground)">
          km
        </text>
      </svg>

      {view && (
        <button
          type="button"
          onClick={() => setView(null)}
          className="absolute right-2 top-1 rounded-sm border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Zoom zurücksetzen
        </button>
      )}
    </div>
  );
}

/** Index of the first track point at or beyond `km` — the km channel is monotonic. */
function indexAtKm(track: RoutePoint[], km: number): number {
  let low = 0;
  let high = track.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (track[mid][2] < km) low = mid + 1;
    else high = mid;
  }
  return low;
}

/** Elevation at a distance, by binary search. */
function elevationAtKm(track: RoutePoint[], km: number): number {
  return track[indexAtKm(track, km)]?.[3] ?? 0;
}

/** Smallest step from `steps` that yields at most `maxLines` divisions. */
function niceStep(span: number, steps: number[], maxLines: number): number {
  for (const step of steps) {
    if (span / step <= maxLines) return step;
  }
  return steps[steps.length - 1];
}

/** Grid values inside (min, max) aligned to `step`. */
function gridValues(min: number, max: number, step: number): number[] {
  const values: number[] = [];
  for (let value = Math.ceil(min / step) * step; value <= max; value += step) {
    if (value > min) values.push(value);
  }
  return values;
}
