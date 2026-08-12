import { STATUS, type StatusCode } from "perfect-tracking-client";

import { cn } from "@/lib/utils";

/**
 * The API describes status two ways: a numeric code on live updates, and a
 * pre-rendered badge class ("race", "dnf", ...) on results rows. Both funnel
 * into the same `--status-*` token, so a rider looks identical in every view.
 */
export function StatusBadge({
  code,
  colorClass,
  label,
  className,
}: {
  code?: number;
  colorClass?: string | null;
  label?: string;
  className?: string;
}) {
  const known = code != null ? STATUS[code as StatusCode] : undefined;
  const color = colorClass ?? known?.color ?? "notstarted";
  const text = label ?? known?.name ?? "—";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-medium leading-none",
        className
      )}
      style={{
        color: `var(--status-${color}, var(--muted-foreground))`,
        backgroundColor: `color-mix(in oklch, var(--status-${color}, var(--muted-foreground)) 14%, transparent)`,
      }}
    >
      {text}
    </span>
  );
}

/** Small colour chip identifying a rider's start group, using the API's group index. */
export function GroupDot({ color, className }: { color: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: `var(--group-${color % 10})` }}
    />
  );
}
