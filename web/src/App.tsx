import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { sanitizeText } from "perfect-tracking-client";

import { AppHeader } from "@/components/app-header";
import { ElevationProfile } from "@/components/elevation-profile";
import { LiveBoard } from "@/components/live-board";
import { ParticipantSheet } from "@/components/participant-sheet";
import { PoiPanel } from "@/components/poi-panel";
import { ResultsPanel } from "@/components/results-panel";
import { RoutePanel } from "@/components/route-panel";
import { StationSheet } from "@/components/station-sheet";
import { TrackMap } from "@/components/track-map";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLiveRace } from "@/hooks/use-live-race";
import { client } from "@/lib/client";
import { queries } from "@/lib/queries";
import { riderDistanceKm } from "@/lib/live";

export default function App() {
  const [slug, setSlug] = useState<string>();
  const [streckeId, setStreckeId] = useState<number>();
  const [participantId, setParticipantId] = useState<number>();
  const [station, setStation] = useState<{ id: number; name?: string }>();

  const races = useQuery(queries.races());
  const race = useQuery({ ...queries.race(slug!), enabled: slug != null });

  // Land on the newest race, which is the one people actually came to watch.
  useEffect(() => {
    if (!slug && races.data?.length) setSlug(races.data[0].sname);
  }, [races.data, slug]);

  // Each race brings its own route variants, so the previous selection is void.
  useEffect(() => {
    setStreckeId(race.data?.strecken[0]?.id);
  }, [race.data]);

  const isLive = race.data ? client.isRaceLive(race.data) : false;
  const live = useLiveRace(race.data?.id, isLive);

  const raceId = race.data?.id;
  const routes = useQuery({ ...queries.routes(raceId ?? 0), enabled: raceId != null });
  const strecke = useQuery({ ...queries.strecke(streckeId ?? 0), enabled: streckeId != null });

  const track = useMemo(
    () => routes.data?.routes.find((r) => r.id === streckeId)?.data ?? [],
    [routes.data, streckeId]
  );

  // The route variant chosen above scopes the whole live view, so the map and
  // the board always describe the same field.
  const ridersOnTrack = useMemo(
    () => live.riders.filter((rider) => rider.strecke === streckeId),
    [live.riders, streckeId]
  );
  const groupsOnTrack = useMemo(
    () => live.groups.filter((group) => group.strecke === streckeId),
    [live.groups, streckeId]
  );

  const distanceFor = useMemo(() => {
    const byStrecke = new Map(routes.data?.routes.map((r) => [r.id, r.data]) ?? []);
    return (rider: Parameters<typeof riderDistanceKm>[0]) => riderDistanceKm(rider, byStrecke.get(rider.strecke));
  }, [routes.data]);

  const elevationMarkers = useMemo(
    () =>
      ridersOnTrack
        .filter((rider) => rider.update?.status === 1)
        .map((rider) => ({
          id: rider.id,
          km: distanceFor(rider) ?? 0,
          color: rider.color,
          label: `${rider.name} · ${(distanceFor(rider) ?? 0).toFixed(0)} km`,
          selected: rider.id === participantId,
        })),
    [ridersOnTrack, distanceFor, participantId]
  );

  return (
    <div className="flex h-dvh flex-col">
      <AppHeader
        races={races.data ?? []}
        slug={slug}
        onSlugChange={setSlug}
        live={isLive}
        updatedAt={live.updatedAt}
        isFetching={live.isFetching}
      />

      {race.error && <p className="p-4 text-sm text-destructive">{race.error.message}</p>}

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-border px-4 py-3">
          {race.data ? (
            <>
              <h1 className="text-lg font-semibold leading-tight tracking-tight">{race.data.title}</h1>
              <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">{sanitizeText(race.data.info)}</p>
            </>
          ) : (
            <Skeleton className="h-10 w-80" />
          )}
        </div>

        {race.data && (
          <div className="flex flex-wrap gap-1 border-b border-border px-4 py-2">
            {race.data.strecken.map((variant) => (
              <button
                key={variant.id}
                type="button"
                onClick={() => setStreckeId(variant.id)}
                aria-pressed={variant.id === streckeId}
                className={
                  variant.id === streckeId
                    ? "rounded-sm border border-foreground/25 bg-accent px-2.5 py-1 text-xs font-medium"
                    : "rounded-sm border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                }
              >
                {variant.name}
              </button>
            ))}
          </div>
        )}

        <Tabs defaultValue="live" className="px-4 py-3">
          <TabsList>
            <TabsTrigger value="live">Live</TabsTrigger>
            <TabsTrigger value="ergebnisse">Ergebnisse</TabsTrigger>
            <TabsTrigger value="strecke">Strecke</TabsTrigger>
            <TabsTrigger value="punkte">Streckenpunkte</TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="pt-3">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_30rem]">
              <div className="space-y-3">
                <Card className="overflow-hidden">
                  <CardHeader>
                    <CardTitle>Streckenverlauf</CardTitle>
                    <span className="tabular text-xs text-muted-foreground">
                      {ridersOnTrack.filter((r) => r.update?.status === 1).length} unterwegs
                    </span>
                  </CardHeader>
                  <CardContent className="p-0">
                    {routes.isPending ? (
                      <Skeleton className="h-[26rem] w-full rounded-none" />
                    ) : (
                      <div className="h-[26rem] p-3">
                        <TrackMap
                          track={track}
                          riders={ridersOnTrack}
                          stations={strecke.data?.stations}
                          selectedId={participantId}
                          onSelect={setParticipantId}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Höhenprofil</CardTitle>
                    <span className="label-xs">Position der aktiven Teilnehmer</span>
                  </CardHeader>
                  <CardContent>
                    {routes.isPending ? (
                      <Skeleton className="h-28 w-full" />
                    ) : (
                      <ElevationProfile track={track} markers={elevationMarkers} />
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="flex max-h-[42rem] flex-col overflow-hidden">
                <CardHeader>
                  <CardTitle>Klassement</CardTitle>
                  {live.loading && <span className="label-xs">lädt…</span>}
                </CardHeader>
                <div className="min-h-0 flex-1">
                  <LiveBoard
                    riders={ridersOnTrack}
                    groups={groupsOnTrack}
                    selectedId={participantId}
                    onSelect={setParticipantId}
                    distanceFor={distanceFor}
                  />
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="ergebnisse" className="pt-3">
            <Card className="overflow-hidden">
              {race.data && (
                <ResultsPanel
                  raceId={race.data.id}
                  streckeId={streckeId ?? "all"}
                  onSelectParticipant={setParticipantId}
                />
              )}
            </Card>
          </TabsContent>

          <TabsContent value="strecke" className="pt-3">
            <Card>
              {streckeId != null && (
                <RoutePanel
                  streckeId={streckeId}
                  onSelectStation={(id, name) => setStation({ id, name })}
                />
              )}
            </Card>
          </TabsContent>

          <TabsContent value="punkte" className="pt-3">
            <Card className="overflow-hidden">{race.data && <PoiPanel raceId={race.data.id} />}</Card>
          </TabsContent>
        </Tabs>
      </main>

      <ParticipantSheet
        participantId={participantId}
        onOpenChange={(open) => !open && setParticipantId(undefined)}
        onSelectStation={(id) => setStation({ id })}
      />
      <StationSheet
        stationId={station?.id}
        stationName={station?.name}
        onOpenChange={(open) => !open && setStation(undefined)}
        onSelectParticipant={setParticipantId}
      />
    </div>
  );
}
