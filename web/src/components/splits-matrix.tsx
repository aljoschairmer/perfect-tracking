import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  parseParticipantStationRow,
  type ParsedParticipantStation,
  type LiveGroup,
  type StationDetail,
} from "perfect-tracking-client";

import { FilterChip } from "@/components/filter-chip";
import { GroupDot } from "@/components/status-badge";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { compareRiders, stationKm, type Rider } from "@/lib/live";
import { queries } from "@/lib/queries";
import { fmtDuration, fmtGap, runtimeToSec, shortClock } from "@/lib/time";
import { cn } from "@/lib/utils";

const MODES = [
  ["gap", "Rückstand"],
  ["netto", "Nettozeit"],
  ["etappe", "Etappe"],
  ["uhrzeit", "Uhrzeit"],
] as const;

type SplitsMode = (typeof MODES)[number][0];

const MODE_HINTS: Record<SplitsMode, string> = {
  gap: "Rückstand auf die schnellste Nettozeit je Station · P# = offizielle Platzierung an der Station",
  netto: "Fahrzeit ab eigenem Start bis zur Station — über Startzeiten hinweg direkt vergleichbar",
  etappe: "Reine Fahrzeit für den Abschnitt seit der vorigen Station, mit dem Abschnitts-Schnitt in km/h",
  uhrzeit: "Uhrzeit der Durchfahrt",
};

/**
 * One participant page per shown rider is plenty: at 40 columns the matrix
 * would stop being readable long before the request count hurts.
 */
const MAX_COLUMNS = 30;

interface SplitsMatrixProps {
  riders: Rider[];
  groups: LiveGroup[];
  stations?: StationDetail[];
  distanceFor: (rider: Rider) => number | undefined;
  onSelectParticipant: (participantId: number) => void;
}

/**
 * All timing stations as rows, one column per rider — the view that shows
 * where a race was won. Net times come from each rider's own participant page,
 * so a cell only exists once its rider has actually passed that station.
 */
