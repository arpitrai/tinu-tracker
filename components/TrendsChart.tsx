import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { CartesianChart, Line, Area, useChartPressState } from 'victory-native';
import { Circle, Line as SkiaLine, LinearGradient, useFont, vec } from '@shopify/react-native-skia';
import { useAnimatedReaction, runOnJS } from 'react-native-reanimated';
import HistoryTable, { HistoryEntry } from './HistoryTable';
import DateRangeModal from './DateRangeModal';

/* ─────────────────────────────────────────
   COLOURS
───────────────────────────────────────── */
const C = {
  weight: '#534AB7',
  exercise: '#10B981',
  sugar: '#EF4444',
  axis: '#B8B2AA',
  axisLine: 'rgba(0,0,0,0.07)',
  text: '#1C1915',
  textMuted: '#9A9082',
  border: 'rgba(0,0,0,0.06)',
  pill: '#F2F1EE',
  pillActive: '#3C3489',
  pillActiveText: '#EEEDFE',
};

/* ─────────────────────────────────────────
   CHART LAYOUT CONSTANTS
───────────────────────────────────────── */
const CHART_H = 200;    // canvas height (plot + axes)
const READOUT_H = 36;   // fixed-height value readout above the chart

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
export interface ChartEntry {
  date: string;                    // YYYY-MM-DD
  exercised?: boolean | null;
  ate_sweets?: boolean | null;
  weight?: string | number | null;
}

type Preset = '30D' | '60D' | '90D' | 'CUSTOM';
type Gran = 'D' | 'W' | 'M';

interface Point {
  key: string;
  label: string;
  tooltip: string;
  weight: number | null;
}

