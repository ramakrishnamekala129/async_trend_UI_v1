import { NextResponse } from "next/server";
import * as swe from "@swisseph/node";

type AspectRow = Record<string, string | number>;

const LATITUDE = 19.054999;
const LONGITUDE = 72.8692035;
const SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces"
];

const DEFAULT_ASPECTS = [0, 22.5, 30, 36, 45, 60, 72, 90, 120, 135, 144, 150, 180];
const BULLISH_PAIRS = new Set([
  "Aries|Pisces",
  "Taurus|Gemini",
  "Cancer|Leo",
  "Virgo|Libra",
  "Scorpio|Sagittarius",
  "Capricorn|Aquarius",
  "Aries|Scorpio",
  "Taurus|Libra",
  "Gemini|Capricorn",
  "Cancer|Sagittarius",
  "Leo|Pisces",
  "Virgo|Aquarius"
]);
const BEARISH_PAIRS = new Set([
  "Libra|Scorpio",
  "Sagittarius|Capricorn",
  "Aquarius|Pisces",
  "Aries|Taurus",
  "Gemini|Cancer",
  "Leo|Virgo",
  "Aries|Virgo",
  "Taurus|Sagittarius",
  "Gemini|Scorpio",
  "Cancer|Aquarius",
  "Leo|Capricorn",
  "Libra|Pisces"
]);
const ANGLE_BULLISH = new Set([36, 60, 72, 120, 144]);
const ANGLE_DEPENDS = new Set([30, 150, 180]);
const ANGLE_BEARISH = new Set([22.5, 45, 90, 135]);

const PLANETS = [
  { key: "Sun", body: swe.Planet.Sun },
  { key: "Moon", body: swe.Planet.Moon },
  { key: "Mercury", body: swe.Planet.Mercury },
  { key: "Venus", body: swe.Planet.Venus },
  { key: "Mars", body: swe.Planet.Mars },
  { key: "Jupiter", body: swe.Planet.Jupiter },
  { key: "Saturn", body: swe.Planet.Saturn },
  { key: "Uranus", body: swe.Planet.Uranus },
  { key: "Neptune", body: swe.Planet.Neptune },
  { key: "Pluto", body: swe.Planet.Pluto },
  { key: "Rahu", body: 10 as unknown as swe.Planet }
] as const;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function normalizeDegrees(value: number): number {
  const result = value % 360;
  return result < 0 ? result + 360 : result;
}

function toIstParts(date: Date) {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  const year = ist.getUTCFullYear();
  const month = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const day = String(ist.getUTCDate()).padStart(2, "0");
  const hh = String(ist.getUTCHours()).padStart(2, "0");
  const mm = String(ist.getUTCMinutes()).padStart(2, "0");
  return {
    dateKey: `${year}-${month}-${day}`,
    timeKey: `${hh}:${mm}`,
    dtKey: `${year}-${month}-${day} ${hh}:${mm}`
  };
}

function signName(deg: number): string {
  return SIGNS[Math.floor(normalizeDegrees(deg) / 30) % 12] ?? "Unknown";
}

function shortestAngleDiff(left: number, right: number): number {
  let diff = Math.abs(normalizeDegrees(left) - normalizeDegrees(right));
  if (diff > 180) diff = 360 - diff;
  return diff;
}

function flipSignal(value: string): string {
  if (value === "bullish") return "bearish";
  if (value === "bearish") return "bullish";
  return value;
}

function classifyBySigns(sign1: string, sign2: string): "bullish" | "bearish" | "neutral" {
  if (BULLISH_PAIRS.has(`${sign1}|${sign2}`) || BULLISH_PAIRS.has(`${sign2}|${sign1}`)) return "bullish";
  if (BEARISH_PAIRS.has(`${sign1}|${sign2}`) || BEARISH_PAIRS.has(`${sign2}|${sign1}`)) return "bearish";
  return "neutral";
}

