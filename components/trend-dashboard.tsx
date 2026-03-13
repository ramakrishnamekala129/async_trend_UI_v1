"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import type { GenericRow, TrendApiResponse } from "@/lib/types";

type Props = {
  data: TrendApiResponse;
  userEmail: string;
};

type AstroSnapshot = {
  date: string;
  time: string;
  symbol: string;
  referencePrice: number;
  sunSign: string;
  moonPhase: string;
  weekday: string;
  windowLabel: string;
};

function cellValue(row: GenericRow, key: string): string {
  const value = row[key];
  if (value === null || value === undefined) return "";
  return String(value);
}

function getColumns(rows: GenericRow[]): string[] {
  const set = new Set<string>();
  rows.forEach((row) => Object.keys(row).forEach((key) => set.add(key)));
  return [...set];
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
] as const;

function parseTrendDate(raw: string): Date | null {
  const text = raw.trim();
  const direct = /^(\d{1,2})-([A-Za-z]+)-(\d{4})$/.exec(text);
  if (direct) {
    const day = Number(direct[1]);
    const monthName = direct[2];
    const year = Number(direct[3]);
    const monthIndex = MONTHS.findIndex((month) => month.toLowerCase() === monthName.toLowerCase());
    if (monthIndex >= 0) {
      return new Date(year, monthIndex, day);
    }
  }
  const fallback = new Date(text);
  if (!Number.isNaN(fallback.getTime())) return fallback;
  return null;
}

function monthYearLabel(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function dateStamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameDay(left: Date, right: Date): boolean {
  return dateStamp(left) === dateStamp(right);
}

function getIstTodayMidnight(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const year = Number(parts.find((part) => part.type === "year")?.value ?? "0");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "1");
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "1");
  return new Date(year, month - 1, day);
}

function valueMatchesDateKey(value: unknown, selectedDateKey: string): boolean {
  if (!selectedDateKey) return true;
  const selectedDate = parseTrendDate(selectedDateKey);
  const parsed = parseTrendDate(String(value ?? ""));
  if (!selectedDate || !parsed) return false;
  return isSameDay(parsed, selectedDate);
}

type DateEntry = {
  key: string;
  date: Date;
  monthYear: string;
  dayStamp: string;
  rowCount: number;
};

function findDefaultDateKey(entries: DateEntry[], todayIst: Date): string {
  const validEntries = entries.filter((entry) => entry.rowCount > 0);
  if (!validEntries.length) return entries[0]?.key ?? "";

  const todayStamp = dateStamp(todayIst);
  const todayMatch = validEntries.find((entry) => entry.dayStamp === todayStamp);
  if (todayMatch) return todayMatch.key;

  const todayTs = todayIst.getTime();
  const nearestFuture = validEntries.find((entry) => entry.date.getTime() >= todayTs);
  if (nearestFuture) return nearestFuture.key;

  return validEntries[0].key;
}

function findInitialDateKey(entries: DateEntry[]): string {
  return entries.find((entry) => entry.rowCount > 0)?.key ?? entries[0]?.key ?? "";
}

function firstDateTimestamp(row: GenericRow): number | null {
  for (const value of Object.values(row)) {
    const parsed = parseTrendDate(String(value ?? ""));
    if (parsed) return parsed.getTime();
  }
  return null;
}

function getTodayIsoDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function pad(num: number): string {
  return String(num).padStart(2, "0");
}

function shiftIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + days);
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

function getSunSignForDate(date: Date): string {
  const monthDay = (date.getMonth() + 1) * 100 + date.getDate();
  if (monthDay >= 120 && monthDay <= 218) return "Aquarius";
  if (monthDay >= 219 && monthDay <= 320) return "Pisces";
  if (monthDay >= 321 && monthDay <= 419) return "Aries";
  if (monthDay >= 420 && monthDay <= 520) return "Taurus";
  if (monthDay >= 521 && monthDay <= 620) return "Gemini";
  if (monthDay >= 621 && monthDay <= 722) return "Cancer";
  if (monthDay >= 723 && monthDay <= 822) return "Leo";
  if (monthDay >= 823 && monthDay <= 922) return "Virgo";
  if (monthDay >= 923 && monthDay <= 1022) return "Libra";
  if (monthDay >= 1023 && monthDay <= 1121) return "Scorpio";
  if (monthDay >= 1122 && monthDay <= 1221) return "Sagittarius";
  return "Capricorn";
}

