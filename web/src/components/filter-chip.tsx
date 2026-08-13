import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Small toggle chip used by every filter and mode row. */
export function FilterChip({
  active,
  onClick,
  disabled,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-xs transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "border-foreground/25 bg-accent text-foreground"
          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
