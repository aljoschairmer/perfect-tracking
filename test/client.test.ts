import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PerfectTracking } from "../dist/client.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => JSON.parse(readFileSync(join(here, "fixtures", name), "utf8"));

/** Map API paths (as the client builds them) straight to fixture files. */
const ROUTES: Record<string, string> = {
  "Race/Races": "races.json",
  "Race/Race/raa2026": "race.json",
  "Race/DataStrecke/71": "strecke.json",
  "Race/DataStreckeAll/43": "strecke-all.json",
  "Race/DataRoute/71": "route.json",
  "Race/DataRouteAll/43": "route-all.json",
  "Race/DataPois/43": "pois.json",
  "Ergebnisse/DataAll/43": "ergebnisse.json",
  "Race/DataPageTeilnehmer/2647": "teilnehmer.json",
  "Race/DataPageStation/1668": "station.json",
  "Live/DataLiveAll/43": "live-init.json",
  "Live/DataLiveUpdateAll/43": "live-update.json",
};

function fakeFetch(calls: string[] = []): typeof fetch {
  return (async (input: string | URL) => {
    const url = String(input);
    calls.push(url);
    const path = url.replace("https://fake.example/api/", "");
    const file = ROUTES[path];
    if (!file) throw new Error(`no fixture mapped for path "${path}"`);
    return new Response(JSON.stringify(fixture(file)), { status: 200 });
  }) as typeof fetch;
}

function makeClient(calls: string[] = []) {
  return new PerfectTracking({ baseUrl: "https://fake.example/api/", fetch: fakeFetch(calls) });
}

test("listRaces unwraps the data envelope", async () => {
  const client = makeClient();
  const races = await client.listRaces();
  assert.ok(Array.isArray(races));
  assert.equal(races[0].sname, "raa2026");
  assert.equal(races[0].name, "RaceAroundAustria 2026");
});

test("getRace builds the correct path and returns strecken", async () => {
  const calls: string[] = [];
  const client = makeClient(calls);
  const race = await client.getRace("raa2026");
  assert.deepEqual(calls, ["https://fake.example/api/Race/Race/raa2026"]);
  assert.equal(race.id, 43);
  assert.equal(race.strecken.length, 3);
  assert.ok(race.strecken.some((s) => s.id === 71 && s.name === "RAA Extreme"));
});

test("getStrecke returns detailed stations for one route variant", async () => {
  const client = makeClient();
  const strecke = await client.getStrecke(71);
  assert.ok(strecke.stations.length > 0);
  assert.equal(strecke.stations[0].name, "Start");
  assert.equal(typeof strecke.stations[0].altitude, "number");
});

test("getStreckeAll returns the lighter station shape for every route variant", async () => {
  const client = makeClient();
  const { routes } = await client.getStreckeAll(43);
  assert.equal(routes.length, 3);
  const raaExtreme = routes.find((r) => r.id === 71);
  assert.ok(raaExtreme);
  assert.equal(raaExtreme.stationen[0].name, "Start");
});

test("getRoute returns the raw [lat, lon, km, elevation] track", async () => {
  const client = makeClient();
  const route = await client.getRoute(71);
  const [lat, lon, km, elevation] = route.route[0];
  assert.equal(typeof lat, "number");
  assert.equal(typeof lon, "number");
  assert.equal(km, 0);
  assert.ok(elevation > 0);
});

test("getRouteAll returns one track per route variant, each carrying its id", async () => {
  const client = makeClient();
  const { routes } = await client.getRouteAll(43);
  assert.equal(routes.length, 3);
  assert.ok(routes.every((r) => typeof r.id === "number" && r.data.length > 0));
});

test("getPois returns the poi list", async () => {
  const client = makeClient();
  const { pois } = await client.getPois(43);
  assert.ok(Array.isArray(pois));
});