export function SplitsMatrix({ riders, groups, stations, distanceFor, onSelectParticipant }: SplitsMatrixProps) {
  const [mode, setMode] = usePersistentState<SplitsMode>("pt-splits-mode", "gap");
  const [groupId, setGroupId] = useState<number | "all">("all");

  const { columns, dropped } = useMemo(() => {
    const pool = groupId === "all" ? riders : riders.filter((rider) => rider.groupId === groupId);
    const sorted = [...pool].sort((a, b) => compareRiders(a, b, "strecke", { progress: distanceFor }));
    return { columns: sorted.slice(0, MAX_COLUMNS), dropped: Math.max(0, sorted.length - MAX_COLUMNS) };
  }, [riders, groupId, distanceFor]);

  const pages = useQueries({ queries: columns.map((rider) => queries.participant(rider.id)) });
  const pendingCount = pages.filter((page) => page.isPending).length;

  // Each rider's splits, keyed by station id (matrix lookup) and by row index
  // (their own previous checkpoint, for the segment view).
  const splits = useMemo(
    () =>
      pages.map((page) => {
        const byStation = new Map<number, ParsedParticipantStation>();
        const byIndex = new Map<number, ParsedParticipantStation>();
        for (const raw of page.data?.stationen ?? []) {
          const row = parseParticipantStationRow(raw);
          byStation.set(Number(row.stationLink.split("/").pop()), row);
          byIndex.set(row.index, row);
        }
        return { byStation, byIndex };
      }),
    [pages]
  );

  const timingStations = useMemo(() => (stations ?? []).filter((station) => station.rank >= 1), [stations]);

  if (timingStations.length === 0 || riders.length === 0) {
    return (
      <p className="p-8 text-center text-sm text-muted-foreground">
        Für diese Strecke gibt es noch keine Zwischenzeiten.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-2">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Ansicht">
          {MODES.map(([key, label]) => (
            <FilterChip key={key} active={mode === key} onClick={() => setMode(key)}>
              {label}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Wertung">
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
      </div>

      <p className="border-b border-border px-4 py-1.5 text-xs text-muted-foreground">
        {MODE_HINTS[mode]}
        {dropped > 0 && ` · zeigt die vordersten ${MAX_COLUMNS} von ${columns.length + dropped} — Filter engt ein`}
        {pendingCount > 0 && ` · lädt noch ${pendingCount} von ${columns.length}`}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 z-10 bg-card px-4 py-2 text-left align-bottom label-xs">Zeitstation</th>
              {columns.map((rider) => (
                <th key={rider.id} className="min-w-24 px-3 py-2 text-left align-bottom font-normal">
                  <button
                    type="button"
                    onClick={() => onSelectParticipant(rider.id)}
                    title={rider.name}
                    className="flex max-w-32 items-center gap-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <GroupDot color={rider.color} />
                    <span className="min-w-0">
                      {rider.startnummer && (
                        <span className="block text-xs font-medium leading-tight">{rider.startnummer}</span>
                      )}
                      <span className="block truncate text-xs leading-tight text-muted-foreground">
                        {rider.name}
                      </span>
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timingStations.map((station) => {
              const cells = columns.map((_, index) => {
                const rider = splits[index];
                const raw = rider?.byStation.get(station.id);
                const rawSec = runtimeToSec(raw?.runtime);
                // The page keeps a rank-0 "00:00" placeholder row for a
                // station a rider has no valid time at. Taken at face value it
                // becomes the "best" time and every gap in the row explodes.
                const split = raw != null && rawSec != null && rawSec > 0 ? raw : undefined;
                if (!split) return { split: undefined, sec: undefined, segSec: undefined, segKm: undefined };
                const sec = rawSec!;
                // The rider's own previous checkpoint; the segment in between
                // is theirs even if they skipped a station the matrix shows.
                // A placeholder as predecessor invalidates the segment too —
                // only the Start row legitimately carries 00:00.
                const prev = rider?.byIndex.get(split.index - 1);
                const prevSec = runtimeToSec(prev?.runtime);
                const prevValid = prev != null && prevSec != null && (prevSec > 0 || prev.index === 0);
                const segSec = prevValid && sec >= prevSec! ? sec - prevSec! : undefined;
                const segKm = prevValid ? split.distanceKm - prev.distanceKm : undefined;
                return { split, sec, segSec, segKm };
              });

              const secs = cells.map((cell) => cell.sec).filter((sec): sec is number => sec != null);
              const bestSec = secs.length > 1 ? Math.min(...secs) : undefined;
              const segSecs = cells.map((cell) => cell.segSec).filter((sec): sec is number => sec != null);
              const bestSeg = segSecs.length > 1 ? Math.min(...segSecs) : undefined;

              return (
                <tr key={station.id} className="border-b border-border last:border-0 hover:bg-muted/60">
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-card px-4 py-1.5">
                    <span className="font-medium">{station.name}</span>
                    <span className="ml-1.5 text-xs text-muted-foreground">km {station.way}</span>
                  </td>
                  {cells.map((cell, index) => {
                    if (!cell.split) {
                      return (
                        <td key={columns[index].id} className="px-3 py-1.5 text-muted-foreground">
                          –
                        </td>
                      );
                    }

                    let value: string;
                    let best = false;
                    let sub: string | undefined;
                    if (mode === "etappe") {
                      value = cell.segSec != null ? fmtDuration(cell.segSec) : "–";
                      best = cell.segSec != null && cell.segSec === bestSeg;
                      if (cell.segSec != null && cell.segKm != null && cell.segKm > 0) {
                        sub = `Ø ${(cell.segKm / (cell.segSec / 3_600)).toFixed(1)}`;
                      }
                    } else if (mode === "uhrzeit") {
                      value = shortClock(cell.split.timestamp);
                    } else {
                      best = cell.sec != null && cell.sec === bestSec;
                      value =
                        mode === "gap" && !best && cell.sec != null && bestSec != null
                          ? fmtGap(cell.sec - bestSec)
                          : cell.split.runtime;
                      sub = cell.split.rank ? `P${cell.split.rank}` : undefined;
                    }

                    return (
                      <td
                        key={columns[index].id}
                        className={cn("tabular whitespace-nowrap px-3 py-1.5", best && "font-medium")}
                        style={
                          best
                            ? { backgroundColor: "color-mix(in oklch, var(--status-race) 14%, transparent)" }
                            : undefined
                        }
                        title={`${columns[index].name} · ${station.name}${stationKm(station) ? ` · km ${station.way}` : ""}`}
                      >
                        {value}
                        {sub && <span className="ml-1 text-xs text-muted-foreground">{sub}</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