function getMoonPhaseForDate(date: Date): string {
  const knownNewMoon = Date.UTC(2000, 0, 6);
  const target = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const age = (((target - knownNewMoon) / 86400000) % 29.53058867 + 29.53058867) % 29.53058867;

  if (age < 1.84566) return "New Moon";
  if (age < 5.53699) return "Waxing Crescent";
  if (age < 9.22831) return "First Quarter";
  if (age < 12.91963) return "Waxing Gibbous";
  if (age < 16.61096) return "Full Moon";
  if (age < 20.30228) return "Waning Gibbous";
  if (age < 23.99361) return "Last Quarter";
  if (age < 27.68493) return "Waning Crescent";
  return "New Moon";
}

function buildAstroSnapshot(dateValue: string, timeValue: string, symbol: string, referencePrice: number): AstroSnapshot {
  const parsed = new Date(`${dateValue}T00:00:00`);
  return {
    date: dateValue,
    time: timeValue,
    symbol: symbol.trim().toUpperCase() || "NIFTY",
    referencePrice,
    sunSign: getSunSignForDate(parsed),
    moonPhase: getMoonPhaseForDate(parsed),
    weekday: parsed.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }),
    windowLabel: `${shiftIsoDate(dateValue, -45)} to ${shiftIsoDate(dateValue, -1)}`
  };
}

function getAstroLevels(referencePrice: number) {
  return [
    { label: "Support -5%", value: referencePrice * 0.95 },
    { label: "Support -2%", value: referencePrice * 0.98 },
    { label: "Reference", value: referencePrice },
    { label: "Resistance +2%", value: referencePrice * 1.02 },
    { label: "Resistance +5%", value: referencePrice * 1.05 }
  ];
}

