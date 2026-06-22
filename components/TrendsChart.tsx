import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import Svg, { Path, Circle as SvgCircle, Line as SvgLine, Text as SvgText, Rect } from 'react-native-svg';

/* ── Design tokens (defined first — referenced at module init time) ── */

const C = {
  bg: '#F5F5FA',
  card: '#FFFFFF',
  cardDeep: '#F0F1F8',
  border: 'rgba(0,0,0,0.07)',
  accent: '#6C6FFF',
  green: '#00C896',
  amber: '#F59E0B',
  red: '#FF4D4D',
  text: '#0C0D1A',
  textSec: '#8E8EA0',
  textMuted: '#C0C4D0',
};

/* ── Types ── */

export interface ChartEntry {
  date: string;
  exercised: boolean | null;
  ate_sweets: boolean | null;
  weight?: string | number | null;
}

type Period = 'D' | 'W' | 'M' | 'Y';

interface DataPoint {
  label: string;
  tooltipLabel: string;
  weight: number | null;
  exercisedPct: number | null;
  sweetsPct: number | null;
}

/* ── Helpers ── */

export function parseWeight(w: string | number | null | undefined): number | null {
  if (w == null || w === '') return null;
  const n = parseFloat(String(w));
  return isNaN(n) ? null : n;
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function dotColorForPoint(exPct: number | null, swPct: number | null): string {
  if (exPct === null && swPct === null) return C.textMuted;
  const score = (exPct ?? 0.5) + (1 - (swPct ?? 0.5));
  if (score >= 1.4) return C.green;
  if (score >= 0.6) return C.amber;
  return C.red;
}

export function niceScale(minVal: number, maxVal: number) {
  const range = maxVal - minVal || 1;
  const rawStep = range / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = ([1, 2, 2.5, 5, 10].map(n => n * mag).find(s => s >= rawStep)) ?? mag * 10;
  const niceMin = Math.floor(minVal / step) * step;
  const niceMax = Math.ceil(maxVal / step) * step;
  const sections = Math.max(1, Math.round((niceMax - niceMin) / step));
  return { niceMin, niceMax, sections };
}

/* ── Aggregation ── */

function weekKey(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const monday = new Date(dt);
  monday.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  return monday.toISOString().split('T')[0];
}

function groupBy(entries: ChartEntry[], keyFn: (d: string) => string): Map<string, ChartEntry[]> {
  const map = new Map<string, ChartEntry[]>();
  for (const e of entries) {
    const k = keyFn(e.date);
    const arr = map.get(k) ?? [];
    arr.push(e);
    map.set(k, arr);
  }
  return map;
}

function generateMonthDays(entries: ChartEntry[]): DataPoint[] {
  const entryMap = new Map(entries.map(e => [e.date, e]));
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const days: DataPoint[] = [];
  for (let d = 1; d <= today.getDate(); d++) {
    const dt = new Date(year, month, d);
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const e = entryMap.get(dateKey) ?? null;
    const dayShort = dt.toLocaleDateString('en-US', { weekday: 'short' });
    const dayLong = dt.toLocaleDateString('en-US', { weekday: 'long' });
    const monthShort = dt.toLocaleDateString('en-US', { month: 'short' });
    days.push({
      label: `${d} (${dayShort})`,
      tooltipLabel: `${dayLong}, ${d} ${monthShort}`,
      weight: e ? parseWeight(e.weight) : null,
      exercisedPct: e ? (e.exercised === null ? null : e.exercised ? 1 : 0) : null,
      sweetsPct: e ? (e.ate_sweets === null ? null : e.ate_sweets ? 1 : 0) : null,
    });
  }
  return days;
}

function aggregate(entries: ChartEntry[], period: Period): DataPoint[] {
  if (period === 'D') return generateMonthDays(entries);
  if (!entries.length) return [];
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  const keyFn = period === 'W' ? weekKey
    : period === 'M' ? (d: string) => d.slice(0, 7)
    : (d: string) => d.slice(0, 4);

  const labelAndTooltip = (k: string): { label: string; tooltipLabel: string } => {
    if (period === 'W') {
      const [y, m, d] = k.split('-').map(Number);
      const start = new Date(y, m - 1, d);
      const end = new Date(y, m - 1, d + 6);
      const fmt = { month: 'short', day: 'numeric' } as const;
      return {
        label: start.toLocaleDateString('en-US', fmt),
        tooltipLabel: `${start.toLocaleDateString('en-US', fmt)} – ${end.toLocaleDateString('en-US', fmt)}`,
      };
    }
    if (period === 'M') {
      const [y, m] = k.split('-').map(Number);
      const dt = new Date(y, m - 1, 1);
      return {
        label: dt.toLocaleDateString('en-US', { month: 'short' }),
        tooltipLabel: dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      };
    }
    return { label: k, tooltipLabel: k };
  };

  const maxGroups = period === 'Y' ? 999 : 12;
  const groups = groupBy(sorted, keyFn);
  return Array.from(groups.keys()).sort().slice(-maxGroups).map(k => {
    const grp = groups.get(k)!;
    const ws = grp.map(e => parseWeight(e.weight)).filter((w): w is number => w !== null);
    const trackedEx = grp.filter(e => e.exercised !== null);
    const trackedSw = grp.filter(e => e.ate_sweets !== null);
    return {
      ...labelAndTooltip(k),
      weight: ws.length ? avg(ws)! : null,
      exercisedPct: trackedEx.length ? trackedEx.filter(e => e.exercised).length / trackedEx.length : null,
      sweetsPct: trackedSw.length ? trackedSw.filter(e => e.ate_sweets).length / trackedSw.length : null,
    };
  });
}

/* ── Constants ── */

const PERIODS: { key: Period; label: string }[] = [
  { key: 'D', label: 'Daily' },
  { key: 'W', label: 'Weekly' },
  { key: 'M', label: 'Monthly' },
  { key: 'Y', label: 'Yearly' },
];

const Y_LABEL_W = 44;
const PAD_RIGHT = 12;
const PAD_TOP = 14;
const PAD_BOTTOM = 30;
const CHART_H = 180;
const MIN_PT_SPACING = 28;

/* ── SVG Chart (web + native fallback) ── */

function WeightSvgChart({
  points,
  niceMin,
  niceMax,
  sections,
  availableWidth,
}: {
  points: DataPoint[];
  niceMin: number;
  niceMax: number;
  sections: number;
  availableWidth: number;
}) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const n = points.length;
  const plotW = Math.max(
    availableWidth - Y_LABEL_W - PAD_RIGHT,
    n > 1 ? (n - 1) * MIN_PT_SPACING : MIN_PT_SPACING,
  );
  const svgW = plotW + Y_LABEL_W + PAD_RIGHT;
  const svgH = PAD_TOP + CHART_H + PAD_BOTTOM;
  const yRange = niceMax - niceMin || 1;

  const xFor = (i: number) =>
    Y_LABEL_W + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yFor = (w: number) =>
    PAD_TOP + (1 - (w - niceMin) / yRange) * CHART_H;

  const gridVals = Array.from(
    { length: sections + 1 },
    (_, i) => niceMin + (yRange / sections) * i,
  );

  const runs: number[][] = [];
  let cur: number[] = [];
  for (let i = 0; i < n; i++) {
    if (points[i].weight !== null) {
      cur.push(i);
    } else {
      if (cur.length) { runs.push(cur); cur = []; }
    }
  }
  if (cur.length) runs.push(cur);

  const labelEvery = n <= 7 ? 1 : n <= 15 ? 2 : n <= 21 ? 3 : 5;

  const sel = selectedIdx !== null ? points[selectedIdx] : null;
  const TT_W = 100; const TT_H = 46;
  const ttX = selectedIdx !== null
    ? Math.min(Math.max(xFor(selectedIdx) - TT_W / 2, Y_LABEL_W), svgW - TT_W - PAD_RIGHT)
    : 0;
  const ttY = sel?.weight != null
    ? Math.max(yFor(sel.weight) - TT_H - 10, PAD_TOP)
    : 0;

  return (
    <View style={{ overflow: 'hidden' }}>
      <Svg width={Math.min(svgW, availableWidth + 40)} height={svgH}>
        {gridVals.map((val, gi) => {
          const y = yFor(val);
          return (
            <React.Fragment key={gi}>
              <SvgLine x1={Y_LABEL_W} y1={y} x2={Y_LABEL_W + plotW} y2={y}
                stroke="rgba(0,0,0,0.05)" strokeWidth={1} />
              <SvgText x={Y_LABEL_W - 6} y={y + 4}
                fontSize={11} fill={C.textSec} textAnchor="end">
                {Math.round(val).toString()}
              </SvgText>
            </React.Fragment>
          );
        })}

        {runs.map((run, ri) => {
          if (run.length < 2) return null;
          const d = run
            .map((idx, j) => `${j === 0 ? 'M' : 'L'} ${xFor(idx).toFixed(1)} ${yFor(points[idx].weight!).toFixed(1)}`)
            .join(' ');
          return (
            <Path key={ri} d={d} stroke={C.accent} strokeWidth={2.5}
              fill="none" strokeLinecap="round" strokeLinejoin="round" />
          );
        })}

        {points.map((p, i) => {
          if (p.weight === null) return null;
          const cx = xFor(i);
          const cy = yFor(p.weight);
          const fill = dotColorForPoint(p.exercisedPct, p.sweetsPct);
          const selected = i === selectedIdx;
          return (
            <React.Fragment key={i}>
              <SvgCircle cx={cx} cy={cy} r={16} fill="transparent"
                onPress={() => setSelectedIdx(i === selectedIdx ? null : i)} />
              {selected && <SvgCircle cx={cx} cy={cy} r={9} fill="white" />}
              <SvgCircle cx={cx} cy={cy} r={selected ? 6 : 5} fill={fill} />
            </React.Fragment>
          );
        })}

        {points.map((p, i) => {
          if (i !== 0 && i !== n - 1 && i % labelEvery !== 0) return null;
          return (
            <SvgText key={i} x={xFor(i)} y={PAD_TOP + CHART_H + 18}
              fontSize={10} fill={C.textSec} textAnchor="middle">
              {p.label.split(' ')[0]}
            </SvgText>
          );
        })}

        {sel && sel.weight !== null && (
          <>
            <SvgLine x1={xFor(selectedIdx!)} y1={PAD_TOP}
              x2={xFor(selectedIdx!)} y2={PAD_TOP + CHART_H}
              stroke={C.accent + '50'} strokeWidth={1} strokeDasharray="4,3" />
            <Rect x={ttX} y={ttY} width={TT_W} height={TT_H} rx={8} fill={C.text} />
            <SvgText x={ttX + TT_W / 2} y={ttY + 17}
              fontSize={13} fontWeight="700" fill="white" textAnchor="middle">
              {sel.weight.toFixed(1)} kg
            </SvgText>
            <SvgText x={ttX + TT_W / 2} y={ttY + 34}
              fontSize={10} fill="rgba(255,255,255,0.65)" textAnchor="middle">
              {sel.tooltipLabel}
            </SvgText>
          </>
        )}
      </Svg>
    </View>
  );
}

