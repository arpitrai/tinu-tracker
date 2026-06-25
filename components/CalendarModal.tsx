import React, { useState, useEffect, useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';

interface Props {
  visible: boolean;
  selectedDate: string; // YYYY-MM-DD
  today: string;        // YYYY-MM-DD
  hasEntry: (date: string) => boolean;
  onSelect: (date: string) => void;
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

function CalendarModal({ visible, selectedDate, today, hasEntry, onSelect, onClose }: Props) {
  const [sy, sm] = selectedDate.split('-').map(Number);
  const [year, setYear] = useState(sy);
  const [month, setMonth] = useState(sm - 1); // 0-based

  // Re-sync the viewed month whenever the modal opens onto a new date.
  useEffect(() => {
    if (visible) {
      setYear(sy);
      setMonth(sm - 1);
    }
  }, [visible, sy, sm]);

  const [ty, tm, td] = today.split('-').map(Number);

  // Don't let the user page past the current month.
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
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
              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === today;
              const logged = !isFuture && hasEntry(dateStr);

              return (
                <View key={dateStr} style={styles.cell}>
                  <TouchableOpacity
                    style={[styles.day, isSelected && styles.daySelected]}
                    disabled={isFuture}
                    onPress={() => { onSelect(dateStr); onClose(); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.dayText,
                      isFuture && styles.dayTextDisabled,
                      isToday && !isSelected && styles.dayTextToday,
                      isSelected && styles.dayTextSelected,
                    ]}>
                      {day}
                    </Text>
                    {logged && <View style={[styles.dot, isSelected && styles.dotSelected]} />}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default React.memo(CalendarModal);

const PRIMARY = '#7C3AED';
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
  day: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: { backgroundColor: PRIMARY },
  dayText: { fontSize: 15, fontWeight: '600', color: TEXT },
  dayTextDisabled: { color: '#D8D3CB' },
  dayTextToday: { color: PRIMARY, fontWeight: '800' },
  dayTextSelected: { color: '#FFFFFF', fontWeight: '800' },
  dot: {
    position: 'absolute',
    bottom: 5,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: PRIMARY,
  },
  dotSelected: { backgroundColor: '#FFFFFF' },
});
