/**
 * Browser counterpart of `html.ts`, selected through the `browser` field in
 * package.json. It uses the DOM the page already has, so no HTML parser needs
 * to be bundled. Behaviour must stay identical to the Node implementation.
 */
export function normalizeBreaks(html) {
    return html.replace(/<br\s*\/?>/gi, " ");
}
function parseBody(html) {
    return new DOMParser().parseFromString(html, "text/html").body;
}
export function htmlToText(html) {
    return parseBody(normalizeBreaks(html)).textContent ?? "";
}
export function badgeClasses(html) {
    const span = parseBody(html).querySelector("span.badge");
    return span ? Array.from(span.classList) : [];
}
//# sourceMappingURL=html.browser.js.map