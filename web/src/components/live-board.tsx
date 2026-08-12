import { useMemo, useState } from "react";
import type { LiveGroup } from "perfect-tracking-client";
import { Search } from "lucide-react";

import { GroupDot, StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { compareRiders, type Rider } from "@/lib/live";
import { cn } from "@/lib/utils";

interface LiveBoardProps {
  riders: Rider[];
  groups: LiveGroup[];
  selectedId?: number;
  onSelect: (riderId: number) => void;
  distanceFor: (rider: Rider) => number | undefined;
}

export function LiveBoard({ riders, groups, selectedId, onSelect, distanceFor }: LiveBoardProps) {
  const [search, setSearch] = useState("");
  const [groupId, setGroupId] = useState<number | "all">("all");

  // A single group has comparable ranks; a mixed field does not, so it falls
  // back to distance covered.
  const sortBy = groupId === "all" ? "progress" : "rank";

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return riders
      .filter((rider) => {
        if (groupId !== "all" && rider.groupId !== groupId) return false;
        if (!needle) return true;
        return rider.name.toLowerCase().includes(needle) || (rider.startnummer ?? "").toLowerCase().includes(needle);
      })
      .sort((a, b) => compareRiders(a, b, sortBy, distanceFor));
  }, [riders, search, groupId, sortBy, distanceFor]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name oder Startnummer"
            className="pl-7"
            aria-label="Teilnehmer suchen"
          />
        </div>
        <span className="tabular text-xs text-muted-foreground">{visible.length}</span>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border px-3 py-2">
        <GroupChip active={groupId === "all"} onClick={() => setGroupId("all")}>
          Alle
        </GroupChip>
        {groups.map((group) => (
          <GroupChip key={group.id} active={groupId === group.id} onClick={() => setGroupId(group.id)}>
            <GroupDot color={group.color} />
            {group.name}
          </GroupChip>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead className="w-9 text-right" title="Rang innerhalb der Startgruppe">
                #
              </TableHead>
              <TableHead>Teilnehmer</TableHead>
              <TableHead className="text-right">km</TableHead>
              <TableHead className="text-right">km/h</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((rider) => {
              const km = distanceFor(rider);
              return (
                <TableRow
                  key={rider.id}
                  onClick={() => onSelect(rider.id)}
                  className={cn("cursor-pointer", rider.id === selectedId && "bg-accent hover:bg-accent")}
                >
                  <TableCell className="tabular text-right text-xs text-muted-foreground">
                    {rider.update?.rang ?? "—"}
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
                          {rider.update?.geo ?? rider.groupName}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="tabular text-right">{km != null ? km.toFixed(0) : "—"}</TableCell>
                  <TableCell className="tabular text-right">{rider.update?.speed ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge code={rider.update?.status} />
                  </TableCell>
                </TableRow>
              );
            })}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
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

function GroupChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-xs transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-foreground/25 bg-accent text-foreground"
          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
