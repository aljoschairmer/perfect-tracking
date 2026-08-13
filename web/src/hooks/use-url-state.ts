import { useEffect } from "react";

/** One-shot read of the shareable view state from the query string. */
export function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  const num = (key: string) => {
    const raw = params.get(key);
    return raw != null && /^\d+$/.test(raw) ? Number(raw) : undefined;
  };
  return {
    race: params.get("race") ?? undefined,
    strecke: num("strecke"),
    tab: params.get("tab") ?? undefined,
    teilnehmer: num("tn"),
  };
}

/**
 * Mirrors the current view into the URL so it can be shared as a link.
 * replaceState, not pushState — the 20-second poll rerenders constantly and
 * must not grow the browser history.
 */
export function useUrlSync(state: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(state)) {
    if (value != null && value !== "") params.set(key, String(value));
  }
  const search = params.toString();

  useEffect(() => {
    if (window.location.search.replace(/^\?/, "") === search) return;
    history.replaceState(null, "", search ? `?${search}` : window.location.pathname);
  }, [search]);
}
