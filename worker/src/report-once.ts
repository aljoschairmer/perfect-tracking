import { PerfectTracking } from "perfect-tracking-client";

import { analyze } from "./analyze.js";
import { config } from "./config.js";
import { Course } from "./course.js";
import { render } from "./format.js";
import { SampleStore } from "./store.js";

/**
 * Renders an analysis from whatever the worker has already collected, without
 * waiting for the next scheduled one. Reads only — safe to run against a
 * running worker.
 */
const course = await Course.load(new PerfectTracking());
const samples = new SampleStore(config.dataDir, config.race).load();

if (samples.length < 2) {
  console.error(`Zu wenige Samples (${samples.length}). Läuft der Worker?`);
  process.exit(1);
}

const windowMs = Number(process.argv[2]) * 60_000 || config.reportMs;
console.log(render(analyze(samples, course, windowMs)));
