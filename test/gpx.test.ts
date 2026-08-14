import { test } from "node:test";
import assert from "node:assert/strict";
import { toGpx, stationWaypoints } from "../dist/gpx.js";
import type { RoutePoint, StationDetail } from "../dist/types.js";

const TRACK: RoutePoint[] = [
  [47.93346, 13.49081, 0, 542.79],
  [47.93348, 13.49075, 0.01, 542.6],
  [47.93353, 13.49064, 0.02, 542.23],
  [47.93359, 13.4905, 0.03, 541.35],
  [47.93366, 13.49034, 0.04, 539.67],
];

test("toGpx emits a valid GPX 1.1 track with elevation", () => {
  const xml = toGpx(TRACK, { name: "Testroute" });
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<gpx version="1\.1"[^>]*xmlns="http:\/\/www\.topografix\.com\/GPX\/1\/1"/);
  assert.equal(xml.match(/<trkpt /g)?.length, TRACK.length);
  assert.match(xml, /<trkpt lat="47\.93346" lon="13\.49081"><ele>542\.8<\/ele><\/trkpt>/);
  assert.match(xml, /<name>Testroute<\/name>/);
});

test("everyNth thins the track but always keeps the finish", () => {
  const xml = toGpx(TRACK, { everyNth: 2 });
  const points = xml.match(/<trkpt /g)?.length ?? 0;
  // indices 0, 2, 4 — index 4 is already the last, so no extra closing point
  assert.equal(points, 3);
  assert.match(xml, /lat="47\.93366" lon="13\.49034"/);

  // with a step that skips the last point, it gets appended back
  const xml3 = toGpx(TRACK, { everyNth: 3 });
  assert.equal(xml3.match(/<trkpt /g)?.length, 3); // 0, 3 + appended 4
  assert.match(xml3, /lat="47\.93366"/);
});

test("XML metacharacters in names are escaped", () => {
  const xml = toGpx(TRACK, {
    name: 'Tom & Jerry <script>"x"',
    waypoints: [{ lat: 1, lon: 2, name: "A & B" }],
  });
  assert.match(xml, /<name>Tom &amp; Jerry &lt;script&gt;&quot;x&quot;<\/name>/);
  assert.match(xml, /<name>A &amp; B<\/name>/);
  assert.ok(!xml.includes("<script>"));
});

test("stationWaypoints resolves each station onto the track", () => {
  const stations: StationDetail[] = [
    { id: 1, name: "Start", link: "/x", point: 0, rank: 0, type: 0, altitude: 542, way: "0,00", show: true },
    { id: 2, name: "Ende", link: "/y", point: 4, rank: 1, type: 1, altitude: 540, way: "0,04", show: true },
  ];
  const wpts = stationWaypoints(stations, TRACK);
  assert.equal(wpts.length, 2);
  assert.deepEqual({ lat: wpts[0].lat, lon: wpts[0].lon }, { lat: 47.93346, lon: 13.49081 });
  assert.equal(wpts[1].name, "Ende");
  assert.match(wpts[1].description!, /km 0,04/);
});

test("a station index beyond the track clamps to the finish", () => {
  const stations: StationDetail[] = [
    { id: 9, name: "Ziel", link: "/z", point: 9_999, rank: 2, type: 1, altitude: 500, way: "0,04", show: true },
  ];
  const [wpt] = stationWaypoints(stations, TRACK);
  assert.equal(wpt.lat, TRACK.at(-1)![0]);
});
