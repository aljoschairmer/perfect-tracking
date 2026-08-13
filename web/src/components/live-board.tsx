import { useMemo, useState } from "react";
import type { LiveGroup, StationDetail } from "perfect-tracking-client";
import { CircleHelp, Search, Star } from "lucide-react";

import { FilterChip } from "@/components/filter-chip";
import { GroupDot, StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNetTimes, type NetStationChoice } from "@/hooks/use-net-times";
import { usePersistentState } from "@/hooks/use-persistent-state";
import {
  SORT_LABELS,
  avgSpeedKmh,
  compareRiders,
  inRanking,
  lastStation,
  nextStation,
  type Rider,
  type SortMode,
} from "@/lib/live";
import { clockSortKey, fmtGap } from "@/lib/time";
import { cn } from "@/lib/utils";

interface LiveBoardProps {
  riders: Rider[];
  groups: LiveGroup[];
  stations?: StationDetail[];
  /** Course length of the selected variant, for the progress column. */
  totalKm?: number;
  /** Race start weekday (0 = Monday), anchoring weekday-only ETA strings. */
  raceStartDay?: number;
  selectedId?: number;
  onSelect: (riderId: number) => void;
  distanceFor: (rider: Rider) => number | undefined;
  favorites: Set<number>;
  onToggleFavorite: (riderId: number) => void;
  favOnly: boolean;
  onFavOnlyChange: (favOnly: boolean) => void;
}

