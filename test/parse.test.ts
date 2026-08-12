import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseResultRow,
  parseParticipantStationRow,
  parseStationResultRow,
  sanitizeBadge,
  sanitizeText,
} from "../dist/parse.js";
import type { ParticipantStationRow, ResultRow, StationResultRow } from "../dist/types.js";

test("sanitizeBadge extracts plain text and the color class from a badge span", () => {
  const { text, colorClass } = sanitizeBadge('<span class="badge race">Race</span>');
  assert.equal(text, "Race");
  assert.equal(colorClass, "race");
});

test("sanitizeBadge tolerates nested/extra markup and whitespace a regex would mishandle", () => {
  const { text, colorClass } = sanitizeBadge('<span class="badge dnf">  DNF <b>*</b>  </span>');
  assert.equal(text, "DNF *");
  assert.equal(colorClass, "dnf");
});

test("sanitizeText collapses whitespace and strips stray markup", () => {
  assert.equal(sanitizeText("Herbert Manz*"), "Herbert Manz*");
  assert.equal(sanitizeText("  Kötschach   Mauthen "), "Kötschach Mauthen");
  assert.equal(sanitizeText("A<br>B"), "A B");
});

test("parseResultRow turns a raw ResultRow tuple into a sanitized object", () => {
  const row: ResultRow = [
    '<span class="badge race">Race</span>',
    ["Sara Mazzorana", "/race/raa2026/teilnehmer/2547"],
    "19",
    "Kötschach Mauthen",
    1,
    "2d 02:35",
    "00:00 ",
    "22,74",
    "Mi. 12. Aug 23:09",
  ];
  const parsed = parseResultRow(row);
  assert.equal(parsed.status, "Race");
  assert.equal(parsed.statusColor, "race");
  assert.equal(parsed.name, "Sara Mazzorana");
  assert.equal(parsed.link, "/race/raa2026/teilnehmer/2547");
  assert.equal(parsed.rank, 1);
  assert.equal(parsed.avgSpeedKmh, 22.74);
});

test("parseParticipantStationRow parses a splits row", () => {
  const row: ParticipantStationRow = [
    1,
    ["Straßwalchen", "/race/raa2026/station/1626"],
    "22,12",
    523,
    1,
    "00:32",
    "00:00 ",
    "41,48",
    "Mi. 12. Aug 18:40",
  ];
  const parsed = parseParticipantStationRow(row);
  assert.equal(parsed.station, "Straßwalchen");
  assert.equal(parsed.distanceKm, 22.12);
  assert.equal(parsed.altitude, 523);
  assert.equal(parsed.avgSpeedKmh, 41.48);
});

test("parseStationResultRow parses a checkpoint leaderboard row", () => {
  const row: StationResultRow = [
    1,
    '<span class="badge race">Race</span>',
    ["Yvonne Margraf", "/race/raa2026/teilnehmer/2546"],
    "20",
    "1d 22:04",
    "00:00 ",
    "23,27",
    "Mi. 12. Aug 18:36",
  ];
  const parsed = parseStationResultRow(row);
  assert.equal(parsed.rank, 1);
  assert.equal(parsed.status, "Race");
  assert.equal(parsed.statusColor, "race");
  assert.equal(parsed.name, "Yvonne Margraf");
});
