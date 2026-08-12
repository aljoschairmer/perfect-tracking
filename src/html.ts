import { parse } from "node-html-parser";

/**
 * HTML extraction for Node. The browser build swaps this module for
 * `html.browser.ts` via the `browser` field in package.json, which keeps the
 * ~250 kB parser out of bundles that already ship a DOM.
 *
 * Both implementations must agree exactly, so line breaks are normalised to a
 * space here rather than left to each parser's own textContent rules.
 */
export function normalizeBreaks(html: string): string {
  return html.replace(/<br\s*\/?>/gi, " ");
}

export function htmlToText(html: string): string {
  return parse(normalizeBreaks(html)).textContent;
}

export function badgeClasses(html: string): string[] {
  const span = parse(html).querySelector("span.badge");
  return span ? span.classList.value : [];
}
