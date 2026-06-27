import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  yesColor: string;
  noColor: string;
  locked?: boolean;
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
            <Text style={[styles.optText, { color: soft.text }]}>{label}  🔒</Text>
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
  // Fixed lineHeight so the locked-state lock emoji (🔒) doesn't enlarge the
  // line box and push everything below down. Keep ≥ emoji glyph height at 17px.
  optText: { fontSize: 17, lineHeight: 22, fontWeight: '800' },
  optTextOn: { color: '#FFFFFF' },
  optTextIdle: { color: '#C8C0B8' },
});
