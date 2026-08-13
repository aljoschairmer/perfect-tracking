/**
 * The API expresses every duration as a string ("2d 03:39", "08:57") and every
 * moment as a weekday-plus-clock string ("Sa. 20:21") — there are no epochs
 * anywhere. These helpers turn both into numbers that can be compared, and
 * format the differences back into the same style the API uses.
 */

/** "2d 03:39" or "08:57" → seconds. Minute resolution, like the source. */
export function runtimeToSec(runtime: string | undefined): number | undefined {
  if (!runtime) return undefined;
  const match = /^(?:(\d+)d\s+)?(\d+):(\d{2})$/.exec(runtime.trim());
  if (!match) return undefined;
  return Number(match[1] ?? 0) * 86_400 + Number(match[2]) * 3_600 + Number(match[3]) * 60;
}

/** Seconds → "2d 03:39" / "8:57", mirroring the API's own duration style. */
export function fmtDuration(sec: number): string {
  const days = Math.floor(sec / 86_400);
  const hours = Math.floor((sec % 86_400) / 3_600);
  const minutes = Math.round((sec % 3_600) / 60);
  const hm = `${days ? String(hours).padStart(2, "0") : hours}:${String(minutes).padStart(2, "0")}`;
  return days ? `${days}d ${hm}` : hm;
}

/** Difference to a best time, always as "+h:mm" — hours don't wrap into days. */
export function fmtGap(sec: number): string {
  if (sec < 60) return "±0:00";
  const hours = Math.floor(sec / 3_600);
  const minutes = Math.floor((sec % 3_600) / 60);
  return `+${hours}:${String(minutes).padStart(2, "0")}`;
}

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/**
 * Sort key for weekday-clock strings like "Sa. 20:21" (ETAs, checkpoint
 * times). The weekday alone can't order a multi-day race, so days are
 * unwrapped relative to the race's start weekday: anything "before" the start
 * day is read as the following week. Races longer than seven days would wrap —
 * an approximation this data format can't avoid.
 */
export function clockSortKey(clock: string | undefined, raceStartDay: number): number | undefined {
  if (!clock) return undefined;
  const match = /^(\w{2})\.?\s.*?(\d{1,2}):(\d{2})$/.exec(clock.trim());
  if (!match) return undefined;
  const day = WEEKDAYS.indexOf(match[1]);
  if (day < 0) return undefined;
  const dayOffset = (day - raceStartDay + 7) % 7;
  return dayOffset * 1_440 + Number(match[2]) * 60 + Number(match[3]);
}

/** "Mi. 12. Aug 18:36" → "Mi. 18:36" — the date adds nothing next to a weekday. */
export function shortClock(clock: string): string {
  return clock.replace(/^(\w+\.)\s+\d+\.\s+\w+\s+/, "$1 ");
}
