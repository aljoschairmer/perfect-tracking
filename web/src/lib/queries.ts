import { queryOptions } from "@tanstack/react-query";
import { POLL_INTERVAL_MS } from "perfect-tracking-client";

import { client } from "@/lib/client";

/**
 * Every query lives here so cache keys stay consistent and the components never
 * touch the client directly. Each `queryFn` forwards TanStack Query's
 * AbortSignal into the package, so switching races cancels the in-flight
 * multi-megabyte route download instead of letting it land late.
 */
export const queries = {
  races: () =>
    queryOptions({
      queryKey: ["races"] as const,
      queryFn: ({ signal }) => client.listRaces(signal),
      staleTime: 5 * 60_000,
    }),

  race: (slug: string) =>
    queryOptions({
      queryKey: ["race", slug] as const,
      queryFn: ({ signal }) => client.getRace(slug, signal),
      staleTime: 5 * 60_000,
    }),

  streckeAll: (raceId: number) =>
    queryOptions({
      queryKey: ["strecke-all", raceId] as const,
      queryFn: ({ signal }) => client.getStreckeAll(raceId, signal),
      staleTime: 10 * 60_000,
    }),

  strecke: (streckeId: number) =>
    queryOptions({
      queryKey: ["strecke", streckeId] as const,
      queryFn: ({ signal }) => client.getStrecke(streckeId, signal),
      staleTime: 10 * 60_000,
    }),

  // Route tracks are megabytes of GPS points and never change mid-race.
  routes: (raceId: number) =>
    queryOptions({
      queryKey: ["routes", raceId] as const,
      queryFn: ({ signal }) => client.getRouteAll(raceId, signal),
      staleTime: Infinity,
      gcTime: 30 * 60_000,
    }),

  route: (streckeId: number) =>
    queryOptions({
      queryKey: ["route", streckeId] as const,
      queryFn: ({ signal }) => client.getRoute(streckeId, signal),
      staleTime: Infinity,
    }),

  pois: (raceId: number) =>
    queryOptions({
      queryKey: ["pois", raceId] as const,
      queryFn: ({ signal }) => client.getPois(raceId, signal),
      refetchInterval: POLL_INTERVAL_MS,
    }),

  results: (raceId: number, streckeId: number | "all") =>
    queryOptions({
      queryKey: ["results", raceId, streckeId] as const,
      queryFn: ({ signal }) =>
        streckeId === "all" ? client.getResultsAll(raceId, signal) : client.getResults(streckeId, signal),
      staleTime: 60_000,
    }),

  liveInit: (raceId: number) =>
    queryOptions({
      queryKey: ["live-init", raceId] as const,
      queryFn: ({ signal }) => client.getLiveInitAll(raceId, signal),
      staleTime: 10 * 60_000,
    }),

  /**
   * The live positions themselves. `refetchInterval` reproduces the official
   * site's 20-second cadence — the same loop the package's `watchLive`
   * generator runs outside React.
   */
  liveUpdate: (raceId: number, intervalMs: number | false = POLL_INTERVAL_MS) =>
    queryOptions({
      queryKey: ["live-update", raceId] as const,
      queryFn: ({ signal }) => client.getLiveUpdate(raceId, signal),
      refetchInterval: intervalMs,
      refetchIntervalInBackground: false,
    }),

  participant: (participantId: number) =>
    queryOptions({
      queryKey: ["participant", participantId] as const,
      queryFn: ({ signal }) => client.getParticipantPage(participantId, signal),
      staleTime: 30_000,
    }),

  station: (stationId: number) =>
    queryOptions({
      queryKey: ["station", stationId] as const,
      queryFn: ({ signal }) => client.getStationPage(stationId, signal),
      staleTime: 30_000,
    }),
};
