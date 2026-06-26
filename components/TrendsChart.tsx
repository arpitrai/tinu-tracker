import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import Svg, {
  Path,
  Rect,
  Circle as SvgCircle,
  Line as SvgLine,
  Text as SvgText,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';
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
  tooltip: '#1C1915',
  pill: '#F2F1EE',
  pillActive: '#3C3489',
  pillActiveText: '#EEEDFE',
};

/* ─────────────────────────────────────────
   CHART LAYOUT CONSTANTS
───────────────────────────────────────── */
const Y_LEFT = 44;      // left margin: space for Y-axis labels
const Y_RIGHT = 14;     // right margin
const WEIGHT_H = 180;   // weight plot height
const PT = 12;          // chart pad top
const X_AXIS_H = 24;    // x-axis tick area height
const DOT_R = 3.5;
const DOT_R_SEL = 5.5;  // selected data point radius

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
   SVG PATH HELPER (Catmull-Rom → cubic bézier)
───────────────────────────────────────── */
function catmullRom(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  const t = 1 / 3;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const cp1x = p1.x + (p2.x - p0.x) * t;
    const cp1y = p1.y + (p2.y - p0.y) * t;
    const cp2x = p2.x - (p3.x - p1.x) * t;
    const cp2y = p2.y - (p3.y - p1.y) * t;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)},${cp2x.toFixed(2)} ${cp2y.toFixed(2)},${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
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
   WEIGHT CHART
───────────────────────────────────────── */
function WeightChart({
  points, gran, svgW, selectedIdx, onSelect,
}: {
  points: Point[];
  gran: Gran;
  svgW: number;
  selectedIdx: number | null;
  onSelect: (i: number | null) => void;
}) {
  const svgH = PT + WEIGHT_H + X_AXIS_H;
  const plotW = svgW - Y_LEFT - Y_RIGHT;
  const n = points.length;

  const xPos = useMemo(() => {
    if (n === 0) return [];
    if (gran === 'D') {
      return points.map((_, i) => Y_LEFT + (n <= 1 ? plotW / 2 : (i * plotW) / (n - 1)));
    }
    const slotW = plotW / n;
    return points.map((_, i) => Y_LEFT + (i + 0.5) * slotW);
  }, [points, n, plotW, gran]);

  const validWeights = points.map(p => p.weight).filter((w): w is number => w !== null);

  if (!validWeights.length) {
    return (
      <Svg width={svgW} height={svgH}>
        <SvgText x={svgW / 2} y={svgH / 2} fontSize={12.5} fill={C.textMuted} textAnchor="middle">
          No weight logged in this period
        </SvgText>
      </Svg>
    );
  }

  const wMin = Math.min(...validWeights) - 1.5;
  const wMax = Math.max(...validWeights) + 1.5;
  const wRange = wMax - wMin || 1;

  const tickStep = wRange > 10 ? 5 : wRange > 5 ? 2 : wRange > 2 ? 1 : 0.5;
  const tickStart = Math.ceil(wMin / tickStep) * tickStep;
  const ticks: number[] = [];
  for (let v = tickStart; v <= wMax + tickStep * 0.01; v = Math.round((v + tickStep) * 1000) / 1000) {
    ticks.push(v);
  }

  const yFor = (w: number) => PT + (1 - (w - wMin) / wRange) * WEIGHT_H;
  const bottomY = PT + WEIGHT_H;
  const skipFactor = Math.max(1, Math.ceil(n / 8));
  const tapW = n > 1 ? Math.max(Math.abs(xPos[1] - xPos[0]), 22) : Math.max(plotW, 22);

  const TT_W = 124; const TT_H = 48;

  // Consecutive non-null segments for the line.
  const segments: { i: number; x: number; y: number }[][] = [];
  let cur: { i: number; x: number; y: number }[] = [];
  for (let i = 0; i < points.length; i++) {
    if (points[i].weight !== null) {
      cur.push({ i, x: xPos[i], y: yFor(points[i].weight!) });
    } else if (cur.length) {
      segments.push(cur); cur = [];
    }
  }
  if (cur.length) segments.push(cur);

  return (
    <View style={{ width: svgW }}>
    <Svg width={svgW} height={svgH} style={{ overflow: 'visible' }}>
      <Defs>
        <SvgLinearGradient id="wArea" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={C.weight} stopOpacity={0.14} />
          <Stop offset="100%" stopColor={C.weight} stopOpacity={0.0} />
        </SvgLinearGradient>
      </Defs>

      {/* Y grid + labels */}
      {ticks.map((v, ti) => {
        const y = yFor(v);
        if (y < PT - 4 || y > bottomY + 4) return null;
        return (
          <React.Fragment key={ti}>
            <SvgLine x1={Y_LEFT} y1={y} x2={Y_LEFT + plotW} y2={y} stroke={C.axisLine} strokeWidth={1} />
            <SvgText x={Y_LEFT - 7} y={y + 4} fontSize={10} fill={C.axis} textAnchor="end">
              {v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}
            </SvgText>
          </React.Fragment>
        );
      })}

      {/* Area fills */}
      {segments.map((seg, si) => {
        if (seg.length < 2) return null;
        const linePath = catmullRom(seg.map(p => ({ x: p.x, y: p.y })));
        const areaD = `${linePath} L ${seg[seg.length - 1].x} ${bottomY} L ${seg[0].x} ${bottomY} Z`;
        return <Path key={si} d={areaD} fill="url(#wArea)" />;
      })}

      {/* Lines */}
      {segments.map((seg, si) => {
        if (seg.length < 2) return null;
        return (
          <Path
            key={si}
            d={catmullRom(seg.map(p => ({ x: p.x, y: p.y })))}
            stroke={C.weight} strokeWidth={2.5}
            fill="none" strokeLinecap="round" strokeLinejoin="round"
          />
        );
      })}

      {/* Data points */}
      {n <= 95 && points.map((p, i) => {
        if (p.weight === null) return null;
        const sel = i === selectedIdx;
        return (
          <React.Fragment key={i}>
            <SvgCircle cx={xPos[i]} cy={yFor(p.weight)} r={(sel ? DOT_R_SEL : DOT_R) + 1.5} fill="white" />
            <SvgCircle cx={xPos[i]} cy={yFor(p.weight)} r={sel ? DOT_R_SEL : DOT_R} fill={C.weight} />
          </React.Fragment>
        );
      })}

      {/* X-axis */}
      <SvgLine x1={Y_LEFT} y1={bottomY} x2={Y_LEFT + plotW} y2={bottomY} stroke={C.axisLine} strokeWidth={1} />
      {points.map((p, i) => {
        if (i !== 0 && i !== n - 1 && i % skipFactor !== 0) return null;
        const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
        return (
          <SvgText key={i} x={xPos[i]} y={bottomY + X_AXIS_H - 6} fontSize={9.5} fill={C.axis} textAnchor={anchor}>
            {p.label}
          </SvgText>
        );
      })}

      {/* Tooltip (drawn in SVG; no onPress here so no web responder warnings) */}
      {selectedIdx !== null && points[selectedIdx]?.weight != null && (() => {
        const p = points[selectedIdx];
        const cx = xPos[selectedIdx];
        const cy = yFor(p.weight!);
        const ttX = Math.min(Math.max(cx - TT_W / 2, 2), svgW - TT_W - 2);
        const ttY = Math.max(cy - TT_H - 14, 2);
        return (
          <React.Fragment>
            <SvgLine x1={cx} y1={PT} x2={cx} y2={bottomY} stroke={C.weight} strokeWidth={1} strokeDasharray="3 3" opacity={0.4} />
            <Rect x={ttX} y={ttY} width={TT_W} height={TT_H} rx={9} fill={C.tooltip} />
            <SvgText x={ttX + TT_W / 2} y={ttY + 20} fontSize={15} fontWeight="700" fill="white" textAnchor="middle">
              {p.weight!.toFixed(1)} kg
            </SvgText>
            <SvgText x={ttX + TT_W / 2} y={ttY + 37} fontSize={9.5} fill="rgba(255,255,255,0.6)" textAnchor="middle">
              {p.tooltip}
            </SvgText>
          </React.Fragment>
        );
      })()}
    </Svg>

    {/* Tap overlay — real RN Pressables (not SVG onPress) so taps work on web/native cleanly. */}
    {points.map((p, i) => {
      if (p.weight === null) return null;
      return (
        <Pressable
          key={i}
          onPress={() => onSelect(i === selectedIdx ? null : i)}
          style={{ position: 'absolute', left: xPos[i] - tapW / 2, top: PT, width: tapW, height: WEIGHT_H }}
        />
      );
    })}
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
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

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

  // Clear any selected point when the window or granularity changes.
  useEffect(() => { setSelectedIdx(null); }, [startDate, endDate, gran]);

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

        <View style={s.chartBleed}>
          <WeightChart points={points} gran={gran} svgW={svgW} selectedIdx={selectedIdx} onSelect={setSelectedIdx} />
        </View>
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

  chartBleed: { marginHorizontal: -16, overflow: 'visible' },

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
