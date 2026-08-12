import type { RaceSummary } from "perfect-tracking-client";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

export function AppHeader({
  races,
  slug,
  onSlugChange,
  live,
  updatedAt,
  isFetching,
}: {
  races: RaceSummary[];
  slug: string | undefined;
  onSlugChange: (slug: string) => void;
  live: boolean;
  updatedAt: Date | undefined;
  isFetching: boolean;
}) {
  const { theme, toggle } = useTheme();

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="h-4 w-1 rounded-full bg-primary" aria-hidden />
        <div className="leading-none">
          <div className="text-sm font-semibold tracking-tight">perfect tracking</div>
          <div className="label-xs">Live race dashboard</div>
        </div>
      </div>

      <Select value={slug} onValueChange={onSlugChange}>
        <SelectTrigger className="w-56" aria-label="Rennen auswählen">
          <SelectValue placeholder="Rennen wählen" />
        </SelectTrigger>
        <SelectContent>
          {races.map((race) => (
            <SelectItem key={race.sname} value={race.sname}>
              {race.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="ml-auto flex items-center gap-3">
        <LiveIndicator live={live} updatedAt={updatedAt} isFetching={isFetching} />
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Farbschema wechseln">
          {theme === "dark" ? <Sun /> : <Moon />}
        </Button>
      </div>
    </header>
  );
}

function LiveIndicator({ live, updatedAt, isFetching }: { live: boolean; updatedAt: Date | undefined; isFetching: boolean }) {
  if (!live) {
    return <span className="label-xs">Archiv</span>;
  }
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn("size-1.5 rounded-full bg-[var(--status-race)]", isFetching && "animate-pulse")}
        aria-hidden
      />
      <span className="label-xs">
        Live
        {updatedAt && (
          <span className="tabular ml-1.5 normal-case tracking-normal">
            {updatedAt.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        )}
      </span>
    </div>
  );
}
