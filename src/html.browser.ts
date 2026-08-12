/**
 * Browser counterpart of `html.ts`, selected through the `browser` field in
 * package.json. It uses the DOM the page already has, so no HTML parser needs
 * to be bundled. Behaviour must stay identical to the Node implementation.
 */
export function normalizeBreaks(html: string): string {
  return html.replace(/<br\s*\/?>/gi, " ");
}

function parseBody(html: string): HTMLElement {
  return new DOMParser().parseFromString(html, "text/html").body;
}

export function htmlToText(html: string): string {
  return parseBody(normalizeBreaks(html)).textContent ?? "";
}

export function badgeClasses(html: string): string[] {
  const span = parseBody(html).querySelector("span.badge");
  return span ? Array.from(span.classList) : [];
}
