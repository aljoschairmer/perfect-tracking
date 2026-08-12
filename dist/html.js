import { parse } from "node-html-parser";
/**
 * HTML extraction for Node. The browser build swaps this module for
 * `html.browser.ts` via the `browser` field in package.json, which keeps the
 * ~250 kB parser out of bundles that already ship a DOM.
 *
 * Both implementations must agree exactly, so line breaks are normalised to a
 * space here rather than left to each parser's own textContent rules.
 */
export function normalizeBreaks(html) {
    return html.replace(/<br\s*\/?>/gi, " ");
}
export function htmlToText(html) {
    return parse(normalizeBreaks(html)).textContent;
}
export function badgeClasses(html) {
    const span = parse(html).querySelector("span.badge");
    return span ? span.classList.value : [];
}
//# sourceMappingURL=html.js.map