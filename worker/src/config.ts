/** Runtime configuration, all overridable by environment variable. */
export const config = {
  race: process.env.PT_RACE ?? "raa2026",
  /** Route variant to follow, by name. Falls back to the race's first. */
  strecke: process.env.PT_STRECKE ?? "RAA Extreme",

  /**
   * Sampling interval. Individual trackers report far less often than the
   * site's own 20-second poll — measured live, only 4–12 of 24 riders update
   * per 21-second tick. Two minutes keeps the request volume modest while
   * still giving the report window enough samples to tell a stopped rider
   * from one that simply hasn't reported yet.
   */
  pollMs: Number(process.env.PT_POLL_MS ?? 120_000),

  /** How often to write an analysis. */
  reportMs: Number(process.env.PT_REPORT_MS ?? 900_000),

  /**
   * Lookback used for pace and finish projections, deliberately longer than
   * the report interval. A 15-minute window contains one climb or one descent
   * and extrapolates it over hundreds of kilometres; an hour averages the
   * terrain out.
   */
  paceWindowMs: Number(process.env.PT_PACE_WINDOW_MS ?? 3_600_000),

  /** Below this much observed riding, no finish time is projected at all. */
  minProjectionH: Number(process.env.PT_MIN_PROJECTION_H ?? 0.33),
  minProjectionKm: Number(process.env.PT_MIN_PROJECTION_KM ?? 5),

  /**
   * A rider counts as stopped only after this many consecutive samples with an
   * unchanged position. At a 2-minute cadence that is 10 minutes of silence —
   * shorter windows produce false positives, as a 35 km/h rider can sit
   * between two tracker reports for several minutes.
   */
  stoppedAfterSamples: Number(process.env.PT_STOPPED_AFTER ?? 5),

  /** Race-local timezone. Every timestamp the API returns is in this zone. */
  timeZone: process.env.PT_TZ ?? "Europe/Vienna",

  /** Group to report on, by name. Empty reports every rider on the variant. */
  group: process.env.PT_GROUP ?? "RAA Extreme Solo",

  dataDir: process.env.PT_DATA_DIR ?? new URL("../data/", import.meta.url).pathname,

  /**
   * Flat-kilometre cost of 100 m of climbing, calibrated against 252 clean
   * segments across eight riders of this race (rel. RMSE 16.7 %).
   */
  climbEquivalentKm: 5.25,
};

export type Config = typeof config;
