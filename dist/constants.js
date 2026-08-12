/**
 * Reverse-engineered from the perfect-tracking.com Angular app (main-*.js).
 * The frontend is a thin client over a same-origin JSON API — no WebSocket,
 * just polling. See README.md for how these were found.
 */
/** Same-origin JSON API the Angular app calls as `/api/{Controller}/{Action}/{id?}`. */
export const BASE_URL = "https://race.perfect-tracking.com/api/";
/**
 * Milliseconds between polls. The app uses this for both the live-position
 * updater (`Live/DataLiveUpdateAll`) and the POI layer (`Race/DataPois`).
 */
export const POLL_INTERVAL_MS = 20_000;
/** Participant/team status codes, as returned in `status` fields and used to color badges. */
export const STATUS = {
    1: { color: "race", name: "Race" },
    2: { color: "finished", name: "Finished" },
    3: { color: "dnf", name: "DNF" },
    4: { color: "notstarted", name: "DNS" },
    5: { color: "iofcl", name: "IOFCL" },
    6: { color: "karenzzeit", name: "OTL" },
    7: { color: "waiting", name: "Pre Race" },
    8: { color: "dsq", name: "DSQ" },
};
/** `type` field on a station (checkpoint) — only Start is confirmed from observed data. */
export const STATION_TYPE = {
    0: "Start",
    1: "Checkpoint",
};
//# sourceMappingURL=constants.js.map