/* ── Victory Native Chart (iOS / Android only) ── */

let WeightVictoryChart: React.ComponentType<{
  points: DataPoint[];
  niceMin: number;
  niceMax: number;
  sections: number;
  availableWidth: number;
}> = WeightSvgChart; // default fallback

if (Platform.OS !== 'web') {
  // Loaded lazily so web bundler never instantiates Skia
  const { CartesianChart, Line, useChartPressState } =
    require('victory-native') as typeof import('victory-native');
  const { Circle, matchFont } =
    require('@shopify/react-native-skia') as typeof import('@shopify/react-native-skia');
  const { useAnimatedStyle, useAnimatedReaction, runOnJS, default: Animated } =
    require('react-native-reanimated') as typeof import('react-native-reanimated');

  const CHART_CONTAINER_H = 220;
  const TT_W_V = 110;
  const TT_H_V = 48;

  WeightVictoryChart = function NativeChart({ points, niceMin, niceMax, sections, availableWidth }) {
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
    const { state, isActive } = useChartPressState({ x: 0, y: { weight: 0 } });

    const chartData = useMemo(
      () => points.map((p, i) => ({ day: i, weight: p.weight })),
      [points],
    );
    const dotColors = useMemo(
      () => points.map(p => dotColorForPoint(p.exercisedPct, p.sweetsPct)),
      [points],
    );
    const n = points.length;

    const font = useMemo(() => {
      try {
        return matchFont({
          fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
          fontSize: 10,
          fontStyle: 'normal',
          fontWeight: 'normal',
        });
      } catch { return null; }
    }, []);

    useAnimatedReaction(
      () => ({ active: state.isActive.value, xVal: state.x.value.value as number }),
      ({ active, xVal }) => {
        runOnJS(setSelectedIdx)(active ? Math.round(xVal) : null);
      },
    );

    const tooltipStyle = useAnimatedStyle(() => {
      const xPos = state.x.position.value;
      const yPos = state.y.weight.position.value;
      return {
        opacity: state.isActive.value ? 1 : 0,
        transform: [
          { translateX: Math.max(0, Math.min(xPos - TT_W_V / 2, availableWidth - TT_W_V)) },
          { translateY: Math.max(4, yPos - TT_H_V - 12) },
        ],
      };
    });

    const selPoint = selectedIdx !== null && selectedIdx >= 0 && selectedIdx < n
      ? points[selectedIdx] : null;

    return (
      <View style={{ position: 'relative', height: CHART_CONTAINER_H }}>
        <CartesianChart
          data={chartData}
          xKey="day"
          yKeys={['weight']}
          domain={{ y: [niceMin, niceMax] }}
          domainPadding={{ left: 20, right: 20, top: 10 }}
          chartPressState={state}
          axisOptions={{
            font,
            tickCount: { x: Math.min(n, 7), y: sections + 1 },
            formatXLabel: (val: number) => {
              const idx = Math.round(Number(val));
              if (idx < 0 || idx >= n) return '';
              return points[idx].label.split(' ')[0];
            },
            formatYLabel: (val: number) => Math.round(Number(val)).toString(),
            labelColor: C.textSec,
            lineColor: {
              grid: { x: 'transparent', y: 'rgba(0,0,0,0.05)' },
              frame: 'rgba(0,0,0,0.07)',
            },
          }}
        >
          {({ points: pts }: any) => (
            <>
              <Line
                points={pts.weight}
                color={C.accent}
                strokeWidth={2.5}
                connectMissingData={false}
              />
              {pts.weight.map((pt: any, i: number) => {
                if (typeof pt.y !== 'number') return null;
                return (
                  <Circle key={i} cx={pt.x} cy={pt.y} r={5}
                    color={dotColors[i] ?? C.textMuted} />
                );
              })}
            </>
          )}
        </CartesianChart>

        <Animated.View style={[nativeStyles.tooltip, tooltipStyle]} pointerEvents="none">
          {isActive && selPoint?.weight != null && (
            <>
              <Text style={nativeStyles.tooltipValue}>{selPoint.weight.toFixed(1)} kg</Text>
              <Text style={nativeStyles.tooltipDate}>{selPoint.tooltipLabel}</Text>
            </>
          )}
        </Animated.View>
      </View>
    );
  };
}