export function LiveBoard({
  riders,
  groups,
  stations,
  totalKm,
  raceStartDay,
  selectedId,
  onSelect,
  distanceFor,
  favorites,
  onToggleFavorite,
  favOnly,
  onFavOnlyChange,
}: LiveBoardProps) {
  const [search, setSearch] = useState("");
  const [groupId, setGroupId] = useState<number | "all">("all");
  const [sort, setSort] = usePersistentState<SortMode>("pt-board-sort", "strecke");
  const [netChoice, setNetChoice] = usePersistentState<NetStationChoice>("pt-net-station", "auto");
  const [helpOpen, setHelpOpen] = useState(false);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return riders.filter((rider) => {
      if (groupId !== "all" && rider.groupId !== groupId) return false;
      if (!needle) return true;
      return rider.name.toLowerCase().includes(needle) || (rider.startnummer ?? "").toLowerCase().includes(needle);
    });
  }, [riders, search, groupId]);

  const net = useNetTimes(filtered, stations, netChoice);

  // A saved "netto" sort with no reachable station would silently freeze the order.
  const effectiveSort: SortMode = sort === "netto" && net.station == null ? "strecke" : sort;

  const visible = useMemo(() => {
    const ctx = {
      progress: distanceFor,
      netSec: (rider: Rider) => net.byId.get(rider.id)?.sec,
      zielKey:
        raceStartDay != null
          ? (rider: Rider) => clockSortKey(rider.update?.finishest, raceStartDay)
          : undefined,
    };
    return [...filtered].sort((a, b) => compareRiders(a, b, effectiveSort, ctx));
  }, [filtered, effectiveSort, distanceFor, net.byId, raceStartDay]);

  // "Rückstand" always measures course position, no matter how the list is sorted.
  const leaderKm = useMemo(() => {
    let max: number | undefined;
    for (const rider of visible) {
      if (!inRanking(rider)) continue;
      const km = distanceFor(rider);
      if (km != null && (max == null || km > max)) max = km;
    }
    return max;
  }, [visible, distanceFor]);

  // Net-time placement among the shown riders; equal times share a rank.
  const netRanks = useMemo(() => {
    const order = visible
      .map((rider) => ({ id: rider.id, sec: net.byId.get(rider.id)?.sec }))
      .filter((entry): entry is { id: number; sec: number } => entry.sec != null)
      .sort((a, b) => a.sec - b.sec);
    const ranks = new Map<number, number>();
    order.forEach((entry, index) => {
      const prev = order[index - 1];
      ranks.set(entry.id, prev && prev.sec === entry.sec ? ranks.get(prev.id)! : index + 1);
    });
    return { ranks, best: order[0]?.sec };
  }, [visible, net.byId]);

  let position = 0;

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name oder Startnummer"
            className="pl-7"
            aria-label="Teilnehmer suchen"
          />
        </div>
        <FilterChip
          active={favOnly}
          onClick={() => onFavOnlyChange(!favOnly)}
          disabled={favorites.size === 0 && !favOnly}
          title="Nur mit ★ markierte Teilnehmer zeigen — wirkt auch auf Karte, Höhenprofil und Zwischenzeiten"
        >
          <Star className="size-3" /> Favoriten {favorites.size > 0 && <span className="tabular">{favorites.size}</span>}
        </FilterChip>
        <span className="tabular text-xs text-muted-foreground">{visible.length}</span>
        <button
          type="button"
          onClick={() => setHelpOpen((open) => !open)}
          aria-expanded={helpOpen}
          aria-label="Erklärung der Rangliste"
          className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CircleHelp className="size-4" />
        </button>
      </div>

      {helpOpen && (
        <div className="space-y-1.5 border-b border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
          <p>
            <strong className="text-foreground">Reihenfolge:</strong> Zielankömmlinge stehen immer oben, nach
            Fahrzeit. Danach das fahrende Feld in der gewählten Sortierung, dann außer Zeitlimit, Aufgaben,
            Disqualifikationen und Nichtstarter. „Pl.“ zählt nur Finisher und Fahrende.
          </p>
          <p>
            <strong className="text-foreground">Rückstand</strong> ist stets der km-Abstand zur Spitze auf der
            Strecke — auch wenn gerade anders sortiert ist. Bei versetzten Startzeiten benachteiligt die
            km-Spalte später Gestartete; <strong className="text-foreground">Ø Tempo</strong> ist davon
            unabhängig und über Startgruppen hinweg vergleichbar.
          </p>
          <p>
            <strong className="text-foreground">Netto @ Station</strong> vergleicht die reine Fahrzeit ab eigenem
            Start an einer Zeitstation — der faire Direktvergleich. „Auto“ nimmt die weiteste erreichte Station,
            „letzte gemeinsame“ die letzte, die alle Angezeigten passiert haben.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-1 border-b border-border px-3 py-2">
        <FilterChip active={groupId === "all"} onClick={() => setGroupId("all")}>
          Alle
        </FilterChip>
        {groups.map((group) => (
          <FilterChip key={group.id} active={groupId === group.id} onClick={() => setGroupId(group.id)}>
            <GroupDot color={group.color} />
            {group.name}
          </FilterChip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-3 py-2">
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Sortierung">
          <span className="label-xs">Sortieren</span>
          {(Object.entries(SORT_LABELS) as [SortMode, string][]).map(([mode, label]) => (
            <FilterChip
              key={mode}
              active={effectiveSort === mode}
              onClick={() => setSort(mode)}
              disabled={mode === "netto" && net.station == null}
            >
              {label}
            </FilterChip>
          ))}
        </div>
        {net.available.length > 0 && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Netto&nbsp;@
            <Select
              value={typeof netChoice === "number" ? String(netChoice) : netChoice}
              onValueChange={(value) =>
                setNetChoice(value === "auto" || value === "common" ? value : Number(value))
              }
            >
              <SelectTrigger className="h-8 w-64" aria-label="Zeitstation für den Nettozeit-Vergleich">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto · weiteste erreichte</SelectItem>
                <SelectItem value="common">Auto · letzte gemeinsame</SelectItem>
                {net.available.map((station) => (
                  <SelectItem key={station.id} value={String(station.id)}>
                    {station.name} · km {station.way}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        )}
      </div>

      {/* Fixed max height instead of a flex chain: the table must scroll on
          its own no matter how the card around it is laid out. */}
      <div className="max-h-[65vh] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead className="w-8" aria-label="Favorit" />
              <TableHead
                className="w-9 text-right"
                title="Position in der aktuellen Sortierung; zählt nur Finisher und Fahrende"
              >
                Pl.
              </TableHead>
              <TableHead>Teilnehmer</TableHead>
              <TableHead title="Gefahrene Kilometer; darunter Rückstand zur Spitze und die nächste Zeitstation">
                Strecke
              </TableHead>
              {net.station && (
                <TableHead
                  className="text-right"
                  title={`Nettozeit-Platzierung an ${net.station.name} (km ${net.station.way}) — Fahrzeit ab eigenem Start`}
                >
                  Netto&nbsp;@{" "}
                  <span className="inline-block max-w-28 truncate align-bottom normal-case">{net.station.name}</span>
                </TableHead>
              )}
              <TableHead
                className="text-right"
                title="Fahrzeit seit dem eigenen Start; darunter die Zielprognose des Veranstalters"
              >
                Fahrzeit
              </TableHead>
              <TableHead className="text-right" title="Aktuelles Tempo; darunter der Schnitt seit dem Start">
                km/h
              </TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((rider) => {
              const km = distanceFor(rider);
              const ranked = inRanking(rider);
              if (ranked) position++;
              const pct = km != null && totalKm ? Math.min(100, (km / totalKm) * 100) : undefined;
              const gapKm = ranked && km != null && leaderKm != null ? leaderKm - km : undefined;
              const racing = rider.update?.status === 1;
              const next = racing ? nextStation(km, stations) : undefined;
              const passed = lastStation(rider, stations);
              const avg = avgSpeedKmh(rider, distanceFor);
              const netTime = net.byId.get(rider.id);
              const netRank = netRanks.ranks.get(rider.id);
              const favorite = favorites.has(rider.id);

              return (
                <TableRow
                  key={rider.id}
                  onClick={() => onSelect(rider.id)}
                  className={cn("cursor-pointer", rider.id === selectedId && "bg-accent hover:bg-accent")}
                >
                  <TableCell className="pr-0">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleFavorite(rider.id);
                      }}
                      aria-pressed={favorite}
                      aria-label="Favorit umschalten"
                      className={cn(
                        "rounded-sm p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        favorite ? "text-primary" : "text-muted-foreground/50 hover:text-foreground"
                      )}
                    >
                      <Star className="size-3.5" fill={favorite ? "currentColor" : "none"} />
                    </button>
                  </TableCell>
                  <TableCell className="tabular text-right text-xs text-muted-foreground">
                    {ranked ? position : "—"}
                  </TableCell>
                  {/* `w-full max-w-0` makes this the only flexible column, so
                      long place names truncate instead of widening the table. */}
                  <TableCell className="w-full max-w-0">
                    <div className="flex items-center gap-2">
                      <GroupDot color={rider.color} />
                      <div className="min-w-0">
                        <div className="truncate font-medium leading-tight">{rider.name}</div>
                        <div className="truncate text-xs leading-tight text-muted-foreground">
                          {rider.startnummer ? `${rider.startnummer} · ` : ""}
                          {passed
                            ? `zuletzt ${passed.name}${rider.update?.stationtime ? ` · ${rider.update.stationtime}` : ""}`
                            : (rider.update?.geo ?? rider.groupName)}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="tabular leading-tight">
                      {km != null ? `${km.toFixed(0)} km` : "—"}
                      {pct != null && <span className="ml-1.5 text-xs text-muted-foreground">{Math.round(pct)}%</span>}
                    </div>
                    {pct != null && (
                      <div className="mt-1 h-1 w-28 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                    <div className="mt-0.5 text-xs leading-tight text-muted-foreground">
                      {gapKm != null &&
                        (gapKm < 0.05 ? (
                          <span className="font-medium text-foreground">FÜHRT</span>
                        ) : (
                          <span className="tabular">−{gapKm.toFixed(1)} km</span>
                        ))}
                      {next && (
                        <span title={`noch ${next.restKm.toFixed(1)} km bis ${next.station.name}`}>
                          {gapKm != null ? " · " : ""}→ {next.station.name} {next.restKm.toFixed(0)} km
                        </span>
                      )}
                    </div>
                  </TableCell>
                  {net.station && (
                    <TableCell className="whitespace-nowrap text-right">
                      {netTime && netRank != null ? (
                        <>
                          <div className="text-xs font-medium leading-tight">P{netRank}</div>
                          <div className="tabular text-xs leading-tight text-muted-foreground" title={netTime.timestamp}>
                            {netRanks.best != null && netTime.sec > netRanks.best
                              ? fmtGap(netTime.sec - netRanks.best)
                              : netTime.runtime}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">{net.isPending ? "…" : "—"}</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="whitespace-nowrap text-right">
                    <div className="tabular leading-tight">{rider.update?.runtime ?? "—"}</div>
                    {rider.update?.finishest && (
                      <div
                        className="text-xs leading-tight text-muted-foreground"
                        title={
                          rider.update.finishesttol
                            ? `Prognose des Veranstalters, Unschärfe ${rider.update.finishesttol}`
                            : "Prognose des Veranstalters"
                        }
                      >
                        Ziel {rider.update.finishest}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <div className="tabular leading-tight">{racing ? (rider.update?.speed ?? "—") : "—"}</div>
                    {avg != null && (
                      <div
                        className="tabular text-xs leading-tight text-muted-foreground"
                        title="Schnitt seit dem eigenen Start"
                      >
                        Ø {avg.toFixed(1)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge code={rider.update?.status} />
                  </TableCell>
                </TableRow>
              );
            })}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={net.station ? 8 : 7} className="py-8 text-center text-sm text-muted-foreground">
                  Keine Teilnehmer gefunden
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
