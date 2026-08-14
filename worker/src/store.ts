import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** One poll: every tracked rider's position at one server timestamp. */
export interface Sample {
  /** Server clock (unix seconds) the API generated this data at. */
  serverTime: number;
  /** When we received it, to spot a feed that has stopped advancing. */
  fetchedAt: number;
  riders: Record<number, RiderSample>;
}

export interface RiderSample {
  point: number;
  km: number;
  /** Unreliable as a stop signal — the API reports 0 for "no fix" too. */
  speed: number;
  runtimeSec: number;
  status: number;
  rang: number;
  geo?: string;
  station?: number;
  finishEst?: string;
}

/**
 * Append-only JSONL. Every poll is durable the moment it lands, so a crash
 * costs at most one sample and the whole race can be re-analysed offline
 * without touching the API again.
 */
export class SampleStore {
  private readonly file: string;

  constructor(dataDir: string, race: string) {
    this.file = join(dataDir, `${race}-samples.jsonl`);
    mkdirSync(dirname(this.file), { recursive: true });
  }

  append(sample: Sample): void {
    appendFileSync(this.file, `${JSON.stringify(sample)}\n`);
  }

  /** All samples on disk, oldest first. Malformed lines are skipped, not fatal. */
  load(): Sample[] {
    if (!existsSync(this.file)) return [];
    const out: Sample[] = [];
    for (const line of readFileSync(this.file, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        out.push(JSON.parse(line) as Sample);
      } catch {
        // A partial final line is expected after an unclean shutdown.
      }
    }
    return out;
  }

  get path(): string {
    return this.file;
  }
}

/** Writes each report to a timestamped file and keeps `latest.md` pointing at the newest. */
export class ReportStore {
  constructor(private readonly dataDir: string) {
    mkdirSync(join(dataDir, "reports"), { recursive: true });
  }

  write(stamp: string, body: string): string {
    const file = join(this.dataDir, "reports", `${stamp}.md`);
    writeFileSync(file, body);
    writeFileSync(join(this.dataDir, "latest.md"), body);
    return file;
  }
}