const nativeStyles = StyleSheet.create({
  tooltip: {
    position: 'absolute',
    width: 110,
    height: 48,
    backgroundColor: C.text,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    zIndex: 10,
  },
  tooltipValue: { fontSize: 13, fontWeight: '700', color: '#fff' },
  tooltipDate: { fontSize: 10, color: 'rgba(255,255,255,0.65)' },
});

/* ── Main component ── */

export default function TrendsChart({ entries }: { entries: ChartEntry[] }) {
  const [period, setPeriod] = useState<Period>('D');
  const { width } = useWindowDimensions();
  const chartWidth = width - 32;

  const points = useMemo(() => aggregate(entries, period), [entries, period]);

  const rawWeights = useMemo(
    () => points.map(p => p.weight).filter((w): w is number => w !== null),
    [points],
  );

  const { niceMin, niceMax, sections } = useMemo(() => {
    if (!rawWeights.length) return { niceMin: 0, niceMax: 100, sections: 4 };
    return niceScale(Math.min(...rawWeights) - 2, Math.max(...rawWeights) + 2);
  }, [rawWeights]);

  const hasWeight = rawWeights.length > 0;

  const insightStats = useMemo(() => {
    const withWeight = entries.filter(e => parseWeight(e.weight) !== null);
    const wOf = (sub: ChartEntry[]) =>
      avg(sub.map(e => parseWeight(e.weight) as number));
    const exDays = withWeight.filter(e => e.exercised === true);
    const restDays = withWeight.filter(e => e.exercised === false);
    const cleanDays = withWeight.filter(e => e.ate_sweets === false);
    const sweetDays = withWeight.filter(e => e.ate_sweets === true);
    return {
      exercise: exDays.length >= 2 && restDays.length >= 2
        ? { active: wOf(exDays)!, rest: wOf(restDays)! } : null,
      sweets: cleanDays.length >= 2 && sweetDays.length >= 2
        ? { clean: wOf(cleanDays)!, sweets: wOf(sweetDays)! } : null,
    };
  }, [entries]);

  return (
    <View style={styles.container}>
      {/* Period tabs */}
      <View style={styles.periodBar}>
        {PERIODS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.periodBtn, period === key && styles.periodBtnActive]}
            onPress={() => setPeriod(key)}
            activeOpacity={0.75}
          >
            <Text style={[styles.periodText, period === key && styles.periodTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <LegendDot color={C.green} label="Healthy day" />
        <LegendDot color={C.amber} label="Mixed" />
        <LegendDot color={C.red} label="Unhealthy day" />
        <LegendDot color={C.textMuted} label="No data" />
      </View>

      {!hasWeight ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No weight data logged yet</Text>
        </View>
      ) : (
        <View style={styles.chartWrap}>
          <Text style={styles.axisLabel}>Weight (kg)</Text>
          <WeightVictoryChart
            points={points}
            niceMin={niceMin}
            niceMax={niceMax}
            sections={sections}
            availableWidth={chartWidth}
          />
        </View>
      )}

      {/* Insight cards */}
      {(insightStats.exercise || insightStats.sweets) && (
        <View style={styles.insightSection}>
          <Text style={styles.insightHeading}>How habits affect your weight</Text>
          {insightStats.exercise && (
            <InsightCard
              icon="🏃"
              title="Exercise"
              leftLabel="Exercise days"
              leftValue={insightStats.exercise.active}
              rightLabel="Rest days"
              rightValue={insightStats.exercise.rest}
              lowerIsBetter
            />
          )}
          {insightStats.sweets && (
            <InsightCard
              icon="🍬"
              title="Sweets"
              leftLabel="No sweets"
              leftValue={insightStats.sweets.clean}
              rightLabel="Sweets days"
              rightValue={insightStats.sweets.sweets}
              lowerIsBetter
            />
          )}
        </View>
      )}
    </View>
  );
}

