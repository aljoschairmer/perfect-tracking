import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import type { RoutePoint, StationDetail } from "perfect-tracking-client";

import { MAP_TOKENS, useThemeTokens } from "@/hooks/use-theme-tokens";
import type { Rider } from "@/lib/live";
import { cn } from "@/lib/utils";

import "leaflet/dist/leaflet.css";

const TILE_URL = import.meta.env.VITE_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  import.meta.env.VITE_TILE_ATTRIBUTION ??
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

interface TrackMapProps {
  track: RoutePoint[];
  riders: Rider[];
  stations?: StationDetail[];
  selectedId?: number;
  onSelect?: (riderId: number) => void;
  className?: string;
}

/**
 * Leaflet map with the route drawn from its GPS track and each rider placed at
 * the point index the API reports for them — positions are an index into the
 * pre-computed track, not raw coordinates, which is how the official map works.
 *
 * Leaflet is driven imperatively rather than through a React wrapper: the
 * rider layer is re-keyed every 20 seconds, and moving existing markers is far
 * cheaper than tearing down and rebuilding a hundred components.
 */
export function TrackMap({ track, riders, stations, selectedId, onSelect, className }: TrackMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map>(null);
  const routeLayerRef = useRef<L.Polyline>(null);
  const stationLayerRef = useRef<L.LayerGroup>(null);
  const riderLayerRef = useRef<L.LayerGroup>(null);
  const markersRef = useRef(new Map<number, L.CircleMarker>());

  const tokens = useThemeTokens(MAP_TOKENS);

  // Keep the latest click handler reachable without rebinding every marker.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // SVG renderer, not canvas: a few hundred markers are well within its
    // range, and tearing a canvas renderer down mid-frame races with Leaflet's
    // own redraw.
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      renderer: L.svg(),
    }).setView([47.6, 13.5], 7);

    L.tileLayer(TILE_URL, {
      maxZoom: 19,
      attribution: TILE_ATTRIBUTION,
      className: "pt-tiles",
    }).addTo(map);

    stationLayerRef.current = L.layerGroup().addTo(map);
    riderLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      // `map.remove()` destroys the canvas renderer these layers draw onto, so
      // every handle has to be dropped with it — touching one afterwards
      // reaches a released context.
      map.remove();
      mapRef.current = null;
      routeLayerRef.current = null;
      stationLayerRef.current = null;
      riderLayerRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  const latLngs = useMemo(() => track.map(([lat, lon]) => [lat, lon] as [number, number]), [track]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    routeLayerRef.current?.remove();
    if (latLngs.length === 0) {
      routeLayerRef.current = null;
      return;
    }

    const line = L.polyline(latLngs, {
      color: tokens["--foreground"] || "#333",
      weight: 3,
      opacity: 0.75,
      lineJoin: "round",
    }).addTo(map);

    routeLayerRef.current = line;
    map.fitBounds(line.getBounds(), { padding: [24, 24] });
  }, [latLngs, tokens]);

  useEffect(() => {
    const layer = stationLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    for (const station of stations ?? []) {
      const point = track[Math.min(station.point, track.length - 1)];
      if (!point) continue;
      L.circleMarker([point[0], point[1]], {
        radius: 3,
        color: tokens["--muted-foreground"] || "#888",
        fillColor: tokens["--background"] || "#fff",
        fillOpacity: 1,
        weight: 1.5,
      })
        .bindTooltip(`${station.name} · ${station.way} km`)
        .addTo(layer);
    }
  }, [stations, track, tokens]);

  useEffect(() => {
    const layer = riderLayerRef.current;
    if (!layer || track.length === 0) return;

    const markers = markersRef.current;
    const seen = new Set<number>();

    for (const rider of riders) {
      const index = rider.update?.point;
      if (index == null) continue;
      const point = track[Math.min(index, track.length - 1)];
      if (!point) continue;

      seen.add(rider.id);
      const inactive = rider.update?.status !== 1;
      const selected = rider.id === selectedId;
      const style: L.CircleMarkerOptions = {
        radius: selected ? 8 : 5,
        color: selected ? tokens["--primary"] : tokens["--background"],
        weight: selected ? 3 : 1.5,
        fillColor: inactive ? tokens["--muted-foreground"] : tokens[`--group-${rider.color % 10}`],
        fillOpacity: inactive ? 0.5 : 1,
      };

      const existing = markers.get(rider.id);
      if (existing) {
        existing.setLatLng([point[0], point[1]]);
        existing.setStyle(style);
        existing.setRadius(style.radius!);
      } else {
        const marker = L.circleMarker([point[0], point[1]], style)
          .on("click", () => onSelectRef.current?.(rider.id))
          .addTo(layer);
        markers.set(rider.id, marker);
      }
      markers
        .get(rider.id)!
        .bindTooltip(`${rider.name}${rider.update?.geo ? ` · ${rider.update.geo}` : ""}`);
    }

    // Riders can leave the set when the route variant changes.
    for (const [id, marker] of markers) {
      if (seen.has(id)) continue;
      marker.remove();
      markers.delete(id);
    }
  }, [riders, track, selectedId, tokens]);

  // Bring the selected rider into view when the selection comes from the board.
  useEffect(() => {
    if (selectedId == null) return;
    const marker = markersRef.current.get(selectedId);
    if (marker) mapRef.current?.panTo(marker.getLatLng());
  }, [selectedId]);

  return <div ref={containerRef} className={cn("h-full w-full", className)} role="application" aria-label="Streckenkarte" />;
}
