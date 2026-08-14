import { PerfectTracking } from "perfect-tracking-client";

import { analyze, stateOf, type PreviousState } from "./analyze.js";
import { config } from "./config.js";
import { Course } from "./course.js";
import { pollLine, render } from "./format.js";
import { ReportStore, SampleStore, type Sample } from "./store.js";

const client = new PerfectTracking();

async function main() {
  const course = await Course.load(client);
  const samples = new SampleStore(config.dataDir, config.race);
  const reports = new ReportStore(config.dataDir);

  // Re-reading the log means a restart keeps its history — the first report
  // after a crash is as good as one from a process that never went down.
  const history: Sample[] = samples.load();

  console.log(
    `${course.race.name} · ${config.strecke} · ${course.riders.size} Fahrer · ${course.totalKm.toFixed(1)} km\n` +
      `Poll alle ${config.pollMs / 1000}s, Auswertung alle ${config.reportMs / 60000} min\n` +
      `Samples: ${samples.path} (${history.length} vorhanden)\n`
  );

  let previous: PreviousState | undefined;
  let consecutiveFailures = 0;

  const poll = async () => {
    try {
      const update = await client.getLiveUpdate(course.race.id);
      const serverTime = update.serverTime ?? Math.floor(Date.now() / 1000);

      // A repeated server timestamp is the same tick served twice; storing it
      // would fake a stationary interval for every rider.
      if (history.at(-1)?.serverTime === serverTime) return;

      const riders: Sample["riders"] = {};
      for (const entry of update.update) {
        if (!course.riders.has(entry.id)) continue;
        riders[entry.id] = {
          point: entry.point,
          km: course.kmAt(entry.point),
          speed: entry.speed,
          runtimeSec: entry.runtimesec,
          status: entry.status,
          rang: entry.rang,
          geo: entry.geo,
          station: entry.station,
          finishEst: entry.finishest,
        };
      }

      const sample: Sample = { serverTime, fetchedAt: Date.now(), riders };
      samples.append(sample);

      const before = history.at(-1);
      const moved = before
        ? Object.keys(riders).filter((id) => before.riders[Number(id)]?.point !== riders[Number(id)].point).length
        : 0;
      history.push(sample);
      consecutiveFailures = 0;
      console.log(pollLine(serverTime, Object.keys(riders).length, moved));
    } catch (error) {
      consecutiveFailures++;
      // A single failed poll is normal; a run of them is worth surfacing.
      console.error(
        `[poll] Fehler (${consecutiveFailures} in Folge): ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  const report = () => {
    if (history.length < 2) {
      console.log("[report] noch zu wenige Samples, übersprungen");
      return;
    }
    try {
      const analysis = analyze(history, course, config.reportMs, previous);
      const body = render(analysis);
      const stamp = new Date(analysis.serverTime * 1000).toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const file = reports.write(stamp, body);
      previous = stateOf(analysis);
      console.log(`\n${body}\n[report] -> ${file}\n`);
    } catch (error) {
      console.error(`[report] Fehler: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  await poll();
  const pollTimer = setInterval(poll, config.pollMs);
  const reportTimer = setInterval(report, config.reportMs);

  const shutdown = () => {
    clearInterval(pollTimer);
    clearInterval(reportTimer);
    console.log("\nGestoppt. Samples liegen in", samples.path);
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("Start fehlgeschlagen:", error instanceof Error ? error.message : error);
  process.exit(1);
});