/* ── Sub-components ── */

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function InsightCard({
  icon, title, leftLabel, leftValue, rightLabel, rightValue, lowerIsBetter,
}: {
  icon: string; title: string;
  leftLabel: string; leftValue: number;
  rightLabel: string; rightValue: number;
  lowerIsBetter: boolean;
}) {
  const delta = leftValue - rightValue;
  const healthyDelta = lowerIsBetter ? delta < 0 : delta > 0;
  const absDelta = Math.abs(delta);
  const direction = lowerIsBetter
    ? (delta < 0 ? 'lighter' : 'heavier')
    : (delta > 0 ? 'heavier' : 'lighter');
  const deltaColor = healthyDelta ? C.green : absDelta < 0.1 ? C.textSec : C.red;

  return (
    <View style={styles.insightCard}>
      <View style={styles.insightCardHeader}>
        <Text style={styles.insightCardIcon}>{icon}</Text>
        <Text style={styles.insightCardTitle}>{title} impact</Text>
      </View>
      <View style={styles.insightStats}>
        <View style={styles.insightStat}>
          <Text style={styles.insightStatValue}>{leftValue.toFixed(1)} kg</Text>
          <Text style={styles.insightStatLabel}>{leftLabel}</Text>
        </View>
        <View style={styles.insightDivider} />
        <View style={styles.insightStat}>
          <Text style={styles.insightStatValue}>{rightValue.toFixed(1)} kg</Text>
          <Text style={styles.insightStatLabel}>{rightLabel}</Text>
        </View>
      </View>
      {absDelta >= 0.1 && (
        <View style={[styles.insightDeltaBadge, {
          backgroundColor: deltaColor + '18',
          borderColor: deltaColor + '40',
        }]}>
          <Text style={[styles.insightDeltaText, { color: deltaColor }]}>
            {leftLabel} avg {absDelta.toFixed(1)} kg {direction} on {rightLabel.toLowerCase()}
          </Text>
        </View>
      )}
    </View>
  );
}

/* ── Styles ── */

const styles = StyleSheet.create({
  container: {
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },

  periodBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  periodBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  periodBtnActive: { borderBottomWidth: 2, borderBottomColor: C.accent },
  periodText: { fontSize: 13, fontWeight: '500', color: C.textSec },
  periodTextActive: { color: C.accent, fontWeight: '700' },

  legend: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexWrap: 'wrap',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: C.textSec },

  chartWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  axisLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.textSec,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },

  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 14, color: C.textSec },

  insightSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 12,
  },
  insightHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textSec,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  insightCard: {
    backgroundColor: C.cardDeep,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  insightCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  insightCardIcon: { fontSize: 16 },
  insightCardTitle: { fontSize: 13, fontWeight: '700', color: C.text },
  insightStats: { flexDirection: 'row', alignItems: 'center' },
  insightStat: { flex: 1, alignItems: 'center', gap: 2 },
  insightStatValue: { fontSize: 20, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  insightStatLabel: { fontSize: 11, color: C.textSec },
  insightDivider: { width: 1, height: 36, backgroundColor: C.border },
  insightDeltaBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  insightDeltaText: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