function classify30Or150(absAngle: number, sign1: string, sign2: string): "depends" | "bullish" | "bearish" | "neutral" {
  if (absAngle !== 30 && absAngle !== 150) return "depends";
  return classifyBySigns(sign1, sign2);
}

function classifyAngleSignal(absAngle: number): "bullish" | "bearish" | "depends" | "unknown" {
  if (ANGLE_DEPENDS.has(absAngle)) return "depends";
  if (ANGLE_BULLISH.has(absAngle)) return "bullish";
  if (ANGLE_BEARISH.has(absAngle)) return "bearish";
  return "unknown";
}

function parseAspects(raw: string | null): number[] {
  if (!raw?.trim()) return DEFAULT_ASPECTS;
  const parsed = raw
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 360);
  return parsed.length ? parsed : DEFAULT_ASPECTS;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const startDate = url.searchParams.get("startDate")?.trim() ?? "";
  const endDate = url.searchParams.get("endDate")?.trim() ?? "";
  const orb = Math.max(Number(url.searchParams.get("orb") ?? "1"), 0.01);
  const aspects = parseAspects(url.searchParams.get("aspects"));
  const moonMode = (url.searchParams.get("moonMode")?.trim() ?? "all").toLowerCase();
  const planet1Filter = (url.searchParams.get("planet1")?.trim() ?? "").toLowerCase();
  const planet2Filter = (url.searchParams.get("planet2")?.trim() ?? "").toLowerCase();
  const maxRows = Math.min(Math.max(Number(url.searchParams.get("maxRows") ?? "12000"), 100), 50000);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return badRequest("startDate must use YYYY-MM-DD");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return badRequest("endDate must use YYYY-MM-DD");

  const start = new Date(`${startDate}T00:00:00+05:30`);
  const end = new Date(`${endDate}T23:59:00+05:30`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return badRequest("Invalid date range");

  const daySpan = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  if (daySpan > 45) return badRequest("Range too large. Please keep it within 45 days.");

  const bestByBucket = new Map<string, { delta: number; row: AspectRow }>();
  let cursor = new Date(start);
  const allowedAspects = [...aspects].sort((a, b) => a - b);

  while (cursor <= end) {
    const jd = swe.dateToJulianDay(cursor);
    const houses = swe.calculateHouses(jd, LATITUDE, LONGITUDE);
    const states: { name: string; longitude: number; speed: number; sign: string; motion: string }[] = PLANETS.map((planet) => {
      const pos = swe.calculatePosition(jd, planet.body);
      const longitude = normalizeDegrees(pos.longitude);
      const speed = Number(pos.longitudeSpeed ?? 0);
      return {
        name: planet.key,
        longitude,
        speed,
        sign: signName(longitude),
        motion: speed < 0 ? `${planet.key} Retrograde` : `${planet.key} Forward`
      };
    });

    const rahu = states.find((state) => state.name === "Rahu");
    if (rahu) {
      const ketuLongitude = normalizeDegrees(rahu.longitude + 180);
      states.push({
        name: "Ketu",
        longitude: ketuLongitude,
        speed: -Math.abs(rahu.speed),
        sign: signName(ketuLongitude),
        motion: "Ketu Retrograde"
      });
    }

    states.push({
      name: "Ascendant",
      longitude: normalizeDegrees(houses.ascendant),
      speed: 0,
      sign: signName(houses.ascendant),
      motion: "Ascendant Forward"
    });

    const { dateKey, timeKey, dtKey } = toIstParts(cursor);

    for (let i = 0; i < states.length; i += 1) {
      for (let j = i + 1; j < states.length; j += 1) {
        const p1 = states[i];
        const p2 = states[j];
        const names = [p1.name.toLowerCase(), p2.name.toLowerCase()];

        if (planet1Filter && planet2Filter) {
          const need = [planet1Filter, planet2Filter];
          if (!(names.includes(need[0]) && names.includes(need[1]))) continue;
        } else if (planet1Filter && !names.includes(planet1Filter)) {
          continue;
        } else if (planet2Filter && !names.includes(planet2Filter)) {
          continue;
        }

        const hasMoon = p1.name === "Moon" || p2.name === "Moon";
        const hasAsc = p1.name === "Ascendant" || p2.name === "Ascendant";
        if (moonMode === "only_moon" && !hasMoon) continue;
        if (moonMode === "only_ascendant" && !hasAsc) continue;
        if (moonMode === "moon_ascendant" && !(hasMoon || hasAsc)) continue;
        if (moonMode === "exclude_moon" && hasMoon) continue;
        if (moonMode === "exclude_ascendant" && hasAsc) continue;
        if (moonMode === "exclude_moon_ascendant" && (hasMoon || hasAsc)) continue;

        const diff = shortestAngleDiff(p1.longitude, p2.longitude);
        const mainAngle = allowedAspects.find((angle) => Math.abs(diff - angle) <= orb);
        if (mainAngle === undefined) continue;

        const absAngle = Number(mainAngle);
        const angleSignal = classifyAngleSignal(absAngle);
        const oneRetro = (p1.speed < 0) !== (p2.speed < 0);
        const finalSignal1 = oneRetro ? flipSignal(angleSignal) : angleSignal;
        const signTrend = classify30Or150(absAngle, p1.sign, p2.sign);
        const rSignTrend = oneRetro ? flipSignal(signTrend) : signTrend;
        const finalSignal = rSignTrend === "depends" ? finalSignal1 : rSignTrend;

        const row: AspectRow = {
          date_key: dateKey,
          time: timeKey,
          DT: dtKey,
          Planet1: p1.name,
          Planet2: p2.name,
          Angle: `${mainAngle} (${diff.toFixed(2)})`,
          "Planet1-Motion": p1.motion,
          "Planet2-Motion": p2.motion,
          "Planet1-FullDeg": Number(p1.longitude.toFixed(6)),
          "Planet2-FullDeg": Number(p2.longitude.toFixed(6)),
          "Planet1-Sign": p1.sign,
          "Planet2-Sign": p2.sign,
          Pair: `${p1.name}-${p2.name}`,
          Retrograde: p1.speed < 0 && p2.speed < 0 ? "Both" : oneRetro ? "One" : "Off",
          FinalSignal: finalSignal
        };
        const bucketKey = `${dateKey}|${p1.name}|${p2.name}|${mainAngle}`;
        const delta = Math.abs(diff - Number(mainAngle));
        const existing = bestByBucket.get(bucketKey);
        if (!existing || delta < existing.delta) {
          bestByBucket.set(bucketKey, { delta, row });
        }
      }
    }
    cursor = new Date(cursor.getTime() + 60 * 1000);
  }

  const rows = [...bestByBucket.values()]
    .map((item) => item.row)
    .sort((left, right) => String(left.DT).localeCompare(String(right.DT)));
  const truncated = rows.length > maxRows;
  const finalRows = truncated ? rows.slice(rows.length - maxRows) : rows;

  const compactRows = finalRows.map((row) => ({
    DT: row.DT,
    Planet1: row.Planet1,
    Planet2: row.Planet2,
    Angle: row.Angle,
    FinalSignal: row.FinalSignal,
    "Planet1-Motion": row["Planet1-Motion"],
    "Planet2-Motion": row["Planet2-Motion"],
    "Planet1-FullDeg": row["Planet1-FullDeg"],
    "Planet2-FullDeg": row["Planet2-FullDeg"],
    "Planet1-Sign": row["Planet1-Sign"],
    "Planet2-Sign": row["Planet2-Sign"]
  }));

  return NextResponse.json({
    payload: {
      range: { startDate, endDate, daySpan },
      filters: { orb, aspects: allowedAspects, moonMode, planet1: planet1Filter, planet2: planet2Filter, maxRows },
      totalRows: finalRows.length,
      truncated,
      rows: compactRows,
      detailedRows: finalRows
    }
  });
}
