import { useQuery } from "@tanstack/react-query";
import { parseParticipantStationRow, sanitizeText } from "perfect-tracking-client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { queries } from "@/lib/queries";

/** Drill-down for one entrant: their split at every checkpoint they've passed. */
export function ParticipantSheet({
  participantId,
  onOpenChange,
  onSelectStation,
}: {
  participantId: number | undefined;
  onOpenChange: (open: boolean) => void;
  onSelectStation: (stationId: number) => void;
}) {
  const { data, isPending, error } = useQuery({
    ...queries.participant(participantId!),
    enabled: participantId != null,
  });

  const splits = data?.stationen.map(parseParticipantStationRow) ?? [];

  return (
    <Sheet open={participantId != null} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>{data?.name ?? "Teilnehmer"}</SheetTitle>
          <SheetDescription>
            {data ? [data.startnummer, data.gruppe].filter(Boolean).join(" · ") : "Wird geladen…"}
          </SheetDescription>
          {data?.infoort && (
            <p className="mt-2 text-sm text-muted-foreground">{sanitizeText(data.infoort)}</p>
          )}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error && <p className="p-5 text-sm text-destructive">{error.message}</p>}

          {isPending && (
            <div className="space-y-2 p-5">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          )}

          {!isPending && !error && (
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Station</TableHead>
                  <TableHead className="text-right">km</TableHead>
                  <TableHead className="text-right">Höhe</TableHead>
                  <TableHead className="text-right">Rang</TableHead>
                  <TableHead className="text-right">Zeit</TableHead>
                  <TableHead className="text-right">Ø km/h</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {splits.map((split) => (
                  <TableRow key={`${split.index}-${split.station}`}>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => onSelectStation(stationIdFromLink(split.stationLink))}
                        className="text-left font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {split.station}
                      </button>
                      <div className="text-xs text-muted-foreground">{split.timestamp}</div>
                    </TableCell>
                    <TableCell className="tabular text-right">{split.distanceKm.toFixed(1)}</TableCell>
                    <TableCell className="tabular text-right text-muted-foreground">{split.altitude}</TableCell>
                    <TableCell className="tabular text-right">{split.rank}</TableCell>
                    <TableCell className="tabular text-right">{split.runtime}</TableCell>
                    <TableCell className="tabular text-right">{split.avgSpeedKmh.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
                {splits.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      Noch keine Zwischenzeiten
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Station links come back as `/race/{slug}/station/{id}`. */
function stationIdFromLink(link: string): number {
  return Number(link.split("/").pop());
}
