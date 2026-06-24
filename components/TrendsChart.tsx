import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
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

/* ─────────────────────────────────────────
   COLOURS
───────────────────────────────────────── */
const C = {
  weight: '#534AB7',
  weightArea0: 'rgba(83,74,183,0.13)',
  weightArea1: 'rgba(83,74,183,0.00)',
  sugar: '#D4537E',
  sugarFill: 'rgba(212,83,126,0.30)',
  sugarStroke: 'rgba(153,53,86,0.65)',
  exercise: '#1D9E75',
  exerciseFill: 'rgba(29,158,117,0.28)',
  exerciseStroke: 'rgba(15,110,86,0.60)',
  axis: '#B8B2AA',
  axisLine: 'rgba(0,0,0,0.07)',
  text: '#1C1915',
  textMuted: '#9A9082',
  surface: '#FAFAF8',
  border: 'rgba(0,0,0,0.06)',
  tooltip: '#1C1915',
  pill: '#F2F1EE',
  pillActive: '#3C3489',
  pillActiveText: '#EEEDFE',
};

/* ─────────────────────────────────────────
   CHART LAYOUT CONSTANTS
───────────────────────────────────────── */
const Y_LEFT = 52;      // left margin: space for Y-axis labels
const Y_RIGHT = 62;     // right margin: space for right labels / right axis
const WEIGHT_H = 172;   // weight chart plot height (excluding pad)
const PT = 10;          // chart pad top
const BOOL_ROW = 36;    // height of one boolean row (sugar or exercise)
const BOOL_GAP = 10;    // gap between sugar row and exercise row
const BOOL_H = BOOL_ROW * 2 + BOOL_GAP; // total boolean chart height
const PCT_H = 110;      // percentage bars chart height
const X_AXIS_H = 26;    // x-axis tick area height
const DOT_R = 3.5;      // data point circle radius
const DOT_R_SEL = 5.5;  // selected data point circle radius

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
export interface ChartEntry {
  date: string;                    // YYYY-MM-DD
  exercised?: boolean | null;
  ate_sweets?: boolean | null;
  weight?: string | number | null;
}

interface DataPoint {
  key: string;           // raw key (date or period key)
  label: string;         // short x-axis label
  tooltipLabel: string;  // full label for tooltip
  weight: number | null;
  sugarPct: number | null;    // 0–100
  exercisePct: number | null; // 0–100
  sugarBool: boolean | null;  // daily only
  exerciseBool: boolean | null;
}

type Granularity = 'D' | 'W' | 'M' | 'Q';
type Preset = '7D' | '30D' | '90D' | '1Y' | 'ALL';

