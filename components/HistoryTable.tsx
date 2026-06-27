import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export interface HistoryEntry {
  date: string; // YYYY-MM-DD
  exercised: boolean | null;
  ate_sweets: boolean | null;
  weight: string | number | null;
}

const P = {
  text: '#1C1915',
  textMuted: '#9A9082',
  surface: '#FBF7F2',
  divider: '#F1ECE5',
  green: '#10B981',
  red: '#EF4444',
};

// Local-time formatting — never `new Date(dateStr)` (parses as UTC).
function formatDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

const HistoryRow = React.memo(function HistoryRow({
  entry,
  isLast,
  onPress,
}: {
  entry: HistoryEntry;
  isLast: boolean;
  onPress?: (date: string) => void;
}) {
  const inner = (
    <>
      <Text style={[styles.historyDateLabel, styles.historyDateCol]}>
        {formatDateShort(entry.date)}
      </Text>
      <View style={styles.historyExCol}>
        {entry.exercised !== null && (
          <View style={styles.cellInline}>
            <View style={[styles.indicatorDot, { backgroundColor: entry.exercised ? P.green : P.red }]} />
            <Text style={styles.cellLabel}>{entry.exercised ? 'Yes' : 'No'}</Text>
          </View>
        )}
      </View>
      <View style={styles.historySugCol}>
        {entry.ate_sweets !== null && (
          <View style={styles.cellInline}>
            <View style={[styles.indicatorDot, { backgroundColor: entry.ate_sweets ? P.red : P.green }]} />
            <Text style={styles.cellLabel}>{entry.ate_sweets ? 'Yes' : 'No'}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.historyWeightText, styles.historyWtCol]}>
        {entry.weight ? String(entry.weight) : ''}
      </Text>
    </>
  );

  const rowStyle = [styles.historyRow, !isLast && styles.historyRowBorder];

  if (!onPress) {
    return <View style={rowStyle}>{inner}</View>;
  }
  return (
    <TouchableOpacity style={rowStyle} onPress={() => onPress(entry.date)} activeOpacity={0.65}>
      {inner}
    </TouchableOpacity>
  );
});

interface Props {
  entries: HistoryEntry[];
  onRowPress?: (date: string) => void;
}

function HistoryTable({ entries, onRowPress }: Props) {
  return (
    <View style={styles.historyCard}>
      {/* Column headers */}
      <View style={styles.historyHeaderRow}>
        <View style={styles.historyDateCol} />
        <Text style={[styles.historyColLabel, styles.historyExCol]}>Exercise</Text>
        <Text style={[styles.historyColLabel, styles.historySugCol]}>Sugar</Text>
        <Text style={[styles.historyColLabel, styles.historyWtCol]}>Weight</Text>
      </View>

      {entries.map((entry, i) => (
        <HistoryRow
          key={entry.date}
          entry={entry}
          isLast={i === entries.length - 1}
          onPress={onRowPress}
        />
      ))}
    </View>
  );
}

export default React.memo(HistoryTable);

const styles = StyleSheet.create({
  // History card
  historyCard: {
    backgroundColor: P.surface,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },

  // History column layout (shared between header and rows)
  historyDateCol: { flex: 1 },
  historyExCol: { width: 64, alignItems: 'center' },
  historySugCol: { width: 64, alignItems: 'center' },
  historyWtCol: { width: 56, textAlign: 'right' },

  // History header row
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: P.divider,
    marginBottom: 2,
  },
  historyColLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: P.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },

  // History data rows
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
  },
  historyRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: P.divider,
  },
  historyDateLabel: {
    fontSize: 13,
    color: P.text,
    fontWeight: '400',
  },
  cellInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cellLabel: {
    fontSize: 12,
    color: P.text,
    fontWeight: '500',
  },
  indicatorDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  historyWeightText: {
    fontSize: 13,
    color: P.textMuted,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
});