function Table({
  title,
  rows,
  maxHeight = 380
}: {
  title: string;
  rows: GenericRow[];
  maxHeight?: number;
}) {
  if (!rows.length) {
    return (
      <section className="panel">
        <h3>{title}</h3>
        <p className="muted">No rows found.</p>
      </section>
    );
  }

  const columns = getColumns(rows);
  return (
    <section className="panel">
      <h3>{title}</h3>
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
            {rows.map((row, idx) => (
              <tr key={`${title}-${idx}`}>
                {columns.map((column) => (
                  <td key={`${idx}-${column}`}>{cellValue(row, column)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AstroDashboard() {
  const [astroDate, setAstroDate] = useState(getTodayIsoDate);
  const [astroTime, setAstroTime] = useState("09:15");
  const [astroSymbol, setAstroSymbol] = useState("NIFTY");
  const [referencePrice, setReferencePrice] = useState("25000");
  const [notes, setNotes] = useState(
    "Use this workspace to capture date, time, price context, and observations for astro-driven review."
  );
  const [savedSnapshots, setSavedSnapshots] = useState<AstroSnapshot[]>([]);

  const parsedReferencePrice = useMemo(() => Number(referencePrice), [referencePrice]);
  const snapshot = useMemo(() => {
    if (!astroDate || !astroTime || Number.isNaN(parsedReferencePrice)) return null;
    return buildAstroSnapshot(astroDate, astroTime, astroSymbol, parsedReferencePrice);
  }, [astroDate, astroTime, astroSymbol, parsedReferencePrice]);

  const levels = useMemo(
    () => (snapshot ? getAstroLevels(snapshot.referencePrice) : []),
    [snapshot]
  );

  function useToday() {
    setAstroDate(getTodayIsoDate());
    setAstroTime(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).format(new Date())
    );
  }

  function saveSnapshot() {
    if (!snapshot) return;
    setSavedSnapshots((current) => [snapshot, ...current].slice(0, 12));
  }

  return (
    <section className="astroPanel">
      <div className="panel astroHero">
        <div>
          <p className="eyebrow">Astro Workspace</p>
          <h3>Astro Date Review</h3>
          <p className="muted">
            Build quick date-based context with sign, moon phase, review window, and price bands.
          </p>
        </div>
        <div className="astroActions">
          <button type="button" className="controlBtn secondary" onClick={useToday}>
            Use Today
          </button>
          <button type="button" className="controlBtn" onClick={saveSnapshot} disabled={!snapshot}>
            Save Snapshot
          </button>
        </div>
      </div>

      <div className="astroGrid">
        <section className="panel">
          <h3>Inputs</h3>
          <div className="astroFormGrid">
            <label>
              Date
              <input type="date" value={astroDate} onChange={(e) => setAstroDate(e.target.value)} />
            </label>
            <label>
              Time
              <input type="time" value={astroTime} onChange={(e) => setAstroTime(e.target.value)} />
            </label>
            <label>
              Symbol
              <input value={astroSymbol} onChange={(e) => setAstroSymbol(e.target.value)} placeholder="NIFTY" />
            </label>
            <label>
              Reference Price
              <input
                inputMode="decimal"
                value={referencePrice}
                onChange={(e) => setReferencePrice(e.target.value)}
                placeholder="25000"
              />
            </label>
          </div>
        </section>

        <section className="panel">
          <h3>Overview</h3>
          <div className="astroStats">
            <article className="astroStatCard">
              <span>Sun Sign</span>
              <strong>{snapshot?.sunSign ?? "-"}</strong>
            </article>
            <article className="astroStatCard">
              <span>Moon Phase</span>
              <strong>{snapshot?.moonPhase ?? "-"}</strong>
            </article>
            <article className="astroStatCard">
              <span>Weekday</span>
              <strong>{snapshot?.weekday ?? "-"}</strong>
            </article>
            <article className="astroStatCard">
              <span>Review Window</span>
              <strong>{snapshot?.windowLabel ?? "-"}</strong>
            </article>
          </div>
        </section>
      </div>

      <div className="astroGrid">
        <section className="panel">
          <h3>Reference Price Levels</h3>
          <div className="astroLevels">
            {levels.map((level) => (
              <article key={level.label} className="astroLevelRow">
                <span>{level.label}</span>
                <strong>{level.value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <h3>Astro Notes</h3>
          <textarea
            className="astroNotes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add observations, signals, and timing notes."
          />
        </section>
      </div>

      <section className="panel">
        <h3>Saved Snapshots</h3>
        {!savedSnapshots.length ? (
          <p className="muted">No snapshots saved yet.</p>
        ) : (
          <div className="tableWrap" style={{ maxHeight: 340 }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Symbol</th>
                  <th>Sun Sign</th>
                  <th>Moon Phase</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {savedSnapshots.map((item, index) => (
                  <tr key={`${item.date}-${item.time}-${index}`}>
                    <td>{item.date}</td>
                    <td>{item.time}</td>
                    <td>{item.symbol}</td>
                    <td>{item.sunSign}</td>
                    <td>{item.moonPhase}</td>
                    <td>{item.referencePrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

export function TrendDashboard({ data, userEmail }: Props) {
  const [symbolQuery, setSymbolQuery] = useState("");
  const [dateSortOrder, setDateSortOrder] = useState<"asc" | "desc">("asc");

  const payload = data.payload;
  const trendRows = payload.trend_dates;
  const summaryRows = payload.dates_wise_summary;
  const sortedDateKeysAsc = useMemo(
    () =>
      Object.keys(payload.dates_wise_table).sort((a, b) => {
        const da = parseTrendDate(a);
        const db = parseTrendDate(b);
        if (da && db) return da.getTime() - db.getTime();
        return a.localeCompare(b);
      }),
    [payload.dates_wise_table]
  );

  const dateEntriesAsc = useMemo(
    () =>
      sortedDateKeysAsc
        .map((key) => {
          const date = parseTrendDate(key);
          if (!date) return null;
          return {
            key,
            date,
            monthYear: monthYearLabel(date),
            dayStamp: dateStamp(date),
            rowCount: (payload.dates_wise_table[key] ?? []).length
          } satisfies DateEntry;
        })
        .filter((entry): entry is DateEntry => Boolean(entry)),
    [sortedDateKeysAsc, payload.dates_wise_table]
  );

  const monthYearOptions = useMemo(() => {
    const set = new Set<string>();
    dateEntriesAsc.forEach((entry) => set.add(entry.monthYear));
    return Array.from(set);
  }, [dateEntriesAsc]);

  const defaultDateKey = useMemo(() => findInitialDateKey(dateEntriesAsc), [dateEntriesAsc]);

  const defaultMonthYear = useMemo(() => {
    const matchingEntry = dateEntriesAsc.find((entry) => entry.key === defaultDateKey);
    return matchingEntry?.monthYear ?? monthYearOptions[0] ?? "";
  }, [dateEntriesAsc, defaultDateKey, monthYearOptions]);

  const [selectedDateKey, setSelectedDateKey] = useState(defaultDateKey);
  const [selectedMonthYear, setSelectedMonthYear] = useState(defaultMonthYear);
  const [hasAppliedPreferredDate, setHasAppliedPreferredDate] = useState(false);

  useEffect(() => {
    if (!selectedDateKey || !dateEntriesAsc.some((entry) => entry.key === selectedDateKey)) {
      setSelectedDateKey(defaultDateKey);
    }
  }, [dateEntriesAsc, defaultDateKey, selectedDateKey]);

  useEffect(() => {
    if (hasAppliedPreferredDate || !dateEntriesAsc.length) return;
    const preferredDateKey = findDefaultDateKey(dateEntriesAsc, getIstTodayMidnight());
    if (preferredDateKey && preferredDateKey !== selectedDateKey) {
      setSelectedDateKey(preferredDateKey);
    }
    setHasAppliedPreferredDate(true);
  }, [dateEntriesAsc, hasAppliedPreferredDate, selectedDateKey]);

  useEffect(() => {
    setHasAppliedPreferredDate(false);
  }, [defaultDateKey]);

  useEffect(() => {
    const selectedEntry = dateEntriesAsc.find((entry) => entry.key === selectedDateKey);
    if (selectedEntry?.monthYear && selectedEntry.monthYear !== selectedMonthYear) {
      setSelectedMonthYear(selectedEntry.monthYear);
      return;
    }
    if (!selectedEntry && defaultMonthYear && defaultMonthYear !== selectedMonthYear) {
      setSelectedMonthYear(defaultMonthYear);
    }
  }, [dateEntriesAsc, defaultMonthYear, selectedDateKey, selectedMonthYear]);

  const dateEntriesForRail = useMemo(() => {
    const ordered = dateSortOrder === "asc" ? dateEntriesAsc : [...dateEntriesAsc].reverse();
    if (!selectedMonthYear) return ordered;
    return ordered.filter((entry) => entry.monthYear === selectedMonthYear);
  }, [dateEntriesAsc, dateSortOrder, selectedMonthYear]);

  const monthDateKeys = useMemo(() => dateEntriesForRail.map((entry) => entry.key), [dateEntriesForRail]);

  const selectedMonthIndex = useMemo(() => {
    return monthYearOptions.indexOf(selectedMonthYear);
  }, [monthYearOptions, selectedMonthYear]);

  const canSelectPrevMonth = selectedMonthIndex > 0;
  const canSelectNextMonth = selectedMonthIndex >= 0 && selectedMonthIndex < monthYearOptions.length - 1;

  function stepMonth(step: -1 | 1) {
    if (selectedMonthIndex < 0) return;
    const next = monthYearOptions[selectedMonthIndex + step];
    if (!next) return;
    setSelectedMonthYear(next);

    const selectedInNextMonth = dateEntriesAsc.some(
      (entry) => entry.key === selectedDateKey && entry.monthYear === next
    );
    if (selectedInNextMonth) return;

    const fallbackKey = dateEntriesAsc.find((entry) => entry.monthYear === next && entry.rowCount > 0)?.key;
    setSelectedDateKey(fallbackKey ?? "");
  }

  function onMonthYearChange(nextMonthYear: string) {
    setSelectedMonthYear(nextMonthYear);
    const selectedInMonth = dateEntriesAsc.some(
      (entry) => entry.key === selectedDateKey && entry.monthYear === nextMonthYear
    );
    if (selectedInMonth) return;
    const fallbackKey = dateEntriesAsc.find(
      (entry) => entry.monthYear === nextMonthYear && entry.rowCount > 0
    )?.key;
    setSelectedDateKey(fallbackKey ?? "");
  }

  function onDateSelect(nextDateKey: string) {
    setSelectedDateKey(nextDateKey);
    const entry = dateEntriesAsc.find((candidate) => candidate.key === nextDateKey);
    if (entry && entry.monthYear !== selectedMonthYear) {
      setSelectedMonthYear(entry.monthYear);
    }
  }

  const selectedDateIndexInRail = useMemo(
    () => monthDateKeys.indexOf(selectedDateKey),
    [monthDateKeys, selectedDateKey]
  );
  const canSelectPrevDate = selectedDateIndexInRail > 0;
  const canSelectNextDate =
    selectedDateIndexInRail >= 0 && selectedDateIndexInRail < monthDateKeys.length - 1;

  function stepDate(step: -1 | 1) {
    if (selectedDateIndexInRail < 0) return;
    const nextKey = monthDateKeys[selectedDateIndexInRail + step];
    if (nextKey) onDateSelect(nextKey);
  }

  function onDateRailKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      stepDate(-1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      stepDate(1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      const firstKey = monthDateKeys[0];
      if (firstKey) onDateSelect(firstKey);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      const lastKey = monthDateKeys[monthDateKeys.length - 1];
      if (lastKey) onDateSelect(lastKey);
    }
  }

  const filteredTrendRows = useMemo(() => {
    const q = symbolQuery.trim().toLowerCase();
    const direction = dateSortOrder === "asc" ? 1 : -1;
    return trendRows
      .filter((row) => {
      if (selectedDateKey) {
        const matchesDate = Object.values(row).some((value) => {
          return valueMatchesDateKey(value, selectedDateKey);
        });
        if (!matchesDate) return false;
      }
      if (q && !JSON.stringify(row).toLowerCase().includes(q)) return false;
      return true;
    })
      .sort((a, b) => {
        const ta = firstDateTimestamp(a);
        const tb = firstDateTimestamp(b);
        if (ta === null && tb === null) return 0;
        if (ta === null) return 1;
        if (tb === null) return -1;
        return (ta - tb) * direction;
      });
  }, [trendRows, symbolQuery, selectedDateKey, dateSortOrder]);

  const filteredSummaryRows = useMemo(() => {
    const direction = dateSortOrder === "asc" ? 1 : -1;
    return summaryRows
      .filter((row) => {
      if (selectedDateKey) {
        const matchesDate = Object.values(row).some((value) => {
          return valueMatchesDateKey(value, selectedDateKey);
        });
        if (!matchesDate) return false;
      }
      return true;
    })
      .sort((a, b) => {
        const ta = firstDateTimestamp(a);
        const tb = firstDateTimestamp(b);
        if (ta === null && tb === null) return 0;
        if (ta === null) return 1;
        if (tb === null) return -1;
        return (ta - tb) * direction;
      });
  }, [summaryRows, selectedDateKey, dateSortOrder]);

  const selectedDateRows = useMemo(
    () => (selectedDateKey ? payload.dates_wise_table[selectedDateKey] ?? [] : []),
    [selectedDateKey, payload.dates_wise_table]
  );

  return (
    <main className="page">
      <header className="hero">
        <div className="heroTop">
          <div>
            <p className="eyebrow">TrendDates Intelligence</p>
            <h1>Stock Trend Date Explorer</h1>
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
        <p className="muted">Authenticated dashboard access is enabled.</p>
        <div className="astroTopNav">
          <Link className="controlBtn secondary" href="/astro">
            Open Astro Workspace
          </Link>
          <Link className="controlBtn secondary" href="/astro/planetary-aspects">
            Planetary Aspect Explorer
          </Link>
          <Link className="controlBtn secondary" href="/astro/moon-ascendant">
            Ascendant & Moon
          </Link>
        </div>
      </header>

      <section className="filtersPanel">
        <label className="searchField">
          <span>Search trend rows</span>
          <input
            placeholder="Type symbol, date, weekday..."
            value={symbolQuery}
            onChange={(e) => setSymbolQuery(e.target.value)}
          />
        </label>

        <div className="controlGrid">
          <article className="controlCard">
            <div className="controlHead">
              <h4>Month-Year</h4>
              <p>
                {selectedMonthYear
                  ? `${selectedMonthYear} (${monthDateKeys.length} dates)`
                  : "No month selected"}
              </p>
            </div>
            <div className="controlActions">
              <button
                type="button"
                className="controlBtn"
                disabled={!canSelectPrevMonth}
                onClick={() => stepMonth(-1)}
              >
                Previous
              </button>
              <select
                className="controlSelect"
                value={selectedMonthYear}
                onChange={(e) => onMonthYearChange(e.target.value)}
              >
                {monthYearOptions.map((monthYear) => (
                  <option key={monthYear} value={monthYear}>
                    {monthYear}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="controlBtn"
                disabled={!canSelectNextMonth}
                onClick={() => stepMonth(1)}
              >
                Next
              </button>
            </div>
          </article>

          <article className="controlCard">
            <div className="controlHead">
              <h4>Month Filter</h4>
              <p className="selectedDateSummary">
                {selectedDateKey
                  ? `Selected: ${selectedDateKey} (${selectedDateRows.length} stocks)`
                  : "No valid date available"}
              </p>
            </div>
            <div className="controlActions controlActionsDate">
              <button
                type="button"
                className="controlBtn secondary"
                disabled={!canSelectPrevDate}
                onClick={() => stepDate(-1)}
              >
                Previous Date
              </button>
              <button
                type="button"
                className="controlBtn secondary"
                disabled={!canSelectNextDate}
                onClick={() => stepDate(1)}
              >
                Next Date
              </button>
            </div>
            <div
              className="dateMiniRail"
              tabIndex={0}
              onKeyDown={onDateRailKeyDown}
              aria-label="Date selector rail. Use Left and Right arrow keys to change date."
            >
              {monthDateKeys.map((dateKey) => (
                <button
                  type="button"
                  key={dateKey}
                  className={`dateMiniCard ${dateKey === selectedDateKey ? "active" : ""}`}
                  onClick={() => onDateSelect(dateKey)}
                  aria-pressed={dateKey === selectedDateKey}
                >
                  <span>{dateKey}</span>
                  <b>{(payload.dates_wise_table[dateKey] ?? []).length}</b>
                </button>
              ))}
              {!monthDateKeys.length ? <p className="muted">No dates available for this month.</p> : null}
            </div>
          </article>

          <article className="controlCard controlCardOrder">
            <div className="controlHead">
              <h4>Date Order</h4>
              <p>{dateSortOrder === "asc" ? "Oldest to newest" : "Newest to oldest"}</p>
            </div>
            <div className="segmented">
              <button
                type="button"
                className={`segmentBtn ${dateSortOrder === "asc" ? "active" : ""}`}
                onClick={() => setDateSortOrder("asc")}
              >
                Ascending
              </button>
              <button
                type="button"
                className={`segmentBtn ${dateSortOrder === "desc" ? "active" : ""}`}
                onClick={() => setDateSortOrder("desc")}
              >
                Descending
              </button>
            </div>
          </article>
        </div>
      </section>

      <div className="grid2">
        <Table title="Trend Dates" rows={filteredTrendRows} />
        <Table title="Date-Wise Summary" rows={filteredSummaryRows} />
      </div>

      <section className="panel">
        <h3>Date-Wise Table Preview</h3>
        <p className="muted">
          Showing rows for <strong>{selectedDateKey || "no date selected"}</strong>
        </p>
        <div className="spacer" />
        <Table title="Rows For Selected Date" rows={selectedDateRows} maxHeight={450} />
      </section>
    </main>
  );
}