/* ─────────────────────────────────────────
   DATE / NUMBER HELPERS  (all local-time; never new Date(dateStr))
───────────────────────────────────────── */
export function parseWeight(w: string | number | null | undefined): number | null {
  if (w == null || w === '') return null;
  const n = parseFloat(String(w));
  return isNaN(n) ? null : n;
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function dayCount(start: string, end: string): number {
  const [ys, ms, ds] = start.split('-').map(Number);
  const [ye, me, de] = end.split('-').map(Number);
  const a = new Date(ys, ms - 1, ds).getTime();
  const b = new Date(ye, me - 1, de).getTime();
  return Math.round((b - a) / 86_400_000) + 1;
}

function mondayOfWeek(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay();
  dt.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day));
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function fmtPretty(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} ${MON[m - 1]}`;
}

function numAvg(nums: number[]): number | null {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

/* ─────────────────────────────────────────
   POINT BUILDERS
───────────────────────────────────────── */
function buildPoints(
  map: Map<string, ChartEntry>,
  gran: Gran,
  start: string,
  end: string,
): Point[] {
  if (gran === 'D') {
    const pts: Point[] = [];
    let cur = start;
    while (cur <= end) {
      const e = map.get(cur);
      const [y, m, d] = cur.split('-').map(Number);
      pts.push({
        key: cur,
        label: `${d} ${MON[m - 1]}`,
        tooltip: new Date(y, m - 1, d).toLocaleDateString('en-US', {
          weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
        }),
        weight: e ? parseWeight(e.weight) : null,
      });
      cur = addDays(cur, 1);
    }
    return pts;
  }

  if (gran === 'W') {
    const pts: Point[] = [];
    let wk = mondayOfWeek(start);
    while (wk <= end) {
      const wkEnd = addDays(wk, 6);
      const ws: number[] = [];
      for (const e of map.values()) {
        if (e.date >= wk && e.date <= wkEnd && e.date >= start && e.date <= end) {
          const w = parseWeight(e.weight);
          if (w !== null) ws.push(w);
        }
      }
      const [y, m, d] = wk.split('-').map(Number);
      pts.push({
        key: wk,
        label: `${d} ${MON[m - 1]}`,
        tooltip: `Week of ${d} ${MON[m - 1]} ${y}`,
        weight: numAvg(ws),
      });
      wk = addDays(wk, 7);
    }
    return pts;
  }

  // Monthly
  const groups = new Map<string, number[]>();
  for (const e of map.values()) {
    if (e.date < start || e.date > end) continue;
    const k = e.date.slice(0, 7);
    const w = parseWeight(e.weight);
    if (!groups.has(k)) groups.set(k, []);
    if (w !== null) groups.get(k)!.push(w);
  }
  const pts: Point[] = [];
  let [y, m] = [Number(start.slice(0, 4)), Number(start.slice(5, 7))];
  const endY = Number(end.slice(0, 4));
  const endM = Number(end.slice(5, 7));
  while (y < endY || (y === endY && m <= endM)) {
    const k = `${y}-${pad(m)}`;
    pts.push({
      key: k,
      label: MON[m - 1],
      tooltip: `${MON[m - 1]} ${y}`,
      weight: numAvg(groups.get(k) ?? []),
    });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return pts;
}

/* ─────────────────────────────────────────
   WEIGHT CHART  (native — victory-native + Skia)

   Replaces the hand-rolled SVG chart. victory-native owns axis tick
   placement, so x-axis date labels no longer collide; `tickCount` caps
   the number of evenly-spaced labels regardless of data density.
───────────────────────────────────────── */

function lastReadingIdx(points: Point[]): number | null {
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].weight !== null) return i;
  }
  return null;
}

function WeightChart({ points, svgW }: { points: Point[]; svgW: number }) {
  // Numeric-index x so the scale is linear; the date string is mapped back
  // via formatXLabel. null weights become gaps in the line/area.
  const data = useMemo<{ i: number; weight: number | null }[]>(
    () => points.map((p, i) => ({ i, weight: p.weight })),
    [points],
  );
  const labels = useMemo(() => points.map(p => p.label), [points]);
  const n = points.length;

  // Font for Skia-rendered axis labels. A bundled .ttf (via useFont) works on
  // both native and web — unlike matchFont, which needs the OS font manager
  // that CanvasKit-on-web lacks. Null while loading; labels appear once ready.
  const axisFont = useFont(require('../assets/fonts/Roboto-Regular.ttf'), 10);

  const { state } = useChartPressState({ x: 0, y: { weight: 0 } });

  // Mirror the press position into React state so the readout (plain RN text)
  // can show the touched point; clears to null when the finger lifts.
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  useAnimatedReaction(
    () => ({ active: state.isActive.value, x: state.x.value.value }),
    (cur) => {
      runOnJS(setActiveIdx)(cur.active ? Math.round(cur.x as number) : null);
    },
    [],
  );

  const hasData = points.some(p => p.weight !== null);
  if (!hasData) {
    return (
      <View style={[s.chartEmpty, { width: svgW }]}>
        <Text style={s.chartEmptyText}>No weight logged in this period</Text>
      </View>
    );
  }

  // Up to 6 evenly-spaced x ticks — victory keeps them from overlapping.
  const tickCount = Math.max(2, Math.min(6, n));

  // Fixed y-axis headroom: 10 kg below the lowest logged weight and 10 kg above
  // the highest, instead of fitting tightly to the data range.
  const validWeights = points
    .map(p => p.weight)
    .filter((w): w is number => w !== null);
  const yDomain: [number, number] = [
    Math.min(...validWeights) - 10,
    Math.max(...validWeights) + 10,
  ];

  const readoutIdx =
    activeIdx != null && points[activeIdx]?.weight != null ? activeIdx : lastReadingIdx(points);
  const readout = readoutIdx != null ? points[readoutIdx] : null;

  return (
    <View style={{ width: svgW }}>
      {/* Fixed-height readout — shows the latest reading, or the touched point
          while pressing. Constant height avoids layout shift. */}
      <View style={s.readout}>
        {readout?.weight != null && (
          <>
            <Text style={s.readoutVal}>
              {readout.weight.toFixed(1)}
              <Text style={s.readoutUnit}> kg</Text>
            </Text>
            <Text style={s.readoutDate}>{readout.tooltip}</Text>
          </>
        )}
      </View>

      <View style={{ height: CHART_H, width: svgW }}>
        <CartesianChart
          data={data}
          xKey="i"
          yKeys={['weight']}
          chartPressState={state}
          domain={{ y: yDomain }}
          domainPadding={{ left: 10, right: 14 }}
          xAxis={{
            font: axisFont,
            tickCount,
            lineColor: C.axisLine,
            labelColor: C.axis,
            formatXLabel: (v: number) => labels[Math.round(v)] ?? '',
          }}
          yAxis={[
            {
              font: axisFont,
              tickCount: 5,
              lineColor: C.axisLine,
              labelColor: C.axis,
              formatYLabel: (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)),
            },
          ]}
        >
          {({ points: cp, chartBounds }) => (
            <>
              <Area
                points={cp.weight}
                y0={chartBounds.bottom}
                curveType="natural"
                connectMissingData={false}
              >
                <LinearGradient
                  start={vec(0, chartBounds.top)}
                  end={vec(0, chartBounds.bottom)}
                  colors={['rgba(83,74,183,0.16)', 'rgba(83,74,183,0)']}
                />
              </Area>
              <Line
                points={cp.weight}
                color={C.weight}
                strokeWidth={2.5}
                curveType="natural"
                connectMissingData={false}
              />
              {/* Scrub indicator (Apple-style): vertical rule + emphasized dot
                  on the touched data point. Anchored to the point's pixel
                  coords so it stays aligned with the line; the value/date show
                  in the readout above. Only while a point is active. */}
              {(() => {
                const ap = activeIdx !== null ? cp.weight[activeIdx] : undefined;
                if (!ap || ap.y == null) return null;
                return (
                  <>
                    <SkiaLine
                      p1={vec(ap.x, chartBounds.top)}
                      p2={vec(ap.x, chartBounds.bottom)}
                      color={C.weight}
                      strokeWidth={1}
                      opacity={0.35}
                    />
                    <Circle cx={ap.x} cy={ap.y} r={7.5} color="#FFFFFF" />
                    <Circle cx={ap.x} cy={ap.y} r={4.5} color={C.weight} />
                  </>
                );
              })()}
            </>
          )}
        </CartesianChart>
      </View>
    </View>
  );
}

/* ─────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────── */
const PRESETS: { key: Preset; label: string }[] = [
  { key: '30D', label: '30D' },
  { key: '60D', label: '60D' },
  { key: '90D', label: '90D' },
  { key: 'CUSTOM', label: 'Custom' },
];

const PRESET_DAYS: Record<Exclude<Preset, 'CUSTOM'>, number> = { '30D': 30, '60D': 60, '90D': 90 };

const GRAN: { key: Gran; label: string; minDays: number }[] = [
  { key: 'D', label: 'Daily', minDays: 0 },
  { key: 'W', label: 'Weekly', minDays: 7 },
  { key: 'M', label: 'Monthly', minDays: 30 },
];

interface Props {
  entries: ChartEntry[];
  today: string;
  onJumpToDate: (date: string) => void;
}

export default function TrendsChart({ entries, today, onJumpToDate }: Props) {
  const { width } = useWindowDimensions();
  const svgW = width - 32;

  const [preset, setPreset] = useState<Preset>('30D');
  const [custom, setCustom] = useState<{ start: string; end: string }>({
    start: addDays(today, -29),
    end: today,
  });
  const [gran, setGran] = useState<Gran>('D');
  const [rangeModal, setRangeModal] = useState(false);

  const { startDate, endDate } = useMemo(() => {
    if (preset === 'CUSTOM') return { startDate: custom.start, endDate: custom.end };
    const n = PRESET_DAYS[preset];
    return { startDate: addDays(today, -(n - 1)), endDate: today };
  }, [preset, custom, today]);

  const totalDays = useMemo(() => dayCount(startDate, endDate), [startDate, endDate]);
  const weeklyOK = totalDays >= 7;
  const monthlyOK = totalDays >= 30;

  // Drop to Daily when the active view no longer meets its minimum span.
  useEffect(() => {
    if (gran === 'W' && !weeklyOK) setGran('D');
    if (gran === 'M' && !monthlyOK) setGran('D');
  }, [gran, weeklyOK, monthlyOK]);

  // Entries indexed by date, filtered to the active window.
  const rangeMap = useMemo(() => {
    const map = new Map<string, ChartEntry>();
    for (const e of entries) {
      if (e.date >= startDate && e.date <= endDate) map.set(e.date, e);
    }
    return map;
  }, [entries, startDate, endDate]);

  const points = useMemo(
    () => buildPoints(rangeMap, gran, startDate, endDate),
    [rangeMap, gran, startDate, endDate],
  );

  // Table: every day in the window, most recent first.
  const tableEntries = useMemo<HistoryEntry[]>(() => {
    const out: HistoryEntry[] = [];
    let cur = endDate;
    while (cur >= startDate) {
      const e = rangeMap.get(cur);
      out.push(e
        ? { date: cur, exercised: e.exercised ?? null, ate_sweets: e.ate_sweets ?? null, weight: e.weight ?? null }
        : { date: cur, exercised: null, ate_sweets: null, weight: null });
      cur = addDays(cur, -1);
    }
    return out;
  }, [rangeMap, startDate, endDate]);

  // Averages — denominator is always total days in the window.
  const stats = useMemo(() => {
    const ws: number[] = [];
    let exDays = 0;
    let sugarDays = 0;
    for (const e of rangeMap.values()) {
      const w = parseWeight(e.weight);
      if (w !== null) ws.push(w);
      if (e.exercised === true) exDays++;
      if (e.ate_sweets === true) sugarDays++;
    }
    return {
      avgW: numAvg(ws),
      readings: ws.length,
      exDays,
      sugarDays,
      exPct: totalDays ? Math.round((exDays / totalDays) * 100) : 0,
      sugarPct: totalDays ? Math.round((sugarDays / totalDays) * 100) : 0,
    };
  }, [rangeMap, totalDays]);

  const subtitle = preset === 'CUSTOM'
    ? `Custom · ${fmtPretty(startDate)} – ${fmtPretty(endDate)} · ${totalDays} days`
    : `Last ${PRESET_DAYS[preset]} days · ${fmtPretty(startDate)} – ${fmtPretty(endDate)}`;

  const handlePreset = (p: Preset) => {
    if (p === 'CUSTOM') { setRangeModal(true); return; }
    setPreset(p);
  };

  const granEnabled = (g: Gran) => (g === 'W' ? weeklyOK : g === 'M' ? monthlyOK : true);

  return (
    <View style={s.wrap}>
      {/* ── Period selector ── */}
      <View style={s.card}>
        <View style={s.pillRow}>
          {PRESETS.map(({ key, label }) => {
            const on = preset === key;
            return (
              <TouchableOpacity
                key={key}
                style={[s.pillBtn, on && s.pillBtnOn]}
                onPress={() => handlePreset(key)}
                activeOpacity={0.75}
              >
                <Text style={[s.pillTxt, on && s.pillTxtOn]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={s.subtitle}>{subtitle}</Text>
      </View>

      {/* ── Weight chart ── */}
      <View style={s.card}>
        <View style={s.chartHeader}>
          <View>
            <Text style={s.sectionTitle}>Weight</Text>
            <Text style={s.sectionSub}>kg over time</Text>
          </View>
          <View style={s.granRow}>
            {GRAN.map(({ key, label }) => {
              const on = gran === key;
              const enabled = granEnabled(key);
              return (
                <TouchableOpacity
                  key={key}
                  style={[s.granBtn, on && s.granBtnOn, !enabled && s.granBtnOff]}
                  onPress={() => enabled && setGran(key)}
                  disabled={!enabled}
                  activeOpacity={0.75}
                >
                  <Text style={[s.granTxt, on && s.granTxtOn, !enabled && s.granTxtOff]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <WeightChart points={points} svgW={svgW} />
      </View>

      {/* ── Averages ── */}
      <View style={s.summaryRow}>
        <View style={s.summaryCard}>
          <Text style={s.cardLabel}>Avg weight</Text>
          <Text style={[s.cardValue, { color: C.weight }]}>
            {stats.avgW != null ? stats.avgW.toFixed(1) : '—'}
            {stats.avgW != null && <Text style={s.cardUnit}> kg</Text>}
          </Text>
          <Text style={s.cardSub}>
            {stats.readings} reading{stats.readings === 1 ? '' : 's'}
          </Text>
        </View>
        <View style={s.summaryCard}>
          <Text style={s.cardLabel}>Exercise</Text>
          <Text style={[s.cardValue, { color: C.exercise }]}>{stats.exPct}%</Text>
          <Text style={s.cardSub}>{stats.exDays} of {totalDays} days</Text>
        </View>
        <View style={s.summaryCard}>
          <Text style={s.cardLabel}>Sugar</Text>
          <Text style={[s.cardValue, { color: C.sugar }]}>{stats.sugarPct}%</Text>
          <Text style={s.cardSub}>{stats.sugarDays} of {totalDays} days</Text>
        </View>
      </View>

      {/* ── History table ── */}
      <HistoryTable entries={tableEntries} onRowPress={onJumpToDate} />

      <DateRangeModal
        visible={rangeModal}
        initialStart={startDate}
        initialEnd={endDate}
        today={today}
        onApply={(start, end) => {
          setCustom({ start, end });
          setPreset('CUSTOM');
          setRangeModal(false);
        }}
        onClose={() => setRangeModal(false)}
      />
    </View>
  );
}

/* ─────────────────────────────────────────
   STYLES
───────────────────────────────────────── */
const s = StyleSheet.create({
  wrap: { gap: 12, paddingBottom: 8 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
    overflow: 'visible',
  },

  // Period pills
  pillRow: {
    flexDirection: 'row',
    backgroundColor: C.pill,
    borderRadius: 22,
    padding: 3,
    gap: 2,
  },
  pillBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 18,
    alignItems: 'center',
  },
  pillBtnOn: { backgroundColor: C.pillActive },
  pillTxt: { fontSize: 12.5, fontWeight: '700', color: '#9A9082' },
  pillTxtOn: { color: C.pillActiveText },
  subtitle: { fontSize: 11.5, color: '#9A9082', fontWeight: '600', marginTop: 9, textAlign: 'center' },

  // Chart card header
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  sectionSub: { fontSize: 11, fontWeight: '600', color: C.textMuted, marginTop: 1 },
  granRow: {
    flexDirection: 'row',
    backgroundColor: C.pill,
    borderRadius: 14,
    padding: 2,
    gap: 1,
  },
  granBtn: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12 },
  granBtnOn: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
  granBtnOff: {},
  granTxt: { fontSize: 11.5, fontWeight: '700', color: '#9A9082' },
  granTxtOn: { color: C.text },
  granTxtOff: { color: '#D2CCC3' },

  // Weight value readout (above the native chart)
  readout: {
    height: READOUT_H,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  readoutVal: { fontSize: 22, fontWeight: '800', color: C.weight, letterSpacing: -0.5 },
  readoutUnit: { fontSize: 12, fontWeight: '700', color: C.weight },
  readoutDate: { fontSize: 11.5, fontWeight: '600', color: C.textMuted },

  // Empty chart state (same footprint as the chart to avoid layout shift)
  chartEmpty: { height: CHART_H + READOUT_H, alignItems: 'center', justifyContent: 'center' },
  chartEmptyText: { fontSize: 12.5, color: C.textMuted, fontWeight: '600' },

  // Averages
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 13,
    paddingHorizontal: 12,
    gap: 3,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9A9082',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  cardValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  cardUnit: { fontSize: 12, fontWeight: '700' },
  cardSub: { fontSize: 10.5, fontWeight: '600', color: '#B5ADA2' },
});
