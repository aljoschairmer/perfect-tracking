import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { LiveUpdateEntry } from "perfect-tracking-client";

import { queries } from "@/lib/queries";
import { mergeRiders, type Rider } from "@/lib/live";

/**
 * Joins the one-off entrant snapshot with the polled position deltas.
 * The two halves are separate queries on purpose: the snapshot is static for
 * the whole race, the deltas refetch every 20 seconds.
 */
export function useLiveRace(raceId: number | undefined, live: boolean) {
  const init = useQuery({ ...queries.liveInit(raceId!), enabled: raceId != null });
  const update = useQuery({
    ...queries.liveUpdate(raceId!, live ? undefined : false),
    enabled: raceId != null,
  });

  const riders = useMemo<Rider[]>(() => {
    if (!init.data) return [];
    const entries = new Map<number, LiveUpdateEntry>();
    // The snapshot may embed an opening batch; the poll then supersedes it.
    for (const entry of init.data.update ?? []) entries.set(entry.id, entry);
    for (const entry of update.data?.update ?? []) entries.set(entry.id, entry);
    // Ordering is left to the board, which owns the group filter that decides
    // whether ranks are comparable.
    return mergeRiders(init.data.teilnehmer, init.data.gruppen, entries);
  }, [init.data, update.data]);

  // Prefer the server's own clock over our receive time: it distinguishes a
  // slow request from a feed that has actually stopped moving.
  const serverTime = update.data?.serverTime;

  return {
    riders,
    groups: init.data?.gruppen ?? [],
    bindRoute: update.data?.bindroute ?? init.data?.bindroute ?? true,
    updatedAt: serverTime
      ? new Date(serverTime * 1000)
      : update.dataUpdatedAt
        ? new Date(update.dataUpdatedAt)
        : undefined,
    /** True when the timestamp came from the API rather than our own clock. */
    updatedAtIsServerTime: serverTime != null,
    isFetching: update.isFetching,
    loading: init.isPending,
    error: (init.error ?? update.error) as Error | null,
  };
}
