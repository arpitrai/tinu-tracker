import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const M3 = {
  onSurface: '#1C1B1F',
  onSurfaceVariant: '#49454F',
  surfaceVariant: '#E7E0EC',
  outlineVariant: '#CAC4D0',
};

interface Props {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  yesColor: string;
  noColor: string | null;
}

export default function TriToggle({ value, onChange, yesColor, noColor }: Props) {
  const opts: { label: string; val: boolean; color: string | null }[] = [
    { label: 'Yes', val: true,  color: yesColor },
    { label: 'No',  val: false, color: noColor },
  ];
  return (
    <View style={styles.triToggle}>
      {opts.map((opt, i) => {
        const active = value === opt.val;
        return (
          <TouchableOpacity
            key={String(opt.val)}
            testID={`toggle-${opt.label.toLowerCase()}`}
            style={[
              styles.triOption,
              i > 0 && styles.triOptionDivider,
              active && opt.color
                ? { backgroundColor: opt.color }
                : active
                  ? styles.triOptionActiveNeutral
                  : null,
            ]}
            onPress={() => onChange(active ? null : opt.val)}
            activeOpacity={0.75}
          >
            <Text style={[
              styles.triOptionText,
              active && opt.color ? { color: '#fff' } : active ? { color: M3.onSurface } : null,
            ]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  triToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: M3.outlineVariant,
    borderRadius: 40,
    overflow: 'hidden',
  },
  triOption: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
  },
  triOptionDivider: {
    borderLeftWidth: 1,
    borderLeftColor: M3.outlineVariant,
  },
  triOptionActiveNeutral: {
    backgroundColor: M3.surfaceVariant,
  },
  triOptionText: { fontSize: 14, fontWeight: '500', color: M3.onSurfaceVariant, letterSpacing: 0.1 },
});
