import React, { useState, useEffect, useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';

interface Props {
  visible: boolean;
  initialStart: string; // YYYY-MM-DD
  initialEnd: string;   // YYYY-MM-DD
  today: string;        // YYYY-MM-DD (max selectable date)
  onApply: (start: string, end: string) => void;
  onClose: () => void;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function fmtPretty(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
}

function dayCount(start: string, end: string): number {
  const [ys, ms, ds] = start.split('-').map(Number);
  const [ye, me, de] = end.split('-').map(Number);
  const a = new Date(ys, ms - 1, ds).getTime();
  const b = new Date(ye, me - 1, de).getTime();
  return Math.round((b - a) / 86_400_000) + 1;
}

function DateRangeModal({ visible, initialStart, initialEnd, today, onApply, onClose }: Props) {
  const [start, setStart] = useState<string | null>(initialStart);
  const [end, setEnd] = useState<string | null>(initialEnd);

  const [ey, em] = initialEnd.split('-').map(Number);
  const [year, setYear] = useState(ey);
  const [month, setMonth] = useState(em - 1); // 0-based

  useEffect(() => {
    if (visible) {
      setStart(initialStart);
      setEnd(initialEnd);
      setYear(ey);
      setMonth(em - 1);
    }
  }, [visible, initialStart, initialEnd, ey, em]);

  const [ty, tm, td] = today.split('-').map(Number);
  const atCurrentMonth = year === ty && month === tm - 1;

  const cells = useMemo(() => {
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out: (number | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(d);
    return out;
  }, [year, month]);

  const prevMonth = () => {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (atCurrentMonth) return;
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else setMonth(month + 1);
  };

  // Tap logic: first tap (or tap when a complete range exists) starts a new range;
  // the second tap completes it, swapping if the user picked an earlier day.
  const handleTap = (dateStr: string) => {
    if (!start || (start && end)) {
      setStart(dateStr);
      setEnd(null);
      return;
    }
    if (dateStr < start) {
      setEnd(start);
      setStart(dateStr);
    } else {
      setEnd(dateStr);
    }
  };

  const complete = start && end;
  const total = complete ? dayCount(start!, end!) : start ? 1 : 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          {/* Summary */}
          <Text style={styles.summary}>
            {start
              ? complete
                ? `${fmtPretty(start!)}  –  ${fmtPretty(end!)}`
                : `${fmtPretty(start!)}  –  …`
              : 'Select a start date'}
          </Text>
          <Text style={styles.summarySub}>
            {complete ? `${total} day${total === 1 ? '' : 's'}` : 'Tap a start, then an end date'}
          </Text>

          {/* Month header */}
          <View style={styles.monthRow}>
            <TouchableOpacity style={styles.monthNav} onPress={prevMonth} activeOpacity={0.7}>
              <Text style={styles.monthNavText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity
              style={[styles.monthNav, atCurrentMonth && styles.monthNavOff]}
              onPress={nextMonth}
              disabled={atCurrentMonth}
              activeOpacity={0.7}
            >
              <Text style={styles.monthNavText}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Weekday labels */}
          <View style={styles.weekRow}>
            {WEEKDAYS.map((w, i) => (
              <Text key={i} style={styles.weekLabel}>{w}</Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={styles.grid}>
            {cells.map((day, i) => {
              if (day === null) return <View key={`b${i}`} style={styles.cell} />;
              const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
              const isFuture =
                year > ty || (year === ty && month > tm - 1) ||
                (year === ty && month === tm - 1 && day > td);
              const isStart = dateStr === start;
              const isEnd = dateStr === end;
              const isEndpoint = isStart || isEnd;
              const inRange = !!(complete && dateStr > start! && dateStr < end!);

              return (
                <View key={dateStr} style={styles.cell}>
                  {inRange && <View style={styles.rangeBand} />}
                  {isStart && complete && <View style={[styles.rangeBand, styles.rangeBandRight]} />}
                  {isEnd && <View style={[styles.rangeBand, styles.rangeBandLeft]} />}
                  <TouchableOpacity
                    style={[styles.day, isEndpoint && styles.dayEndpoint]}
                    disabled={isFuture}
                    onPress={() => handleTap(dateStr)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.dayText,
                      isFuture && styles.dayTextDisabled,
                      inRange && styles.dayTextInRange,
                      isEndpoint && styles.dayTextEndpoint,
                    ]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.applyBtn, !complete && styles.applyBtnOff]}
              disabled={!complete}
              onPress={() => complete && onApply(start!, end!)}
              activeOpacity={0.85}
            >
              <Text style={[styles.applyText, !complete && styles.applyTextOff]}>Apply</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default React.memo(DateRangeModal);

const PRIMARY = '#7C3AED';
const PRIMARY_SOFT = '#EFE8FE';
const TEXT = '#1C1915';
const MUTED = '#9A9082';

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  summary: { fontSize: 15, fontWeight: '800', color: TEXT, letterSpacing: -0.2 },
  summarySub: { fontSize: 11.5, fontWeight: '600', color: MUTED, marginTop: 2, marginBottom: 12 },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthNav: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F2F1EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavOff: { opacity: 0.3 },
  monthNavText: { fontSize: 22, color: TEXT, fontWeight: '500', lineHeight: 26 },
  monthTitle: { fontSize: 16, fontWeight: '800', color: TEXT, letterSpacing: -0.2 },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: MUTED,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  // Light connecting band behind in-range / endpoint days.
  rangeBand: {
    position: 'absolute',
    top: '50%',
    marginTop: -19,
    left: 0,
    right: 0,
    height: 38,
    backgroundColor: PRIMARY_SOFT,
  },
  rangeBandLeft: { left: '50%', right: 0 },
  rangeBandRight: { left: 0, right: '50%' },
  day: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayEndpoint: { backgroundColor: PRIMARY },
  dayText: { fontSize: 15, fontWeight: '600', color: TEXT },
  dayTextDisabled: { color: '#D8D3CB' },
  dayTextInRange: { color: PRIMARY, fontWeight: '700' },
  dayTextEndpoint: { color: '#FFFFFF', fontWeight: '800' },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E7E2DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontSize: 14.5, fontWeight: '700', color: MUTED },
  applyBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnOff: { backgroundColor: '#EDE9F6' },
  applyText: { fontSize: 14.5, fontWeight: '700', color: '#FFFFFF' },
  applyTextOff: { color: '#BCB2D6' },
});
