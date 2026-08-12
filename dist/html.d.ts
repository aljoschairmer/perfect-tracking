/**
 * HTML extraction for Node. The browser build swaps this module for
 * `html.browser.ts` via the `browser` field in package.json, which keeps the
 * ~250 kB parser out of bundles that already ship a DOM.
 *
 * Both implementations must agree exactly, so line breaks are normalised to a
 * space here rather than left to each parser's own textContent rules.
 */
export declare function normalizeBreaks(html: string): string;
export declare function htmlToText(html: string): string;
export declare function badgeClasses(html: string): string[];
//# sourceMappingURL=html.d.ts.map