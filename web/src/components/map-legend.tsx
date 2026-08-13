import type { LiveGroup } from "perfect-tracking-client";

import { GroupDot } from "@/components/status-badge";

/** Symbol key under the map — without it the marker shapes are guesswork. */
export function MapLegend({
  groups,
  showStations,
  hasPois,
}: {
  groups: LiveGroup[];
  showStations: boolean;
  hasPois: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {groups.map((group) => (
        <span key={group.id} className="inline-flex items-center gap-1.5">
          <GroupDot color={group.color} />
          {group.name}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="inline-block size-2.5 rounded-full border-2 border-foreground bg-background" />
        Start/Ziel
      </span>
      {showStations && (
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-2 rounded-full border border-muted-foreground bg-background" />
          Zeitstation
        </span>
      )}
      {hasPois && (
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-2 rounded-full bg-muted-foreground/70" />
          Streckenpunkt
        </span>
      )}
    </div>
  );
}
