/**
 * Browser counterpart of `html.ts`, selected through the `browser` field in
 * package.json. It uses the DOM the page already has, so no HTML parser needs
 * to be bundled. Behaviour must stay identical to the Node implementation.
 */
export declare function normalizeBreaks(html: string): string;
export declare function htmlToText(html: string): string;
export declare function badgeClasses(html: string): string[];
//# sourceMappingURL=html.browser.d.ts.map