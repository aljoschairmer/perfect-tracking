import { PerfectTracking } from "perfect-tracking-client";

/**
 * The tracking API sends no CORS headers, so the browser talks to it through
 * this app's own origin — `vite.config.ts` proxies `/api` upstream in dev, and
 * any static host can do the same with a rewrite rule.
 */
export const client = new PerfectTracking({ baseUrl: "/api/" });
