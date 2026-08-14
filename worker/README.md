# perfect tracking — worker

Polls the live feed every 2 minutes, writes an analysis every 15 minutes.

```bash
npm install
npm start          # build + run
npm run report -- 60   # render a report from stored samples, 60-minute window
```

Samples land in `data/<race>-samples.jsonl`, reports in `data/reports/`, and
the newest is always `data/latest.md`.

## Why two cadences

The two intervals do different jobs, and the 2-minute one is not arbitrary.

Individual trackers report far less often than the site's own 20-second poll —
measured live, only **4–12 of 24 riders update per 21-second tick**. A short
observation window therefore cannot tell a stopped rider from one who simply
has not reported yet: a 2-minute check called a rider doing 35 km/h "stopped".

So sampling every 2 minutes and judging movement over **5 consecutive
unchanged samples (10 minutes)** is what makes the stop detection trustworthy,
and the 15-minute report always has 7–8 samples to work with.

## What it does not trust

The API's `speed` field reports `0` both for "standing still" and for "no
current GPS fix" — verified against position deltas, riders doing 18 km/h were
reporting `0` in six of eight consecutive polls. It is displayed but never used
to decide whether someone is moving. **Position is the only movement signal.**

## Report contents

- **Veränderungen** — what changed since the previous report: stops starting
  and ending, checkpoints passed, position swaps, status changes. This is the
  part a periodic worker exists for; a snapshot alone cannot produce it.
- **Im Rennen** — position, remaining distance and climbing, elapsed, average,
  distance covered in the window, movement state, projected finish.
- **Abstände zur Spitze**, **Nächste Stationen**, **Nicht mehr im Rennen**.

Riders who have abandoned are listed separately — otherwise they would count
as "stopped" forever and trip the feed-stall warning.

### The finish projection

`Ziel (Form)` extrapolates the rider's terrain-adjusted pace over the
remaining course, using the same equivalence as the rest of this repo:
**100 m of climbing ≈ 5.25 flat km**, calibrated against 252 clean segments of
this race.

Two deliberate limits:

- It uses a **60-minute lookback**, not the 15-minute report window. A quarter
  hour may contain nothing but one climb, and extrapolating that over 300 km is
  meaningless.
- It prints nothing at all until it has seen at least 20 minutes and 5 km of
  actual riding. An empty column is better than a fabricated time.

There is **no fatigue term**, so read it as a floor. The offline model in this
repo's analyses adds one; it moves predictions roughly 10 % later.

## Configuration

Every value is an environment variable:

| Variable | Default | Meaning |
| --- | --- | --- |
| `PT_RACE` | `raa2026` | race slug |
| `PT_STRECKE` | `RAA Extreme` | route variant |
| `PT_GROUP` | `RAA Extreme Solo` | group filter, empty for all |
| `PT_POLL_MS` | `120000` | sampling interval |
| `PT_REPORT_MS` | `900000` | report interval |
| `PT_PACE_WINDOW_MS` | `3600000` | lookback for pace and projection |
| `PT_STOPPED_AFTER` | `5` | unchanged samples before "stopped" |
| `PT_TZ` | `Europe/Vienna` | display timezone — the race's own |
| `PT_DATA_DIR` | `./data` | where samples and reports go |

## Durability

Samples are appended to JSONL the moment they arrive, so a crash costs at most
one poll. On restart the worker reloads the log, meaning the first report after
a restart is as complete as one from a process that never went down. Repeated
server timestamps are dropped — the same tick served twice would otherwise fake
a stationary interval for every rider.
