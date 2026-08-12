import { useEffect, useState } from "react";

/**
 * Resolves CSS custom properties to concrete colour values.
 *
 * Leaflet paints markers onto a canvas, where `var(--x)` means nothing — the
 * values have to be read from the cascade first. Re-reads whenever the theme
 * class on <html> changes, so the map follows light/dark like everything else.
 */
export function useThemeTokens(names: readonly string[]): Record<string, string> {
  const key = names.join(",");
  const [tokens, setTokens] = useState<Record<string, string>>({});

  useEffect(() => {
    const read = () => {
      const styles = getComputedStyle(document.documentElement);
      setTokens(Object.fromEntries(names.map((name) => [name, styles.getPropertyValue(name).trim()])));
    };

    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return tokens;
}

export const GROUP_TOKENS = Array.from({ length: 10 }, (_, i) => `--group-${i}`);

export const MAP_TOKENS = [
  "--foreground",
  "--background",
  "--muted-foreground",
  "--primary",
  ...GROUP_TOKENS,
] as const;
