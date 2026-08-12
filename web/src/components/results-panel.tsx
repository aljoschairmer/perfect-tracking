import { useQuery } from "@tanstack/react-query";
import { parseResultRow } from "perfect-tracking-client";

import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { queries } from "@/lib/queries";

/**
 * The results endpoint returns fixed-position row tuples with an HTML status
 * badge baked in; `parseResultRow` sanitizes them into plain objects before
 * anything reaches the DOM.
 */
export function ResultsPanel({
  raceId,
  streckeId,
  onSelectParticipant,
}: {
  raceId: number;
  streckeId: number | "all";
  onSelectParticipant: (participantId: number) => void;
}) {
  const { data, isPending, error } = useQuery(queries.results(raceId, streckeId));

  if (error) return <p className="p-4 text-sm text-destructive">{error.message}</p>;

  if (isPending) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
    );
  }

  if (data.gruppen.length === 0) {
    return <p className="p-8 text-center text-sm text-muted-foreground">Noch keine Ergebnisse veröffentlicht.</p>;
  }

  return (
    <div className="divide-y divide-border">
      {data.gruppen.map((group) => (
        <section key={group.id}>
          <h3 className="sticky top-0 z-10 border-b border-border bg-muted/70 px-4 py-1.5 text-xs font-semibold backdrop-blur">
            {group.name}
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-right">#</TableHead>
                <TableHead>Teilnehmer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Letzter Punkt</TableHead>
                <TableHead className="text-right">Zeit</TableHead>
                <TableHead className="text-right">Ø km/h</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.data.map(parseResultRow).map((row) => (
                <TableRow key={`${group.id}-${row.link}`}>
                  <TableCell className="tabular text-right text-xs text-muted-foreground">{row.rank}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => onSelectParticipant(Number(row.link.split("/").pop()))}
                      className="text-left font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {row.name}
                    </button>
                    <div className="text-xs text-muted-foreground">{row.startnummer}</div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge colorClass={row.statusColor} label={row.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.location}</TableCell>
                  <TableCell className="tabular text-right">{row.runtime}</TableCell>
                  <TableCell className="tabular text-right">{row.avgSpeedKmh.toFixed(1)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ))}
    </div>
  );
}