test("getResultsAll returns groups of raw result rows", async () => {
  const client = makeClient();
  const snapshot = await client.getResultsAll(43);
  assert.ok(snapshot.gruppen.length > 0);
  const [row] = snapshot.gruppen[0].data;
  assert.match(row[0], /badge/);
  assert.ok(Array.isArray(row[1]));
});

test("getParticipantPage returns splits for one participant", async () => {
  const client = makeClient();
  const page = await client.getParticipantPage(2647);
  assert.equal(page.startnummer, "C-207");
  assert.ok(page.stationen.length > 0);
});

test("getStationPage returns a checkpoint leaderboard", async () => {
  const client = makeClient();
  const page = await client.getStationPage(1668);
  assert.ok(page.gruppen.length > 0);
});

test("getLiveInitAll returns groups + participants", async () => {
  const client = makeClient();
  const snapshot = await client.getLiveInitAll(43);
  assert.ok(snapshot.gruppen.length > 0);
  assert.ok(snapshot.teilnehmer.length > 0);
  assert.equal(snapshot.teilnehmer[0].name, "1OF1 Bikes / Hemetsberger Dach");
});

test("getLiveUpdate returns positional deltas", async () => {
  const client = makeClient();
  const snapshot = await client.getLiveUpdate(43);
  assert.ok(snapshot.update.length > 0);
  const entry = snapshot.update.find((u) => u.id === 2647);
  assert.ok(entry);
  assert.equal(typeof entry.point, "number");
  assert.equal(typeof entry.speed, "number");
});

test("watchLive yields one snapshot per poll and stops on abort", async () => {
  const client = makeClient();
  const controller = new AbortController();
  const seen: number[] = [];
  for await (const update of client.watchLive(43, { intervalMs: 1, signal: controller.signal })) {
    seen.push(update.update.length);
    controller.abort();
  }
  assert.equal(seen.length, 1);
});

test("polled endpoints expose the envelope's server clock as serverTime", async () => {
  const client = makeClient();
  const update = await client.getLiveUpdate(43);
  const init = await client.getLiveInitAll(43);
  const pois = await client.getPois(43);
  // the fixtures carry the upstream `time` value alongside `data`
  assert.equal(update.serverTime, fixture("live-update.json").time);
  assert.equal(init.serverTime, fixture("live-init.json").time);
  assert.equal(pois.serverTime, fixture("pois.json").time);
  assert.equal(typeof update.serverTime, "number");
});

test("request() returns the whole envelope for any endpoint", async () => {
  const client = makeClient();
  const body = await client.request<{ pois: unknown[] }>("Race/DataPois/43");
  assert.ok(body.data);
  assert.equal(body.time, fixture("pois.json").time);
});

test("the default fetch keeps its global receiver (browsers reject any other)", async () => {
  const original = globalThis.fetch;
  // Stand in for the browser's strict check: real `fetch` throws "Illegal
  // invocation" when its `this` is not the global object.
  const strict = function (this: unknown) {
    if (this !== globalThis && this !== undefined) throw new TypeError("Illegal invocation");
    return Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }));
  } as unknown as typeof fetch;

  globalThis.fetch = strict;
  try {
    const client = new PerfectTracking();
    await assert.doesNotReject(() => client.listRaces());
  } finally {
    globalThis.fetch = original;
  }
});

test("isRaceLive: test races are always live", () => {
  const client = new PerfectTracking({ fetch: fakeFetch() });
  assert.equal(client.isRaceLive({ test: true, ustoptime: 0 }), true);
});

test("isRaceLive: compares ustoptime against now", () => {
  const client = new PerfectTracking({ fetch: fakeFetch() });
  const now = new Date("2026-08-12T00:00:00Z");
  assert.equal(client.isRaceLive({ test: false, ustoptime: now.getTime() / 1000 + 3600 }, now), true);
  assert.equal(client.isRaceLive({ test: false, ustoptime: now.getTime() / 1000 - 3600 }, now), false);
});