/* ─────────────────────────────────────────
   DATE / NUMBER HELPERS
───────────────────────────────────────── */
export function parseWeight(w: string | number | null | undefined): number | null {
  if (w == null || w === '') return null;
  const n = parseFloat(String(w));
  return isNaN(n) ? null : n;
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function mondayOfWeek(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay();
  dt.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day));
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function quarterKey(dateStr: string): string {
  const [y, m] = dateStr.split('-').map(Number);
  return `${y}-Q${Math.ceil(m / 3)}`;
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatLabel(key: string, g: Granularity): { label: string; tooltip: string } {
  if (g === 'D') {
    const [y, m, d] = key.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return {
      label: `${d} ${MON[m - 1]}`,
      tooltip: dt.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
    };
  }
  if (g === 'W') {
    const [y, m, d] = key.split('-').map(Number);
    return {
      label: `${String(d).padStart(2, '0')} ${MON[m - 1]}`,
      tooltip: `Week of ${String(d).padStart(2, '0')} ${MON[m - 1]} ${y}`,
    };
  }
  if (g === 'M') {
    const [y, m] = key.split('-').map(Number);
    return { label: MON[m - 1], tooltip: `${MON[m - 1]} ${y}` };
  }
  // Quarterly: "2024-Q2"
  const parts = key.split('-');
  return { label: `${parts[1]} ${parts[0]}`, tooltip: `${parts[1]} ${parts[0]}` };
}

function fmtDateDisplay(d: string): string {
  const [y, m, day] = d.split('-').map(Number);
  return `${day} ${MON[m - 1]} ${y}`;
}

/* ─────────────────────────────────────────
   AGGREGATION
───────────────────────────────────────── */
function numAvg(nums: number[]): number | null {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

function aggregate(
  entries: ChartEntry[],
  g: Granularity,
  start: string,
  end: string,
): DataPoint[] {
  const filtered = entries.filter(e => e.date >= start && e.date <= end);
  if (!filtered.length) return [];

  if (g === 'D') {
    const map = new Map(filtered.map(e => [e.date, e]));
    const pts: DataPoint[] = [];
    let cur = start;
    while (cur <= end) {
      const e = map.get(cur);
      const { label, tooltip } = formatLabel(cur, 'D');
      pts.push({
        key: cur,
        label,
        tooltipLabel: tooltip,
        weight: e ? parseWeight(e.weight) : null,
        sugarPct: e && e.ate_sweets != null ? (e.ate_sweets ? 100 : 0) : null,
        exercisePct: e && e.exercised != null ? (e.exercised ? 100 : 0) : null,
        sugarBool: e?.ate_sweets ?? null,
        exerciseBool: e?.exercised ?? null,
      });
      cur = addDays(cur, 1);
    }
    return pts;
  }

  const keyFn = g === 'W' ? mondayOfWeek : g === 'M' ? monthKey : quarterKey;
  const groups = new Map<string, ChartEntry[]>();
  for (const e of filtered) {
    const k = keyFn(e.date);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(e);
  }

  return Array.from(groups.keys())
    .sort()
    .map(k => {
      const grp = groups.get(k)!;
      const { label, tooltip } = formatLabel(k, g);
      const ws = grp.map(e => parseWeight(e.weight)).filter((w): w is number => w !== null);
      const tSugar = grp.filter(e => e.ate_sweets != null);
      const tEx = grp.filter(e => e.exercised != null);
      return {
        key: k,
        label,
        tooltipLabel: tooltip,
        weight: numAvg(ws),
        sugarPct: tSugar.length ? (tSugar.filter(e => e.ate_sweets).length / tSugar.length) * 100 : null,
        exercisePct: tEx.length ? (tEx.filter(e => e.exercised).length / tEx.length) * 100 : null,
        sugarBool: null,
        exerciseBool: null,
      };
    });
}

/* ─────────────────────────────────────────
   SVG PATH HELPERS
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
   WEIGHT CHART
───────────────────────────────────────── */
interface WeightChartProps {
  points: DataPoint[];
  xPos: number[];      // x positions shared with lower chart
  svgW: number;
  selectedIdx: number | null;
  onSelect: (i: number | null) => void;
}

function WeightChart({ points, xPos, svgW, selectedIdx, onSelect }: WeightChartProps) {
  const svgH = PT + WEIGHT_H;
  const plotW = svgW - Y_LEFT - Y_RIGHT;

  const validWeights = points.map(p => p.weight).filter((w): w is number => w !== null);
  if (!validWeights.length) {
    return (
      <Svg width={svgW} height={svgH}>
        <SvgText x={svgW / 2} y={svgH / 2} fontSize={12} fill={C.textMuted} textAnchor="middle">
          No weight data
        </SvgText>
      </Svg>
    );
  }

  const wMin = Math.min(...validWeights) - 1.5;
  const wMax = Math.max(...validWeights) + 1.5;
  const wRange = wMax - wMin || 1;

  // Y-axis ticks at round intervals
  const tickStep = wRange > 10 ? 5 : wRange > 5 ? 2 : wRange > 2 ? 1 : 0.5;
  const tickStart = Math.ceil(wMin / tickStep) * tickStep;
  const ticks: number[] = [];
  for (let v = tickStart; v <= wMax + tickStep * 0.01; v = Math.round((v + tickStep) * 1000) / 1000) {
    ticks.push(v);
  }

  const yFor = (w: number) => PT + (1 - (w - wMin) / wRange) * WEIGHT_H;
  const bottomY = PT + WEIGHT_H;

  // Build consecutive non-null segments for line drawing
  const segments: { i: number; x: number; y: number }[][] = [];
  let cur: { i: number; x: number; y: number }[] = [];
  for (let i = 0; i < points.length; i++) {
    if (points[i].weight !== null) {
      cur.push({ i, x: xPos[i], y: yFor(points[i].weight!) });
    } else {
      if (cur.length) { segments.push(cur); cur = []; }
    }
  }
  if (cur.length) segments.push(cur);

  const TT_W = 112; const TT_H = 48;

  return (
    <Svg width={svgW} height={svgH} style={{ overflow: 'visible' }}>
      <Defs>
        <SvgLinearGradient id="wArea" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={C.weight} stopOpacity={0.13} />
          <Stop offset="100%" stopColor={C.weight} stopOpacity={0.0} />
        </SvgLinearGradient>
      </Defs>

      {/* Y-axis grid lines + labels */}
      {ticks.map((v, ti) => {
        const y = yFor(v);
        if (y < PT - 4 || y > bottomY + 4) return null;
        return (
          <React.Fragment key={ti}>
            <SvgLine x1={Y_LEFT} y1={y} x2={Y_LEFT + plotW} y2={y}
              stroke={C.axisLine} strokeWidth={1} />
            <SvgText x={Y_LEFT - 6} y={y + 4} fontSize={10} fill={C.axis} textAnchor="end">
              {v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}
            </SvgText>
          </React.Fragment>
        );
      })}

      {/* Rotated Y-axis label */}
      <SvgText
        x={9} y={PT + WEIGHT_H / 2}
        fontSize={9} fill={C.weight} textAnchor="middle"
        transform={`rotate(-90, 9, ${PT + WEIGHT_H / 2})`}
      >
        Weight (kg)
      </SvgText>

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
      {points.length <= 90 && points.map((p, i) => {
        if (p.weight === null) return null;
        const cx = xPos[i];
        const cy = yFor(p.weight);
        const sel = i === selectedIdx;
        return (
          <React.Fragment key={i}>
            <SvgCircle cx={cx} cy={cy} r={sel ? DOT_R_SEL + 2.5 : DOT_R + 1.5} fill="white" />
            <SvgCircle cx={cx} cy={cy} r={sel ? DOT_R_SEL : DOT_R} fill={C.weight} />
          </React.Fragment>
        );
      })}

      {/* Tap targets */}
      {points.map((p, i) => {
        if (p.weight === null) return null;
        const cx = xPos[i];
        const tapW = xPos.length > 1
          ? Math.max((xPos[1] - xPos[0]), 22)
          : Math.max(plotW, 22);
        return (
          <Rect
            key={i}
            x={cx - tapW / 2} y={PT}
            width={tapW} height={WEIGHT_H}
            fill="transparent"
            onPress={() => onSelect(i === selectedIdx ? null : i)}
          />
        );
      })}

      {/* Tooltip */}
      {selectedIdx !== null && points[selectedIdx]?.weight != null && (() => {
        const p = points[selectedIdx];
        const cx = xPos[selectedIdx];
        const cy = yFor(p.weight!);
        const ttX = Math.min(Math.max(cx - TT_W / 2, Y_LEFT + 2), Y_LEFT + plotW - TT_W - 2);
        const ttY = Math.max(cy - TT_H - 14, PT + 2);
        return (
          <React.Fragment>
            <Rect x={ttX} y={ttY} width={TT_W} height={TT_H} rx={8} fill={C.tooltip} />
            <SvgText x={ttX + TT_W / 2} y={ttY + 18} fontSize={14} fontWeight="700" fill="white" textAnchor="middle">
              {p.weight!.toFixed(1)} kg
            </SvgText>
            <SvgText x={ttX + TT_W / 2} y={ttY + 36} fontSize={9.5} fill="rgba(255,255,255,0.55)" textAnchor="middle">
              {p.tooltipLabel}
            </SvgText>
          </React.Fragment>
        );
      })()}

      {/* Bottom border */}
      <SvgLine x1={Y_LEFT} y1={bottomY} x2={Y_LEFT + plotW} y2={bottomY}
        stroke={C.axisLine} strokeWidth={1} />
    </Svg>
  );
}

/* ─────────────────────────────────────────
   BOOLEAN CHART  (Daily view)
───────────────────────────────────────── */
interface BoolChartProps {
  points: DataPoint[];
  xPos: number[];
  svgW: number;
  selectedIdx: number | null;
  onSelect: (i: number | null) => void;
  skipFactor: number;
}

function BoolChart({ points, xPos, svgW, selectedIdx, onSelect, skipFactor }: BoolChartProps) {
  const svgH = BOOL_H + X_AXIS_H;
  const plotW = svgW - Y_LEFT - Y_RIGHT;
  const n = points.length;
  const slotW = n > 1 ? plotW / (n - 1) : plotW;
  const barW = Math.max(2.5, Math.min(slotW * 0.7, 15));

  const sugarTop = 0;
  const exTop = BOOL_ROW + BOOL_GAP;

  const TT_W = 132; const TT_H = 62;

  return (
    <Svg width={svgW} height={svgH} style={{ overflow: 'visible' }}>
      {/* Bars */}
      {points.map((p, i) => {
        const cx = xPos[i];
        const bx = cx - barW / 2;
        return (
          <React.Fragment key={i}>
            {p.sugarBool === true && (
              <Rect x={bx} y={sugarTop + 2} width={barW} height={BOOL_ROW - 4} rx={2}
                fill={C.sugarFill} stroke={C.sugarStroke} strokeWidth={0.8} />
            )}
            {p.exerciseBool === true && (
              <Rect x={bx} y={exTop + 2} width={barW} height={BOOL_ROW - 4} rx={2}
                fill={C.exerciseFill} stroke={C.exerciseStroke} strokeWidth={0.8} />
            )}
          </React.Fragment>
        );
      })}

      {/* Row divider */}
      <SvgLine x1={Y_LEFT} y1={BOOL_ROW + BOOL_GAP / 2}
        x2={Y_LEFT + plotW} y2={BOOL_ROW + BOOL_GAP / 2}
        stroke={C.axisLine} strokeWidth={1} />

      {/* Right-side row labels */}
      <SvgText x={Y_LEFT + plotW + 6} y={sugarTop + BOOL_ROW / 2 + 4}
        fontSize={9.5} fill={C.sugar} fontWeight="600">
        Sugar
      </SvgText>
      <SvgText x={Y_LEFT + plotW + 6} y={exTop + BOOL_ROW / 2 + 4}
        fontSize={9.5} fill={C.exercise} fontWeight="600">
        Exer.
      </SvgText>

      {/* X-axis line */}
      <SvgLine x1={Y_LEFT} y1={BOOL_H} x2={Y_LEFT + plotW} y2={BOOL_H}
        stroke={C.axisLine} strokeWidth={1} />

      {/* X-axis labels */}
      {points.map((p, i) => {
        if (i !== 0 && i !== n - 1 && i % skipFactor !== 0) return null;
        return (
          <SvgText key={i} x={xPos[i]} y={BOOL_H + X_AXIS_H - 5}
            fontSize={9.5} fill={C.axis} textAnchor="middle">
            {p.label}
          </SvgText>
        );
      })}

      {/* Tap targets */}
      {points.map((p, i) => {
        if (p.sugarBool === null && p.exerciseBool === null) return null;
        const cx = xPos[i];
        const tapW = Math.max(slotW * 0.9, 18);
        return (
          <Rect key={i} x={cx - tapW / 2} y={0} width={tapW} height={BOOL_H}
            fill="transparent"
            onPress={() => onSelect(i === selectedIdx ? null : i)} />
        );
      })}

      {/* Tooltip */}
      {selectedIdx !== null && (() => {
        const p = points[selectedIdx];
        const cx = xPos[selectedIdx];
        const ttX = Math.min(Math.max(cx - TT_W / 2, Y_LEFT + 2), Y_LEFT + plotW - TT_W - 2);
        const ttY = -(TT_H + 8);
        return (
          <React.Fragment>
            <Rect x={ttX} y={ttY} width={TT_W} height={TT_H} rx={8} fill={C.tooltip} />
            <SvgText x={ttX + TT_W / 2} y={ttY + 14} fontSize={9} fill="rgba(255,255,255,0.5)" textAnchor="middle">
              {p.tooltipLabel}
            </SvgText>
            <SvgText x={ttX + TT_W / 2} y={ttY + 31} fontSize={11} fontWeight="600" fill={C.sugar} textAnchor="middle">
              Sugar: {p.sugarBool === null ? '—' : p.sugarBool ? 'Yes' : 'No'}
            </SvgText>
            <SvgText x={ttX + TT_W / 2} y={ttY + 50} fontSize={11} fontWeight="600" fill={C.exercise} textAnchor="middle">
              Exercise: {p.exerciseBool === null ? '—' : p.exerciseBool ? 'Yes' : 'No'}
            </SvgText>
          </React.Fragment>
        );
      })()}
    </Svg>
  );
}

/* ─────────────────────────────────────────
   PERCENTAGE CHART  (Weekly / Monthly / Quarterly)
───────────────────────────────────────── */
interface PctChartProps {
  points: DataPoint[];
  xPos: number[];
  svgW: number;
  selectedIdx: number | null;
  onSelect: (i: number | null) => void;
  skipFactor: number;
}

function PctChart({ points, xPos, svgW, selectedIdx, onSelect, skipFactor }: PctChartProps) {
  const svgH = PCT_H + X_AXIS_H;
  const plotW = svgW - Y_LEFT - Y_RIGHT;
  const n = points.length;
  const slotW = n > 0 ? plotW / n : plotW;
  const barW = Math.max(4, Math.min(slotW * 0.36, 22));
  const yTicks = [0, 25, 50, 75, 100];
  const yFor = (pct: number) => (1 - pct / 100) * PCT_H;

  const TT_W = 132; const TT_H = 62;

  return (
    <Svg width={svgW} height={svgH} style={{ overflow: 'visible' }}>
      {/* Grid lines + right-axis labels */}
      {yTicks.map(v => (
        <React.Fragment key={v}>
          <SvgLine x1={Y_LEFT} y1={yFor(v)} x2={Y_LEFT + plotW} y2={yFor(v)}
            stroke={C.axisLine} strokeWidth={1} />
          <SvgText x={Y_LEFT + plotW + 5} y={yFor(v) + 4}
            fontSize={9} fill={C.axis}>
            {v}%
          </SvgText>
        </React.Fragment>
      ))}

      {/* Right-axis label */}
      <SvgText
        x={Y_LEFT + plotW + 50} y={PCT_H / 2}
        fontSize={9} fill={C.textMuted} textAnchor="middle"
        transform={`rotate(90, ${Y_LEFT + plotW + 50}, ${PCT_H / 2})`}
      >
        % of days
      </SvgText>

      {/* Bars */}
      {points.map((p, i) => {
        const cx = xPos[i];
        const sH = p.sugarPct != null ? (p.sugarPct / 100) * PCT_H : 0;
        const eH = p.exercisePct != null ? (p.exercisePct / 100) * PCT_H : 0;
        const sel = i === selectedIdx;
        return (
          <React.Fragment key={i}>
            {p.sugarPct != null && (
              <Rect x={cx - barW - 1} y={yFor(p.sugarPct)} width={barW} height={sH} rx={2}
                fill={sel ? 'rgba(212,83,126,0.55)' : C.sugarFill}
                stroke={C.sugarStroke} strokeWidth={0.8} />
            )}
            {p.exercisePct != null && (
              <Rect x={cx + 1} y={yFor(p.exercisePct)} width={barW} height={eH} rx={2}
                fill={sel ? 'rgba(29,158,117,0.52)' : C.exerciseFill}
                stroke={C.exerciseStroke} strokeWidth={0.8} />
            )}
          </React.Fragment>
        );
      })}

      {/* X-axis line */}
      <SvgLine x1={Y_LEFT} y1={PCT_H} x2={Y_LEFT + plotW} y2={PCT_H}
        stroke={C.axisLine} strokeWidth={1} />

      {/* X-axis labels */}
      {points.map((p, i) => {
        if (i !== 0 && i !== n - 1 && i % skipFactor !== 0) return null;
        return (
          <SvgText key={i} x={xPos[i]} y={PCT_H + X_AXIS_H - 5}
            fontSize={9.5} fill={C.axis} textAnchor="middle">
            {p.label}
          </SvgText>
        );
      })}

      {/* Tap targets */}
      {points.map((p, i) => (
        <Rect key={i} x={Y_LEFT + slotW * i} y={0} width={slotW} height={PCT_H}
          fill="transparent"
          onPress={() => onSelect(i === selectedIdx ? null : i)} />
      ))}

      {/* Tooltip */}
      {selectedIdx !== null && (() => {
        const p = points[selectedIdx];
        const cx = xPos[selectedIdx];
        const ttX = Math.min(Math.max(cx - TT_W / 2, Y_LEFT + 2), Y_LEFT + plotW - TT_W - 2);
        const ttY = -(TT_H + 8);
        return (
          <React.Fragment>
            <Rect x={ttX} y={ttY} width={TT_W} height={TT_H} rx={8} fill={C.tooltip} />
            <SvgText x={ttX + TT_W / 2} y={ttY + 14} fontSize={9} fill="rgba(255,255,255,0.5)" textAnchor="middle">
              {p.tooltipLabel}
            </SvgText>
            <SvgText x={ttX + TT_W / 2} y={ttY + 31} fontSize={11} fontWeight="600" fill={C.sugar} textAnchor="middle">
              Sugar: {p.sugarPct != null ? `${Math.round(p.sugarPct)}%` : '—'}
            </SvgText>
            <SvgText x={ttX + TT_W / 2} y={ttY + 50} fontSize={11} fontWeight="600" fill={C.exercise} textAnchor="middle">
              Exercise: {p.exercisePct != null ? `${Math.round(p.exercisePct)}%` : '—'}
            </SvgText>
          </React.Fragment>
        );
      })()}
    </Svg>
  );
}

/* ─────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────── */
const PRESETS: { key: Preset; label: string }[] = [
  { key: '7D', label: '7D' },
  { key: '30D', label: '30D' },
  { key: '90D', label: '90D' },
  { key: '1Y', label: '1Y' },
  { key: 'ALL', label: 'All' },
];

const GRAN: { key: Granularity; label: string }[] = [
  { key: 'D', label: 'Daily' },
  { key: 'W', label: 'Weekly' },
  { key: 'M', label: 'Monthly' },
  { key: 'Q', label: 'Quarterly' },
];

export default function TrendsChart({ entries }: { entries: ChartEntry[] }) {
  const { width } = useWindowDimensions();
  // SVG stretches to full horizontal of the card interior (card has px-16, we compensate)
  const svgW = width - 32;
  const plotW = svgW - Y_LEFT - Y_RIGHT;

  const [gran, setGran] = useState<Granularity>('D');
  const [preset, setPreset] = useState<Preset>('30D');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const today = useMemo(() => todayStr(), []);

  const { minDate, maxDate } = useMemo(() => {
    if (!entries.length) return { minDate: today, maxDate: today };
    const sorted = entries.map(e => e.date).sort();
    return { minDate: sorted[0], maxDate: sorted[sorted.length - 1] };
  }, [entries, today]);

  const startDate = useMemo(() => {
    const targets: Record<Preset, string> = {
      '7D': addDays(today, -7),
      '30D': addDays(today, -30),
      '90D': addDays(today, -90),
      '1Y': addDays(today, -365),
      'ALL': minDate,
    };
    const raw = targets[preset];
    return raw < minDate ? minDate : raw;
  }, [preset, minDate, today]);

  const endDate = maxDate < today ? maxDate : today;

  const points = useMemo(
    () => aggregate(entries, gran, startDate, endDate),
    [entries, gran, startDate, endDate],
  );

  // Compute X positions once — shared by both charts
  const xPos = useMemo(() => {
    const n = points.length;
    if (n === 0) return [];
    if (gran === 'D') {
      // Edge-to-edge point layout
      return points.map((_, i) => Y_LEFT + (n <= 1 ? plotW / 2 : i * (plotW / (n - 1))));
    }
    // Slot-center layout for aggregated views
    const slotW = plotW / n;
    return points.map((_, i) => Y_LEFT + (i + 0.5) * slotW);
  }, [points, plotW, gran]);

  const skipFactor = Math.max(1, Math.ceil(points.length / 12));

  const stats = useMemo(() => {
    const ws = points.map(p => p.weight).filter((w): w is number => w !== null);
    const sPts = points.filter(p => p.sugarPct !== null);
    const ePts = points.filter(p => p.exercisePct !== null);
    return {
      avgW: numAvg(ws),
      avgSugar: sPts.length ? numAvg(sPts.map(p => p.sugarPct!))! : null,
      avgEx: ePts.length ? numAvg(ePts.map(p => p.exercisePct!))! : null,
    };
  }, [points]);

  const hasData = points.some(
    p => p.weight !== null || p.sugarBool !== null || p.exerciseBool !== null || p.sugarPct !== null,
  );
  const isDaily = gran === 'D';

  function handleGranChange(g: Granularity) {
    setGran(g);
    setSelectedIdx(null);
  }

  function handlePresetChange(p: Preset) {
    setPreset(p);
    setSelectedIdx(null);
  }

  return (
    <View style={s.card}>
      {/* ── Controls ── */}
      <View style={s.controlsWrap}>
        {/* Preset buttons */}
        <View style={s.pillRow}>
          {PRESETS.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[s.pillBtn, preset === key && s.pillBtnOn]}
              onPress={() => handlePresetChange(key)}
              activeOpacity={0.75}
            >
              <Text style={[s.pillTxt, preset === key && s.pillTxtOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Date range display */}
        <Text style={s.rangeTxt}>
          {fmtDateDisplay(startDate)} – {fmtDateDisplay(endDate)}
        </Text>

        {/* Granularity */}
        <View style={[s.pillRow, { marginTop: 10 }]}>
          {GRAN.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[s.pillBtn, gran === key && s.pillBtnOn]}
              onPress={() => handleGranChange(key)}
              activeOpacity={0.75}
            >
              <Text style={[s.pillTxt, gran === key && s.pillTxtOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Legend ── */}
      <View style={s.legend}>
        <View style={s.legendItem}>
          <View style={[s.swatchLine, { backgroundColor: C.weight }]} />
          <Text style={s.legendTxt}>Weight (kg)</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.swatchBox, { backgroundColor: C.sugarFill, borderColor: C.sugarStroke }]} />
          <Text style={s.legendTxt}>{isDaily ? 'Sugar day' : 'Sugar days %'}</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.swatchBox, { backgroundColor: C.exerciseFill, borderColor: C.exerciseStroke }]} />
          <Text style={s.legendTxt}>{isDaily ? 'Exercise day' : 'Exercise days %'}</Text>
        </View>
      </View>

      {/* ── Charts ── */}
      {!hasData ? (
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>📊</Text>
          <Text style={s.emptyTitle}>No data for this period</Text>
          <Text style={s.emptyDesc}>Log some entries to see your trends here.</Text>
        </View>
      ) : (
        <View style={s.chartWrap}>
          {/* Weight line chart */}
          <View style={{ overflow: 'visible' }}>
            <WeightChart
              points={points}
              xPos={xPos}
              svgW={svgW}
              selectedIdx={selectedIdx}
              onSelect={setSelectedIdx}
            />
          </View>

          {/* Boolean / Percentage chart */}
          <View style={{ marginTop: 6, overflow: 'visible' }}>
            {isDaily ? (
              <BoolChart
                points={points}
                xPos={xPos}
                svgW={svgW}
                selectedIdx={selectedIdx}
                onSelect={setSelectedIdx}
                skipFactor={skipFactor}
              />
            ) : (
              <PctChart
                points={points}
                xPos={xPos}
                svgW={svgW}
                selectedIdx={selectedIdx}
                onSelect={setSelectedIdx}
                skipFactor={skipFactor}
              />
            )}
          </View>
        </View>
      )}

      {/* ── Summary cards ── */}
      {hasData && (
        <View style={s.cards}>
          <View style={s.summaryCard}>
            <Text style={s.cardLabel}>Avg weight</Text>
            <Text style={[s.cardValue, { color: '#534AB7' }]}>
              {stats.avgW != null ? `${stats.avgW.toFixed(1)} kg` : '—'}
            </Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.cardLabel}>Sugar days</Text>
            <Text style={[s.cardValue, { color: '#993556' }]}>
              {stats.avgSugar != null ? `${Math.round(stats.avgSugar)}%` : '—'}
            </Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.cardLabel}>Exercise days</Text>
            <Text style={[s.cardValue, { color: '#0F6E56' }]}>
              {stats.avgEx != null ? `${Math.round(stats.avgEx)}%` : '—'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

/* ─────────────────────────────────────────
   STYLES
───────────────────────────────────────── */
const s = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 24,
    paddingTop: 18,
    paddingBottom: 20,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
    overflow: 'visible',
  },
  controlsWrap: {
    gap: 0,
  },
  pillRow: {
    flexDirection: 'row',
    backgroundColor: C.pill,
    borderRadius: 22,
    padding: 2,
    alignSelf: 'flex-start',
    gap: 1,
  },
  pillBtn: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
  },
  pillBtnOn: {
    backgroundColor: C.pillActive,
  },
  pillTxt: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9A9082',
  },
  pillTxtOn: {
    color: C.pillActiveText,
  },
  rangeTxt: {
    fontSize: 11,
    color: '#9A9082',
    marginTop: 7,
    letterSpacing: 0.15,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 14,
    marginBottom: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  swatchLine: {
    width: 16,
    height: 3,
    borderRadius: 1.5,
  },
  swatchBox: {
    width: 11,
    height: 11,
    borderRadius: 2,
    borderWidth: 1,
  },
  legendTxt: {
    fontSize: 11,
    color: '#9A9082',
  },
  chartWrap: {
    marginHorizontal: -16,
    overflow: 'visible',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 52,
    gap: 8,
  },
  emptyEmoji: { fontSize: 38 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: C.text },
  emptyDesc: { fontSize: 13, color: C.textMuted, textAlign: 'center' },
  cards: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FAFAF8',
    borderRadius: 14,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9A9082',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  cardValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
});
