import { useQuery } from "@tanstack/react-query";
import { parseStationResultRow } from "perfect-tracking-client";

import { StatusBadge } from "@/components/status-badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { queries } from "@/lib/queries";

/** Drill-down for one checkpoint: everyone who has passed it, per start group. */
export function StationSheet({
  stationId,
  stationName,
  onOpenChange,
  onSelectParticipant,
}: {
  stationId: number | undefined;
  stationName?: string;
  onOpenChange: (open: boolean) => void;
  onSelectParticipant: (participantId: number) => void;
}) {
  const { data, isPending, error } = useQuery({
    ...queries.station(stationId!),
    enabled: stationId != null,
  });

  return (
    <Sheet open={stationId != null} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>{stationName ?? "Station"}</SheetTitle>
          <SheetDescription>
            {data ? `${data.altitude} m Seehöhe` : "Wird geladen…"}
          </SheetDescription>
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

          {data?.gruppen.map((group) => (
            <section key={group.id}>
              <h3 className="sticky top-0 z-10 border-y border-border bg-muted/70 px-5 py-1.5 text-xs font-semibold backdrop-blur">
                {group.name}
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-right">#</TableHead>
                    <TableHead>Teilnehmer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Zeit</TableHead>
                    <TableHead className="text-right">Ø km/h</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.data.map(parseStationResultRow).map((row) => (
                    <TableRow key={`${group.id}-${row.link}`}>
                      <TableCell className="tabular text-right text-xs text-muted-foreground">{row.rank}</TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => onSelectParticipant(participantIdFromLink(row.link))}
                          className="text-left font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {row.name}
                        </button>
                        <div className="text-xs text-muted-foreground">
                          {row.startnummer} · {row.timestamp}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge colorClass={row.statusColor} label={row.status} />
                      </TableCell>
                      <TableCell className="tabular text-right">{row.runtime}</TableCell>
                      <TableCell className="tabular text-right">{row.avgSpeedKmh.toFixed(1)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Participant links come back as `/race/{slug}/teilnehmer/{id}`. */
function participantIdFromLink(link: string): number {
  return Number(link.split("/").pop());
}
