/**
 * Reverse-engineered from the perfect-tracking.com Angular app (main-*.js).
 * The frontend is a thin client over a same-origin JSON API — no WebSocket,
 * just polling. See README.md for how these were found.
 */
/** Same-origin JSON API the Angular app calls as `/api/{Controller}/{Action}/{id?}`. */
export declare const BASE_URL = "https://race.perfect-tracking.com/api/";
/**
 * Milliseconds between polls. The app uses this for both the live-position
 * updater (`Live/DataLiveUpdateAll`) and the POI layer (`Race/DataPois`).
 */
export declare const POLL_INTERVAL_MS = 20000;
/** Participant/team status codes, as returned in `status` fields and used to color badges. */
export declare const STATUS: {
    readonly 1: {
        readonly color: "race";
        readonly name: "Race";
    };
    readonly 2: {
        readonly color: "finished";
        readonly name: "Finished";
    };
    readonly 3: {
        readonly color: "dnf";
        readonly name: "DNF";
    };
    readonly 4: {
        readonly color: "notstarted";
        readonly name: "DNS";
    };
    readonly 5: {
        readonly color: "iofcl";
        readonly name: "IOFCL";
    };
    readonly 6: {
        readonly color: "karenzzeit";
        readonly name: "OTL";
    };
    readonly 7: {
        readonly color: "waiting";
        readonly name: "Pre Race";
    };
    readonly 8: {
        readonly color: "dsq";
        readonly name: "DSQ";
    };
};
export type StatusCode = keyof typeof STATUS;
/** `type` field on a station (checkpoint) — only Start is confirmed from observed data. */
export declare const STATION_TYPE: Record<number, string>;
//# sourceMappingURL=constants.d.ts.map