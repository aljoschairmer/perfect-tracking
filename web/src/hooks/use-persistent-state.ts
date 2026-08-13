import { useEffect, useState } from "react";

/**
 * useState that survives a reload. Without it every refresh resets favourites,
 * sort mode and filters to their defaults — mid-race, with the page open for
 * days, that gets old fast. Storage failures (private mode, quota) are
 * non-fatal: the state simply lives for the session only.
 */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Privatmodus o. ä. — dann eben nicht.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
