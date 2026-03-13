"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type GenericRow = Record<string, string | number>;

type Payload = {
  range: { startDate: string; endDate: string; daySpan: number };
  totalRows: number;
  truncated: boolean;
  rows: GenericRow[];
  detailedRows: GenericRow[];
};

type Props = {
  userEmail: string;
};

const ASPECT_OPTIONS = [0, 22.5, 30, 36, 45, 60, 72, 90, 120, 135, 144, 150, 180];
const PLANET_OPTIONS = [
  "Sun",
  "Moon",
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn",
  "Uranus",
  "Neptune",
  "Pluto",
  "Rahu",
  "Ketu",
  "Ascendant"
];

function todayIst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function shiftIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + days);
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, "0");
  const d = String(next.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function DataTable({ rows, maxHeight = 360 }: { rows: GenericRow[]; maxHeight?: number }) {
  const columns = useMemo(() => {
    const keys = new Set<string>();
    rows.forEach((row) => Object.keys(row).forEach((key) => keys.add(key)));
    return [...keys];
  }, [rows]);

  if (!rows.length) return <p className="muted">No rows found.</p>;

  return (
    <div className="tableWrap" style={{ maxHeight }}>
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`row-${index}`}>
              {columns.map((column) => (
                <td key={`${index}-${column}`}>{String(row[column] ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PlanetaryAspectExplorer({ userEmail }: Props) {
  const [startDate, setStartDate] = useState(() => shiftIsoDate(todayIst(), -30));
  const [endDate, setEndDate] = useState(todayIst);
  const [autoBuild, setAutoBuild] = useState(false);
  const [moonMode, setMoonMode] = useState("all");
  const [planet1, setPlanet1] = useState("");
  const [planet2, setPlanet2] = useState("");
  const [orb, setOrb] = useState("1");
  const [aspects, setAspects] = useState<number[]>(ASPECT_OPTIONS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<Payload | null>(null);

  function toggleAspect(value: number) {
    setAspects((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value].sort((a, b) => a - b)));
  }

  async function runExplorer(nextStart = startDate, nextEnd = endDate) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        startDate: nextStart,
        endDate: nextEnd,
        moonMode,
        planet1,
        planet2,
        orb,
        aspects: aspects.join(","),
        maxRows: "12000"
      });
      const response = await fetch(`/api/astro/planetary-aspects?${params.toString()}`, { cache: "no-store" });
      const json = (await response.json()) as { payload?: Payload; error?: string };
      if (!response.ok || !json.payload) throw new Error(json.error ?? "Failed to compute planetary aspects");
      setPayload(json.payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to compute planetary aspects");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <header className="hero">
        <div className="heroTop">
          <div>
            <p className="eyebrow">TrendDates Intelligence</p>
            <h1>Planetary Aspect Explorer</h1>
          </div>
          <div className="userChip">
            <span>{userEmail}</span>
            <form action="/auth/sign-out" method="post">
              <button type="submit" className="controlBtn secondary signOutBtn">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <div className="astroTopNav">
          <Link className="controlBtn secondary" href="/astro">
            Full Astro Tab
          </Link>
          <Link className="controlBtn secondary" href="/astro/moon-ascendant">
            Ascendant & Moon
          </Link>
        </div>
      </header>

      <section className="filtersPanel astroFilters">
        <div className="astroFormGrid">
          <label>
            Start Date Planet
            <input
              type="date"
              value={startDate}
              onChange={(event) => {
                const next = event.target.value;
                setStartDate(next);
                if (autoBuild) void runExplorer(next, endDate);
              }}
            />
          </label>
          <label>
            End Date Planet
            <input
              type="date"
              value={endDate}
              onChange={(event) => {
                const next = event.target.value;
                setEndDate(next);
                if (autoBuild) void runExplorer(startDate, next);
              }}
            />
          </label>
        </div>

        <div className="astroActions">
          <button type="button" className="controlBtn" onClick={() => void runExplorer()} disabled={loading}>
            {loading ? "Building..." : "Build/Update Aspect Cache"}
          </button>
          <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <input type="checkbox" checked={autoBuild} onChange={(event) => setAutoBuild(event.target.checked)} />
            Auto build when date range changes
          </label>
        </div>

        <div className="astroGrid">
          <label>
            Moon / Ascendant aspects
            <select value={moonMode} onChange={(event) => setMoonMode(event.target.value)}>
              <option value="all">All</option>
              <option value="only_moon">Only Moon</option>
              <option value="only_ascendant">Only Ascendant</option>
              <option value="moon_ascendant">Moon + Ascendant</option>
              <option value="exclude_moon">Exclude Moon</option>
              <option value="exclude_ascendant">Exclude Ascendant</option>
              <option value="exclude_moon_ascendant">Exclude Moon + Ascendant</option>
            </select>
          </label>
          <label>
            Planet 1
            <select value={planet1} onChange={(event) => setPlanet1(event.target.value)}>
              <option value="">Choose an option</option>
              {PLANET_OPTIONS.map((planet) => (
                <option key={planet} value={planet}>
                  {planet}
                </option>
              ))}
            </select>
          </label>
          <label>
            Planet 2
            <select value={planet2} onChange={(event) => setPlanet2(event.target.value)}>
              <option value="">Choose an option</option>
              {PLANET_OPTIONS.map((planet) => (
                <option key={planet} value={planet}>
                  {planet}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="panel" style={{ padding: "12px" }}>
          <h3>Choose Aspects (multiple)</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
            {ASPECT_OPTIONS.map((aspect) => {
              const active = aspects.includes(aspect);
              return (
                <button
                  key={aspect}
                  type="button"
                  className={`controlBtn ${active ? "" : "secondary"}`}
                  onClick={() => toggleAspect(aspect)}
                >
                  {aspect}°
                </button>
              );
            })}
          </div>
          <label>
            Orb (± degrees): {Number(orb).toFixed(2)}
            <input type="range" min="0.1" max="5" step="0.1" value={orb} onChange={(event) => setOrb(event.target.value)} />
          </label>
        </div>

        {error ? <p className="astroError">{error}</p> : null}
        {payload ? (
          <p className="muted">
            Range: {payload.range.startDate} to {payload.range.endDate} ({payload.range.daySpan} days)
          </p>
        ) : null}
      </section>

      {payload ? (
        <>
          <section className="panel">
            <h3>Results ({payload.totalRows} rows)</h3>
            {payload.truncated ? <p className="muted">Result set truncated. Narrow filters or date range for full output.</p> : null}
            <DataTable rows={payload.rows} maxHeight={420} />
          </section>
          <section className="panel">
            <h3>Detailed Rows</h3>
            <DataTable rows={payload.detailedRows} maxHeight={420} />
          </section>
        </>
      ) : null}
    </main>
  );
}

