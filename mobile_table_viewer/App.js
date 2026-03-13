import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import trendTables from "./assets/trend_tables.json";

const MONTH_ALL_KEY = "all";

const TABS = [
  { key: "trend_dates", label: "Trend Dates" },
  { key: "dates_wise_single", label: "Single View" },
  { key: "dates_wise_summary", label: "Summary" },
  { key: "dates_wise_table", label: "Date Groups" },
];

const CARD_CONFIG = {
  trend_dates: {
    primary: "Symbol",
    secondary: "Trend",
    badgeKey: "Strength",
    badgeLabel: "Strength",
    details: ["Week"],
    emptyMessage: "No trend dates found for this month.",
  },
  dates_wise_single: {
    primary: "Symbol",
    secondary: "Trend",
    badgeKey: "Strength",
    badgeLabel: "Strength",
    details: ["Week"],
    emptyMessage: "No single-view rows found for this month.",
  },
  dates_wise_summary: {
    primary: "Trend",
    secondary: "Week",
    badgeKey: "Count",
    badgeLabel: "Count",
    details: ["MaxStrength", "Symbols"],
    emptyMessage: "No summary rows found for this month.",
  },
};

const FIELD_LABELS = {
  Symbol: "Symbol",
  Trend: "Trend Date",
  Strength: "Strength",
  Week: "Weekday",
  Count: "Count",
  MaxStrength: "Peak Strength",
  Symbols: "Symbols",
};

const MONTH_INDEX = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

