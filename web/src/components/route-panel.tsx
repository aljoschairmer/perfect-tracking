import { useQuery } from "@tanstack/react-query";

import { ElevationProfile } from "@/components/elevation-profile";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { queries } from "@/lib/queries";
import { routeLengthKm, totalAscent } from "@/lib/geo";

/** Route detail: elevation profile plus the checkpoint list for one variant. */
export function RoutePanel({
  streckeId,
  onSelectStation,
}: {
  streckeId: number;
  onSelectStation: (stationId: number, name: string) => void;
}) {
  const route = useQuery(queries.route(streckeId));
  const strecke = useQuery(queries.strecke(streckeId));

  const track = route.data?.route ?? [];

  return (
    <div className="space-y-4 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Distanz" value={track.length ? `${routeLengthKm(track).toFixed(0)} km` : undefined} />
        <Stat
          label="Höhenmeter (ca.)"
          value={track.length ? `${totalAscent(track).toLocaleString("de-AT")} m` : undefined}
        />
        <Stat label="Stationen" value={strecke.data ? String(strecke.data.stations.length) : undefined} />
      </div>

      {route.isPending ? <Skeleton className="h-28 w-full" /> : <ElevationProfile track={track} />}

      {strecke.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-right">#</TableHead>
              <TableHead>Station</TableHead>
              <TableHead className="text-right">km</TableHead>
              <TableHead className="text-right">Höhe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {strecke.data?.stations.map((station) => (
              <TableRow key={station.id} className="cursor-pointer" onClick={() => onSelectStation(station.id, station.name)}>
                <TableCell className="tabular text-right text-xs text-muted-foreground">{station.rank}</TableCell>
                <TableCell className="font-medium">{station.name}</TableCell>
                <TableCell className="tabular text-right">{station.way}</TableCell>
                <TableCell className="tabular text-right text-muted-foreground">{station.altitude} m</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <div className="label-xs">{label}</div>
      {value ? <div className="tabular text-lg leading-tight">{value}</div> : <Skeleton className="mt-1 h-6 w-20" />}
    </div>
  );
}
