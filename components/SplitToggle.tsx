import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

interface Props {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  yesColor: string;
  noColor: string;
  locked?: boolean;
}

// Drawn rather than the 🔒 emoji. A device font can substitute or drop an
// emoji glyph (a Galaxy showed it on one chip and not the other in the same
// screenshot), and its oversized metrics are what forced the old pinned
// lineHeight. A vector is identical on every device and carries its own box.
function LockIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg testID="lock-icon" width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M7.9 10.4V7.6a4.1 4.1 0 0 1 8.2 0v2.8"
        fill="none"
        stroke={color}
        strokeWidth={2.1}
        strokeLinecap="round"
      />
      <Rect x={4.6} y={10.4} width={14.8} height={9.6} rx={2.6} fill={color} />
    </Svg>
  );
}

// Soft tint + text colour for the locked (saved) state, keyed by the full colour.
const SOFT: Record<string, { bg: string; text: string }> = {
  '#10B981': { bg: '#E8FBF4', text: '#0F6E56' },
  '#EF4444': { bg: '#FDECEC', text: '#B3261E' },
};

function SplitToggle({ value, onChange, yesColor, noColor, locked }: Props) {
  const renderOpt = (label: string, target: boolean) => {
    const selected = value === target;
    const color = target ? yesColor : noColor;

    if (locked) {
      if (selected) {
        const soft = SOFT[color] ?? { bg: '#F2F1EE', text: color };
        return (
          <View style={[styles.opt, { backgroundColor: soft.bg }]}>
            <View style={styles.lockRow}>
              <Text style={[styles.optText, { color: soft.text }]}>{label}</Text>
              <LockIcon size={14} color={soft.text} />
            </View>
          </View>
        );
      }
      return (
        <View style={[styles.opt, styles.optIdle, styles.optFaded]}>
          <Text style={[styles.optText, styles.optTextIdle]}>{label}</Text>
        </View>
      );
    }

    return (
      <TouchableOpacity
        testID={`split-${label.toLowerCase()}`}
        style={[styles.opt, selected ? { backgroundColor: color } : styles.optIdle]}
        onPress={() => onChange(selected ? null : target)}
        activeOpacity={0.8}
      >
        <Text style={[styles.optText, selected ? styles.optTextOn : styles.optTextIdle]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.row}>
      {renderOpt('Yes', true)}
      {renderOpt('No', false)}
    </View>
  );
}

export default React.memo(SplitToggle);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  opt: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optIdle: { backgroundColor: '#F2F1EE' },
  optFaded: { opacity: 0.4 },
  // The lock sits beside the label and is shorter than the text line, so a
  // locked chip is exactly as tall as an unlocked one. No pinned lineHeight
  // is needed now, which also lets the chip grow properly when the reader has
  // Android's font size turned up.
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  optText: { fontSize: 17, fontWeight: '800' },
  optTextOn: { color: '#FFFFFF' },
  optTextIdle: { color: '#C8C0B8' },
});