const MONTH_SHORT_INDEX = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function parseDateValue(rawValue) {
  if (!rawValue) {
    return null;
  }

  const directDate = new Date(rawValue);
  if (!Number.isNaN(directDate.getTime())) {
    return directDate;
  }

  const match = String(rawValue)
    .trim()
    .match(/^(\d{1,2})-([A-Za-z]+)-(\d{4})$/);

  if (!match) {
    return null;
  }

  const [, dayText, monthText, yearText] = match;
  const monthName = monthText.toLowerCase();
  const monthIndex =
    MONTH_INDEX[monthName] ?? MONTH_SHORT_INDEX[monthName.slice(0, 3)];

  if (monthIndex === undefined) {
    return null;
  }

  const parsedDate = new Date(
    Number(yearText),
    monthIndex,
    Number(dayText),
    12,
    0,
    0
  );

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

function formatGeneratedAt(rawValue) {
  const parsedDate = parseDateValue(rawValue);
  if (!parsedDate) {
    return "Generated time unavailable";
  }

  return `Updated ${parsedDate.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function getMonthKey(rawValue) {
  const parsedDate = parseDateValue(rawValue);
  if (!parsedDate) {
    return null;
  }

  return `${parsedDate.getFullYear()}-${String(
    parsedDate.getMonth() + 1
  ).padStart(2, "0")}`;
}

function formatMonthLabel(monthKey) {
  if (monthKey === MONTH_ALL_KEY) {
    return "All Months";
  }

  const [yearText, monthText] = String(monthKey).split("-");
  const parsedDate = new Date(Number(yearText), Number(monthText) - 1, 1, 12, 0, 0);

  if (Number.isNaN(parsedDate.getTime())) {
    return monthKey;
  }

  return parsedDate.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function compareDateValues(leftValue, rightValue) {
  const leftDate = parseDateValue(leftValue);
  const rightDate = parseDateValue(rightValue);

  if (!leftDate && !rightDate) {
    return 0;
  }

  if (!leftDate) {
    return 1;
  }

  if (!rightDate) {
    return -1;
  }

  return leftDate.getTime() - rightDate.getTime();
}

function getRowDateValue(row) {
  if (!row || typeof row !== "object") {
    return null;
  }

  return row.Trend ?? row.Date ?? row.date ?? null;
}

function formatValue(fieldKey, value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return String(value);
}

function collectMonthOptions(data) {
  const monthMap = new Map();

  const addMonth = (rawValue) => {
    const monthKey = getMonthKey(rawValue);
    if (!monthKey || monthMap.has(monthKey)) {
      return;
    }
    monthMap.set(monthKey, formatMonthLabel(monthKey));
  };

  (data.trend_dates || []).forEach((row) => addMonth(getRowDateValue(row)));
  (data.dates_wise_single || []).forEach((row) => addMonth(getRowDateValue(row)));
  (data.dates_wise_summary || []).forEach((row) => addMonth(getRowDateValue(row)));
  Object.keys(data.dates_wise_table || {}).forEach((dateLabel) => addMonth(dateLabel));

  const sortedMonths = Array.from(monthMap.keys()).sort((left, right) =>
    right.localeCompare(left)
  );

  return [
    { key: MONTH_ALL_KEY, label: "All Months" },
    ...sortedMonths.map((monthKey) => ({
      key: monthKey,
      label: monthMap.get(monthKey) || monthKey,
    })),
  ];
}

function matchesMonth(rawValue, selectedMonth) {
  if (selectedMonth === MONTH_ALL_KEY) {
    return true;
  }

  return getMonthKey(rawValue) === selectedMonth;
}

function getFilteredRowsByMonth(rows, selectedMonth) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .filter((row) => matchesMonth(getRowDateValue(row), selectedMonth))
    .slice()
    .sort((leftRow, rightRow) =>
      compareDateValues(getRowDateValue(leftRow), getRowDateValue(rightRow))
    );
}

function getFilteredGroupedSectionsByMonth(dateMap, selectedMonth) {
  return Object.entries(dateMap || {})
    .filter(([dateLabel]) => matchesMonth(dateLabel, selectedMonth))
    .sort(([leftDate], [rightDate]) => compareDateValues(leftDate, rightDate));
}

function getMetrics(selectedTab, regularRows, groupedSections) {
  if (selectedTab === "dates_wise_table") {
    const allRows = [];
    groupedSections.forEach(([, rows]) => {
      if (Array.isArray(rows)) {
        allRows.push(...rows);
      }
    });
    const symbols = new Set(allRows.map((row) => row.Symbol).filter(Boolean));

    return [
      { label: "Dates", value: String(groupedSections.length) },
      { label: "Rows", value: String(allRows.length) },
      { label: "Symbols", value: String(symbols.size) },
    ];
  }

  const symbols = new Set(regularRows.map((row) => row.Symbol).filter(Boolean));
  const maxStrength = regularRows.reduce((currentMax, row) => {
    const strengthValue =
      typeof row.MaxStrength === "number"
        ? row.MaxStrength
        : typeof row.Strength === "number"
          ? row.Strength
          : 0;
    return Math.max(currentMax, strengthValue);
  }, 0);
  const totalCount = regularRows.reduce((sum, row) => {
    return sum + (typeof row.Count === "number" ? row.Count : 0);
  }, 0);

  if (selectedTab === "dates_wise_summary") {
    return [
      { label: "Rows", value: String(regularRows.length) },
      { label: "Total Picks", value: String(totalCount) },
      { label: "Peak", value: String(maxStrength) },
    ];
  }

  return [
    { label: "Rows", value: String(regularRows.length) },
    { label: "Symbols", value: String(symbols.size) },
    { label: "Peak", value: String(maxStrength) },
  ];
}

function FilterChip({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.filterChip, active && styles.filterChipActive]}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function MetricCard({ label, value }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function EmptyState({ message }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No data</Text>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

function RecordCard({ tabKey, row }) {
  const config = CARD_CONFIG[tabKey];
  const primaryText = formatValue(config.primary, row?.[config.primary]);
  const secondaryText = formatValue(config.secondary, row?.[config.secondary]);
  const badgeValue = row?.[config.badgeKey];
  const detailFields = config.details.filter((fieldKey) => row?.[fieldKey] !== undefined);

  return (
    <View style={styles.recordCard}>
      <View style={styles.recordHeader}>
        <View style={styles.recordHeadingBlock}>
          <Text style={styles.recordTitle}>{primaryText}</Text>
          <Text style={styles.recordSubtitle}>{secondaryText}</Text>
        </View>

        {badgeValue !== undefined && badgeValue !== null ? (
          <View style={styles.badge}>
            <Text style={styles.badgeValue}>{formatValue(config.badgeKey, badgeValue)}</Text>
            <Text style={styles.badgeLabel}>{config.badgeLabel}</Text>
          </View>
        ) : null}
      </View>

      {detailFields.length > 0 ? (
        <View style={styles.detailGrid}>
          {detailFields.map((fieldKey) => (
            <View
              key={`${tabKey}-${fieldKey}-${primaryText}`}
              style={[
                styles.detailTile,
                fieldKey === "Symbols" && styles.detailTileWide,
              ]}
            >
              <Text style={styles.detailLabel}>{FIELD_LABELS[fieldKey] || fieldKey}</Text>
              <Text
                style={styles.detailValue}
                numberOfLines={fieldKey === "Symbols" ? 4 : 1}
              >
                {formatValue(fieldKey, row?.[fieldKey])}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function GroupedDateSection({ dateLabel, rows }) {
  return (
    <View style={styles.groupSection}>
      <View style={styles.groupSectionHeader}>
        <View>
          <Text style={styles.groupSectionTitle}>{dateLabel}</Text>
          <Text style={styles.groupSectionMeta}>{rows.length} rows</Text>
        </View>
        <View style={styles.groupSectionBadge}>
          <Text style={styles.groupSectionBadgeText}>Date Group</Text>
        </View>
      </View>

      <View style={styles.groupItems}>
        {rows.map((row, index) => (
          <View
            key={`${dateLabel}-${row.Symbol || "row"}-${index}`}
            style={styles.groupItem}
          >
            <View style={styles.groupItemMain}>
              <Text style={styles.groupItemTitle}>{formatValue("Symbol", row.Symbol)}</Text>
              <Text style={styles.groupItemMetaText}>{formatValue("Week", row.Week)}</Text>
            </View>
            <View style={styles.groupItemStrength}>
              <Text style={styles.groupItemStrengthValue}>
                {formatValue("Strength", row.Strength)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function App() {
  const monthOptions = useMemo(() => collectMonthOptions(trendTables), []);
  const hasMultipleMonths = monthOptions.length > 2;
  const [selectedTab, setSelectedTab] = useState(TABS[0].key);
  const [selectedMonth, setSelectedMonth] = useState(
    monthOptions[1]?.key || MONTH_ALL_KEY
  );

  useEffect(() => {
    const monthStillExists = monthOptions.some((option) => option.key === selectedMonth);
    if (!monthStillExists) {
      setSelectedMonth(monthOptions[1]?.key || MONTH_ALL_KEY);
    }
  }, [monthOptions, selectedMonth]);

  const generatedAt = useMemo(() => formatGeneratedAt(trendTables.generated_at), []);
  const activeMonthLabel = useMemo(
    () => formatMonthLabel(selectedMonth),
    [selectedMonth]
  );

  const filteredTables = useMemo(() => {
    return {
      trend_dates: getFilteredRowsByMonth(trendTables.trend_dates, selectedMonth),
      dates_wise_single: getFilteredRowsByMonth(
        trendTables.dates_wise_single,
        selectedMonth
      ),
      dates_wise_summary: getFilteredRowsByMonth(
        trendTables.dates_wise_summary,
        selectedMonth
      ),
      dates_wise_table: getFilteredGroupedSectionsByMonth(
        trendTables.dates_wise_table,
        selectedMonth
      ),
    };
  }, [selectedMonth]);

  const regularRows = useMemo(() => {
    if (selectedTab === "dates_wise_table") {
      return [];
    }

    return filteredTables[selectedTab] || [];
  }, [filteredTables, selectedTab]);

  const groupedSections = useMemo(() => {
    return filteredTables.dates_wise_table || [];
  }, [filteredTables]);

  const metrics = useMemo(
    () => getMetrics(selectedTab, regularRows, groupedSections),
    [groupedSections, regularRows, selectedTab]
  );

  const activeTabLabel =
    TABS.find((tab) => tab.key === selectedTab)?.label || "Trend Dates";

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4EFE7" />

      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.heroCard}>
          <View style={styles.heroAccent} />
          <Text style={styles.heroEyebrow}>TrendDates Mobile</Text>
          <Text style={styles.heroTitle}>Readable trend tables for Android</Text>
          <Text style={styles.heroSubtitle}>{generatedAt}</Text>

          <View style={styles.heroPills}>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillLabel}>View</Text>
              <Text style={styles.heroPillValue}>{activeTabLabel}</Text>
            </View>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillLabel}>Month</Text>
              <Text style={styles.heroPillValue}>{activeMonthLabel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.controlBlock}>
          <Text style={styles.controlLabel}>Views</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {TABS.map((tab) => (
              <FilterChip
                key={tab.key}
                label={tab.label}
                active={selectedTab === tab.key}
                onPress={() => setSelectedTab(tab.key)}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.controlBlock}>
          <Text style={styles.controlLabel}>Select Month</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {monthOptions.map((option) => (
              <FilterChip
                key={option.key}
                label={option.label}
                active={selectedMonth === option.key}
                onPress={() => setSelectedMonth(option.key)}
              />
            ))}
          </ScrollView>
          {!hasMultipleMonths ? (
            <Text style={styles.controlHint}>
              Only {monthOptions[1]?.label || "one month"} is available in current data.
              Re-run export with a wider date range to enable month switching.
            </Text>
          ) : null}
        </View>

        <View style={styles.metricsRow}>
          {metrics.map((metric) => (
            <MetricCard key={metric.label} label={metric.label} value={metric.value} />
          ))}
        </View>

        {selectedTab === "dates_wise_table" ? (
          groupedSections.length === 0 ? (
            <EmptyState message="No grouped rows exist for the selected month." />
          ) : (
            groupedSections.map(([dateLabel, rows]) => (
              <GroupedDateSection key={dateLabel} dateLabel={dateLabel} rows={rows} />
            ))
          )
        ) : regularRows.length === 0 ? (
          <EmptyState
            message={CARD_CONFIG[selectedTab]?.emptyMessage || "No rows available."}
          />
        ) : (
          regularRows.map((row, index) => (
            <RecordCard
              key={`${selectedTab}-${index}-${row.Symbol || row.Trend || "row"}`}
              tabKey={selectedTab}
              row={row}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F4EFE7",
  },
  page: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
  },
  heroCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    backgroundColor: "#18392B",
    marginBottom: 18,
  },
  heroAccent: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#D27A39",
    top: -70,
    right: -40,
    opacity: 0.22,
  },
  heroEyebrow: {
    color: "#D7E3D9",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  heroTitle: {
    color: "#FFF8F0",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    marginTop: 8,
    maxWidth: "82%",
  },
  heroSubtitle: {
    color: "#D8E6DB",
    fontSize: 13,
    marginTop: 8,
  },
  heroPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 18,
  },
  heroPill: {
    borderRadius: 16,
    backgroundColor: "rgba(255, 248, 240, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(255, 248, 240, 0.14)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 130,
  },
  heroPillLabel: {
    color: "#C6D6CB",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroPillValue: {
    color: "#FFF8F0",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 3,
  },
  controlBlock: {
    marginBottom: 14,
  },
  controlLabel: {
    color: "#1E382D",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  controlHint: {
    color: "#7A6450",
    fontSize: 12,
    marginTop: 8,
    lineHeight: 18,
  },
  filterRow: {
    gap: 8,
    paddingRight: 8,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D3C1AB",
    backgroundColor: "#FCF8F2",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterChipActive: {
    backgroundColor: "#D27A39",
    borderColor: "#D27A39",
  },
  filterChipText: {
    color: "#2E241C",
    fontSize: 13,
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: "#FFF9F2",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: "#FFF8F1",
    borderWidth: 1,
    borderColor: "#E2D4C2",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  metricValue: {
    color: "#18392B",
    fontSize: 22,
    fontWeight: "800",
  },
  metricLabel: {
    color: "#715B49",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  recordCard: {
    borderRadius: 24,
    backgroundColor: "#FFFDFC",
    borderWidth: 1,
    borderColor: "#E8DCCF",
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
  },
  recordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  recordHeadingBlock: {
    flex: 1,
  },
  recordTitle: {
    color: "#152F25",
    fontSize: 19,
    fontWeight: "800",
  },
  recordSubtitle: {
    color: "#725F4B",
    fontSize: 13,
    marginTop: 4,
  },
  badge: {
    minWidth: 72,
    borderRadius: 18,
    backgroundColor: "#F0E5D6",
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeValue: {
    color: "#AD5720",
    fontSize: 18,
    fontWeight: "800",
  },
  badgeLabel: {
    color: "#775E48",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  detailTile: {
    width: "48%",
    borderRadius: 16,
    backgroundColor: "#F7F1E8",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  detailTileWide: {
    width: "100%",
  },
  detailLabel: {
    color: "#7C6552",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  detailValue: {
    color: "#2D241B",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
  },
  groupSection: {
    borderRadius: 24,
    backgroundColor: "#FFFDFC",
    borderWidth: 1,
    borderColor: "#E8DCCF",
    padding: 16,
    marginBottom: 14,
  },
  groupSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  groupSectionTitle: {
    color: "#18392B",
    fontSize: 18,
    fontWeight: "800",
  },
  groupSectionMeta: {
    color: "#78614F",
    fontSize: 13,
    marginTop: 3,
  },
  groupSectionBadge: {
    borderRadius: 999,
    backgroundColor: "#18392B",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  groupSectionBadgeText: {
    color: "#F7F0E6",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  groupItems: {
    gap: 10,
  },
  groupItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: "#F7F1E8",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  groupItemMain: {
    flex: 1,
    paddingRight: 12,
  },
  groupItemTitle: {
    color: "#1F3028",
    fontSize: 15,
    fontWeight: "800",
  },
  groupItemMetaText: {
    color: "#77614D",
    fontSize: 12,
    marginTop: 2,
  },
  groupItemStrength: {
    minWidth: 44,
    borderRadius: 14,
    backgroundColor: "#D27A39",
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  groupItemStrengthValue: {
    color: "#FFF8F1",
    fontSize: 16,
    fontWeight: "800",
  },
  emptyState: {
    borderRadius: 24,
    backgroundColor: "#FFF8F1",
    borderWidth: 1,
    borderColor: "#E6D7C4",
    paddingHorizontal: 18,
    paddingVertical: 22,
  },
  emptyTitle: {
    color: "#17362A",
    fontSize: 18,
    fontWeight: "800",
  },
  emptyText: {
    color: "#715D4A",
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
  },
});
