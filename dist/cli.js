#!/usr/bin/env node
import { PerfectTracking } from "./client.js";
import { parseResultRow } from "./parse.js";
const HELP = `perfect-tracking — query the perfect-tracking.com live race API

Usage:
  ptrack races                       List public races
  ptrack race <slug>                 Race details (route variants, times)
  ptrack live <slug> [options]       Live positions (one snapshot, or --watch)
  ptrack results <slug> [options]    Results table
  ptrack pois <slug>                 Points of interest on the live map

Options:
  --strecke <id>    Restrict to one route variant (default: all)
  --watch           (live) keep polling every --interval and print updates
  --interval <ms>   (live --watch) poll interval, default 20000 (matches the web app)
  --json            Output JSON instead of a table

Examples:
  ptrack races
  ptrack race raa2026
  ptrack live raa2026 --json
  ptrack live raa2026 --watch
  ptrack results raa2026 --strecke 71
`;
function parseArgs(argv) {
    const flags = {};
    const positional = [];
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a.startsWith("--")) {
            const key = a.slice(2);
            const next = argv[i + 1];
            if (next == null || next.startsWith("--")) {
                flags[key] = true;
            }
            else {
                flags[key] = next;
                i++;
            }
        }
        else {
            positional.push(a);
        }
    }
    const cmd = positional.shift() ?? "races";
    return { cmd, positional, flags };
}
function fmtTable(rows) {
    if (rows.length === 0)
        return "";
    const widths = rows[0].map((_, c) => Math.max(...rows.map((r) => (r[c] ?? "").length)));
    return rows.map((r) => r.map((cell, c) => (cell ?? "").padEnd(widths[c])).join("  ")).join("\n");
}
async function main() {
    const { cmd, positional, flags } = parseArgs(process.argv.slice(2));
    if (flags.help || cmd === "help") {
        console.log(HELP);
        return;
    }
    const client = new PerfectTracking();
    if (cmd === "races") {
        const races = await client.listRaces();
        if (flags.json) {
            console.log(JSON.stringify(races, null, 2));
            return;
        }
        const rows = [
            ["Slug", "Name", "Start", "Stop"],
            ...races.map((r) => [r.sname, r.name, r.starttime, r.stoptime]),
        ];
        console.log(fmtTable(rows));
        return;
    }
    const slug = positional[0];
    if (!slug && cmd !== "help") {
        console.error(`"${cmd}" needs a race slug, e.g. \`ptrack ${cmd} raa2026\`. See \`ptrack --help\`.`);
        process.exit(1);
    }
    if (cmd === "race") {
        const race = await client.getRace(slug);
        console.log(JSON.stringify(race, null, 2));
        return;
    }
    const race = await client.getRace(slug);
    const streckeId = flags.strecke ? Number(flags.strecke) : -1;
    if (cmd === "pois") {
        const { pois } = await client.getPois(race.id);
        console.log(JSON.stringify(pois, null, 2));
        return;
    }
    if (cmd === "results") {
        const snapshot = streckeId !== -1 ? await client.getResults(streckeId) : await client.getResultsAll(race.id);
        const parsed = snapshot.gruppen.map((g) => ({ group: g.name, results: g.data.map(parseResultRow) }));
        if (flags.json) {
            console.log(JSON.stringify(parsed, null, 2));
            return;
        }
        for (const g of parsed) {
            console.log(`\n${g.group}`);
            const rows = [
                ["Rank", "Name", "Bib", "Status", "Runtime", "Avg km/h", "Last seen"],
                ...g.results.map((r) => [
                    String(r.rank),
                    r.name,
                    r.startnummer,
                    r.status,
                    r.runtime,
                    String(r.avgSpeedKmh),
                    r.location,
                ]),
            ];
            console.log(fmtTable(rows));
        }
        return;
    }
    if (cmd === "live") {
        const printSnapshot = (update) => {
            if (flags.json) {
                console.log(JSON.stringify(update, null, 2));
                return;
            }
            const rows = [
                ["Bib/Id", "Rank", "Speed", "Status", "Location", "Last update"],
                ...update.update.map((u) => [
                    String(u.id),
                    String(u.rang),
                    `${u.speed} km/h`,
                    String(u.status),
                    u.geo ?? "-",
                    u.stationtime ?? "-",
                ]),
            ];
            console.log(fmtTable(rows));
        };
        if (!flags.watch) {
            const update = await client.getLiveUpdate(race.id);
            printSnapshot(update);
            return;
        }
        const intervalMs = flags.interval ? Number(flags.interval) : undefined;
        console.log(`Watching ${slug} — polling every ${intervalMs ?? 20000}ms. Ctrl+C to stop.\n`);
        for await (const update of client.watchLive(race.id, { intervalMs })) {
            console.clear();
            console.log(`${slug} — live (updated ${new Date().toLocaleTimeString()})\n`);
            printSnapshot(update);
        }
        return;
    }
    console.error(`Unknown command "${cmd}". See \`ptrack --help\`.`);
    process.exit(1);
}
main().catch((err) => {
    console.error("Error:", err instanceof Error ? err.message : err);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map