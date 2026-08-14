import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { sanitizeText } from "perfect-tracking-client";

import { AppHeader } from "@/components/app-header";
import { ElevationProfile } from "@/components/elevation-profile";
import { FilterChip } from "@/components/filter-chip";
import { LiveBoard } from "@/components/live-board";
import { MapLegend } from "@/components/map-legend";
import { ParticipantSheet } from "@/components/participant-sheet";
import { PoiPanel } from "@/components/poi-panel";
import { ResultsPanel } from "@/components/results-panel";
import { RoutePanel } from "@/components/route-panel";
import { SplitsMatrix } from "@/components/splits-matrix";
import { StationSheet } from "@/components/station-sheet";
import { TrackMap } from "@/components/track-map";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFavorites } from "@/hooks/use-favorites";
import { useLiveRace } from "@/hooks/use-live-race";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { readUrlState, useUrlSync } from "@/hooks/use-url-state";
import { client } from "@/lib/client";
import { routeLengthKm } from "@/lib/geo";
import { riderDistanceKm } from "@/lib/live";
import { queries } from "@/lib/queries";

// The shareable view state is read once, before React takes over the URL.
const initialUrl = readUrlState();

export default function App() {
  const [slug, setSlug] = useState<string | undefined>(initialUrl.race);
  const [streckeId, setStreckeId] = useState<number | undefined>(initialUrl.strecke);
  const [tab, setTab] = useState(initialUrl.tab ?? "live");
  const [participantId, setParticipantId] = useState<number | undefined>(initialUrl.teilnehmer);
  const [station, setStation] = useState<{ id: number; name?: string }>();

  const { favorites, toggleFavorite } = useFavorites();
  const [favOnlyStored, setFavOnly] = usePersistentState("pt-fav-only", false);
  // Deleting the last favourite while the filter is on would blank every view.
  const favOnly = favOnlyStored && favorites.size > 0;
  const [showStations, setShowStations] = usePersistentState("pt-map-stations", true);

  const races = useQuery(queries.races());
  const race = useQuery({ ...queries.race(slug!), enabled: slug != null });

  // Land on the newest race — and recover if a shared link names one that no
  // longer exists.
  useEffect(() => {
    if (!races.data?.length) return;
    if (!slug || !races.data.some((r) => r.sname === slug)) setSlug(races.data[0].sname);
  }, [races.data, slug]);

  // Each race brings its own route variants. A selection restored from the URL
  // survives; anything else falls back to the first variant.
  useEffect(() => {
    const strecken = race.data?.strecken;
    if (!strecken) return;
    setStreckeId((prev) => (prev != null && strecken.some((s) => s.id === prev) ? prev : strecken[0]?.id));
  }, [race.data]);

  useUrlSync({ race: slug, strecke: streckeId, tab: tab === "live" ? undefined : tab, tn: participantId });

  const isLive = race.data ? client.isRaceLive(race.data) : false;
  const live = useLiveRace(race.data?.id, isLive);

  const raceId = race.data?.id;
  const routes = useQuery({ ...queries.routes(raceId ?? 0), enabled: raceId != null });
  const strecke = useQuery({ ...queries.strecke(streckeId ?? 0), enabled: streckeId != null });
  const pois = useQuery({ ...queries.pois(raceId ?? 0), enabled: raceId != null });

  const track = useMemo(
    () => routes.data?.routes.find((r) => r.id === streckeId)?.data ?? [],
    [routes.data, streckeId]
  );
  const totalKm = routeLengthKm(track);

  // Weekday-only strings ("Sa. 20:21") become sortable once anchored here.
  const raceStartDay = race.data ? (new Date(race.data.ustarttime * 1000).getDay() + 6) % 7 : undefined;

  // The route variant chosen above scopes the whole live view, so the map and
  // the board always describe the same field. The favourites filter narrows it
  // further — across map, profile, board and splits alike.
  const ridersOnTrack = useMemo(() => {
    const onTrack = live.riders.filter((rider) => rider.strecke === streckeId);
    return favOnly ? onTrack.filter((rider) => favorites.has(rider.id)) : onTrack;
  }, [live.riders, streckeId, favOnly, favorites]);
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
        .map((rider) => {
          const km = distanceFor(rider) ?? 0;
          return {
            id: rider.id,
            km,
            color: rider.color,
            nr: rider.startnummer,
            label: `${rider.name} · ${km.toFixed(0)} km`,
            selected: rider.id === participantId,
          };
        }),
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
        updatedAtIsServerTime={live.updatedAtIsServerTime}
        isFetching={live.isFetching}
      />

      {race.error && <p className="p-4 text-sm text-destructive">{race.error.message}</p>}

      <main className="min-h-0 flex-1 overflow-y-auto">
        {/* One shared reading width: full-bleed only stretches the whitespace
            on ultrawide screens, not the content. */}
        <div className="mx-auto w-full max-w-[100rem]">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-border px-4 py-3">
          {race.data ? (
            <div>
              <h1 className="text-lg font-semibold leading-tight tracking-tight">{race.data.title}</h1>
              <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">{sanitizeText(race.data.info)}</p>
            </div>
          ) : (
            <Skeleton className="h-10 w-80" />
          )}
          {race.data && race.data.strecken.length > 1 && (
            <div className="flex flex-wrap gap-1">
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
        </div>

        <Tabs value={tab} onValueChange={setTab} className="px-4 py-3">
          <TabsList>
            <TabsTrigger value="live">Live</TabsTrigger>
            <TabsTrigger value="zwischenzeiten">Zwischenzeiten</TabsTrigger>
            <TabsTrigger value="ergebnisse">Ergebnisse</TabsTrigger>
            <TabsTrigger value="strecke">Strecke</TabsTrigger>
            <TabsTrigger value="punkte">Streckenpunkte</TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="space-y-3 pt-3">
            {/* The board is the main content and needs the full width for its
                columns — squeezed into a sidebar it truncates names and clips
                the net-time column. Map and profile share the row below. */}
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Klassement</CardTitle>
                {live.loading && <span className="label-xs">lädt…</span>}
              </CardHeader>
              <div>
                <LiveBoard
                  riders={ridersOnTrack}
                  groups={groupsOnTrack}
                  stations={strecke.data?.stations}
                  totalKm={totalKm > 0 ? totalKm : undefined}
                  raceStartDay={raceStartDay}
                  selectedId={participantId}
                  onSelect={setParticipantId}
                  distanceFor={distanceFor}
                  favorites={favorites}
                  onToggleFavorite={toggleFavorite}
                  favOnly={favOnly}
                  onFavOnlyChange={setFavOnly}
                />
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Höhenprofil</CardTitle>
                <span className="label-xs">Mausrad zoomt, Ziehen verschiebt, Doppelklick setzt zurück</span>
              </CardHeader>
              <CardContent>
                {routes.isPending ? (
                  <Skeleton className="h-28 w-full" />
                ) : (
                  <ElevationProfile
                    track={track}
                    markers={elevationMarkers}
                    stations={strecke.data?.stations}
                    onSelectMarker={setParticipantId}
                  />
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Streckenverlauf</CardTitle>
                <div className="flex items-center gap-2">
                  <FilterChip active={showStations} onClick={() => setShowStations(!showStations)}>
                    Zeitstationen
                  </FilterChip>
                  <span className="tabular text-xs text-muted-foreground">
                    {ridersOnTrack.filter((r) => r.update?.status === 1).length} unterwegs
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {routes.isPending ? (
                  <Skeleton className="h-[26rem] w-full rounded-none" />
                ) : (
                  <div className="space-y-2 p-3">
                    <div className="h-[26rem]">
                      <TrackMap
                        track={track}
                        riders={ridersOnTrack}
                        stations={strecke.data?.stations}
                        pois={pois.data?.pois}
                        showStations={showStations}
                        selectedId={participantId}
                        onSelect={setParticipantId}
                      />
                    </div>
                    <MapLegend
                      groups={groupsOnTrack}
                      showStations={showStations}
                      hasPois={(pois.data?.pois.length ?? 0) > 0}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="zwischenzeiten" className="pt-3">
            <Card className="overflow-hidden">
              <SplitsMatrix
                riders={ridersOnTrack}
                groups={groupsOnTrack}
                stations={strecke.data?.stations}
                distanceFor={distanceFor}
                onSelectParticipant={setParticipantId}
              />
            </Card>
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
        </div>
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
