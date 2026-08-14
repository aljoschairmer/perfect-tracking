import { config } from "./config.js";
import type { Analysis } from "./analyze.js";

const clock = (unix: number) =>
  new Date(unix * 1000).toLocaleString("de-AT", {
    timeZone: config.timeZone,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const hhmm = (date: Date) =>
  date.toLocaleString("de-AT", { timeZone: config.timeZone, weekday: "short", hour: "2-digit", minute: "2-digit" });

/** `2d 13:29` — the same shape the API uses for elapsed time. */
export function elapsed(hours: number): string {
  const days = Math.floor(hours / 24);
  const rest = hours - days * 24;
  let minutes = Math.round((rest % 1) * 60);
  let hh = Math.floor(rest);
  if (minutes === 60) {
    minutes = 0;
    hh += 1;
  }
  return `${days}d ${String(hh).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function render(analysis: Analysis): string {
  const lines: string[] = [];
  const windowMin = (analysis.windowTo - analysis.windowFrom) / 60;

  lines.push(`# ${config.race} · ${config.group || config.strecke}`);
  lines.push("");
  lines.push(`**Stand ${clock(analysis.serverTime)}** (Serverzeit, ${config.timeZone})`);
  lines.push(
    `Fenster ${windowMin.toFixed(0)} min · ${analysis.samples} Messpunkte · Stillstand ab ${config.stoppedAfterSamples} unveränderten Samples (${((config.stoppedAfterSamples * config.pollMs) / 60000).toFixed(0)} min) · Tempo aus ${(config.paceWindowMs / 60000).toFixed(0)}-min-Rückblick`
  );
  lines.push("");

  if (analysis.feedStalled) {
    lines.push("> **Warnung:** kein einziger Fahrer hat sich bewegt — vermutlich steht der Feed, nicht das Feld.");
    lines.push("");
  }

  if (analysis.events.length) {
    lines.push("## Veränderungen");
    for (const event of analysis.events) lines.push(`- ${event}`);
    lines.push("");
  }

  const racing = analysis.riders.filter((r) => r.racing);
  const out = analysis.riders.filter((r) => !r.racing);

  lines.push("## Im Rennen");
  lines.push("");
  lines.push("| # | Fahrer | km | Rest | verstrichen | Ø | Fenster | Zustand | Ziel (Form) | Veranstalter |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|");
  racing.forEach((r, i) => {
    const state = r.moving
      ? `fährt ${r.windowKmh.toFixed(1)} km/h`
      : `**steht**${r.stoppedForMin ? ` ${r.stoppedForMin.toFixed(0)} min` : ""}`;
    lines.push(
      `| ${i + 1} | ${r.name}${r.bib ? ` (${r.bib})` : ""} | ${r.km.toFixed(1)} | ${r.restKm.toFixed(0)} km / ${r.restHm} hm | ${elapsed(r.elapsedH)} | ${r.avgKmh.toFixed(2)} | ${r.windowKm.toFixed(2)} km | ${state} | ${r.etaAt ? `${elapsed(r.etaElapsedH!)} · ${hhmm(r.etaAt)}` : "—"} | ${r.organiserEta ?? "—"} |`
    );
  });
  lines.push("");

  const leader = racing[0];
  if (leader && racing.length > 1) {
    lines.push("## Abstände zur Spitze");
    lines.push("");
    for (const r of racing.slice(1, 7)) {
      const km = leader.km - r.km;
      // Convert to time with the trailing rider's own pace, not a nominal one,
      // and only when that pace is actually measured.
      const pace = r.windowKmh > 3 ? r.windowKmh : r.avgKmh;
      const hours = pace > 1 ? ` ≈ ${(km / pace).toFixed(2)} h` : "";
      lines.push(`- **${r.name}** ${km.toFixed(1)} km${hours}`);
    }
    lines.push("");
  }

  if (racing.length) {
    lines.push("## Nächste Stationen");
    lines.push("");
    for (const r of racing.slice(0, 5)) {
      lines.push(
        `- ${r.name}: ${r.nextStation ? `${r.nextStation.name} in ${r.nextStation.inKm.toFixed(1)} km` : "im Ziel"}${r.geo ? ` · zuletzt ${r.geo}` : ""}`
      );
    }
    lines.push("");
  }

  if (out.length) {
    lines.push("## Nicht mehr im Rennen");
    lines.push("");
    for (const r of out) {
      lines.push(`- ${r.name}${r.bib ? ` (${r.bib})` : ""} — ${r.statusLabel}, km ${r.km.toFixed(1)}`);
    }
    lines.push("");
  }
  lines.push(
    "_„Ziel (Form)" +
      "\" schreibt das geländebereinigte Tempo des Rückblicks fort — ohne Ermüdungsterm, also eher optimistisch, und nur wenn genug Fahrt beobachtet wurde. Das `speed`-Feld der API wird für die Bewegungserkennung bewusst ignoriert: es meldet 0 auch bei fehlendem GPS-Fix._"
  );
  lines.push("");

  return lines.join("\n");
}

/** One-line heartbeat for the console on every poll. */
export function pollLine(serverTime: number, riders: number, moved: number): string {
  return `[${clock(serverTime)}] ${riders} Fahrer, ${moved} bewegt`;
}
