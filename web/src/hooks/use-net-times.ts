import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { parseStationResultRow, type StationDetail } from "perfect-tracking-client";

import { inRanking, type Rider } from "@/lib/live";
import { queries } from "@/lib/queries";
import { runtimeToSec } from "@/lib/time";

/**
 * Which timing station the net-time comparison anchors to.
 * "auto"   — the furthest station any shown rider has reached (the leader's);
 * "common" — the last station *every* shown rider has passed, so nobody shows "–";
 * a number — a fixed station id from the dropdown.
 */
export type NetStationChoice = "auto" | "common" | number;

export interface NetTime {
  sec: number;
  runtime: string;
  timestamp: string;
}

export interface NetComparison {
  /** The resolved comparison station, if one is reachable at all. */
  station: StationDetail | undefined;
  /** Stations at least one shown rider has passed — the sensible dropdown options. */
  available: StationDetail[];
  /** Net time per rider id at the comparison station. */
  byId: Map<number, NetTime>;
  isPending: boolean;
}

/**
 * Net time ("Fahrzeit ab eigenem Start") per rider at one timing station.
 *
 * With staggered starts, clock-time positions flatter whoever set off first;
 * the net time at a common checkpoint is the one fair head-to-head the data
 * offers. The station page delivers everyone's net time there in a single
 * request, so this costs one fetch — not one per rider.
 */
export function useNetTimes(riders: Rider[], stations: StationDetail[] | undefined, choice: NetStationChoice): NetComparison {
  const { station, available } = useMemo(() => {
    const timing = (stations ?? []).filter((s) => s.rank >= 1);
    const rankById = new Map(timing.map((s) => [s.id, s.rank]));
    const reached = riders
      .filter(inRanking)
      .map((rider) => (rider.update?.station != null ? rankById.get(rider.update.station) : undefined))
      .filter((rank): rank is number => rank != null);

    if (reached.length === 0) return { station: undefined, available: [] };
    const maxRank = Math.max(...reached);
    const availableStations = timing.filter((s) => s.rank <= maxRank);

    let targetRank: number;
    if (choice === "auto") targetRank = maxRank;
    else if (choice === "common") targetRank = Math.min(...reached);
    else targetRank = rankById.get(choice) ?? maxRank; // stale saved id after a course change → auto

    return {
      station: availableStations.find((s) => s.rank === targetRank),
      available: availableStations,
    };
  }, [riders, stations, choice]);

  const page = useQuery({ ...queries.station(station?.id ?? 0), enabled: station != null });

  const byId = useMemo(() => {
    const times = new Map<number, NetTime>();
    if (!page.data) return times;
    const shown = new Set(riders.map((rider) => rider.id));
    for (const group of page.data.gruppen) {
      for (const row of group.data.map(parseStationResultRow)) {
        const id = Number(row.link.split("/").pop());
        const sec = runtimeToSec(row.runtime);
        // The page also lists riders who haven't passed yet, with rank "-"
        // and a zero time — a zero net time at a real checkpoint is impossible.
        if (sec == null || sec <= 0 || !shown.has(id)) continue;
        times.set(id, { sec, runtime: row.runtime, timestamp: row.timestamp });
      }
    }
    return times;
  }, [page.data, riders]);

  return { station, available, byId, isPending: station != null && page.isPending };
}
