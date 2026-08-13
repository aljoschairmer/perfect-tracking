import { useMemo } from "react";

import { usePersistentState } from "@/hooks/use-persistent-state";

/**
 * Starred riders, purely client-side. Stored as an array (JSON has no Set) and
 * exposed as one for O(1) membership checks in render loops.
 */
export function useFavorites() {
  const [ids, setIds] = usePersistentState<number[]>("pt-favorites", []);

  const favorites = useMemo(() => new Set(ids), [ids]);

  const toggleFavorite = (id: number) =>
    setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return { favorites, toggleFavorite };
}
