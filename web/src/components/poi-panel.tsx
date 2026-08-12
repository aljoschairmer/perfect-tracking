import { useQuery } from "@tanstack/react-query";
import { sanitizeText } from "perfect-tracking-client";

import { Skeleton } from "@/components/ui/skeleton";
import { queries } from "@/lib/queries";

/** Points of interest along the course. Refetches on the same 20s cadence as the live map. */
export function PoiPanel({ raceId }: { raceId: number }) {
  const { data, isPending, error } = useQuery(queries.pois(raceId));

  if (error) return <p className="p-4 text-sm text-destructive">{error.message}</p>;

  if (isPending) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (data.pois.length === 0) {
    return (
      <p className="p-8 text-center text-sm text-muted-foreground">
        Für dieses Rennen sind derzeit keine Streckenpunkte hinterlegt.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {data.pois.map((poi) => (
        <li key={poi.id} className="flex gap-3 px-4 py-3">
          <span
            aria-hidden
            className="mt-1 size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: `var(--group-${poi.color % 10})` }}
          />
          <div className="min-w-0">
            <div className="font-medium">{sanitizeText(poi.infoshort || "Streckenpunkt")}</div>
            {poi.infolong && (
              <p className="mt-0.5 text-sm text-muted-foreground">{sanitizeText(poi.infolong)}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
