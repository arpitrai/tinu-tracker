import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  yesColor: string;
  noColor: string;
  disabled?: boolean;
}

export default function TriToggle({ value, onChange, yesColor, noColor, disabled }: Props) {
  const segs: { label: string; val: boolean; color: string }[] = [
    { label: 'Yes', val: true,  color: yesColor },
    { label: 'No',  val: false, color: noColor  },
  ];

  return (
    <View style={[styles.pill, disabled && styles.pillDisabled]}>
      {segs.map((seg) => {
        const active = value === seg.val;
        return (
          <TouchableOpacity
            key={String(seg.val)}
            testID={`toggle-${seg.label.toLowerCase()}`}
            style={[styles.seg, active && { backgroundColor: seg.color }]}
            onPress={() => !disabled && onChange(active ? null : seg.val)}
            activeOpacity={disabled ? 1 : 0.75}
            disabled={disabled}
          >
            <Text style={[styles.segText, active && styles.segTextActive]}>
              {seg.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    backgroundColor: '#F2F1EE',
    borderRadius: 22,
    padding: 2,
  },
  pillDisabled: {
    opacity: 0.55,
  },
  seg: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
  },
  segText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9A9082',
    letterSpacing: 0.1,
  },
  segTextActive: {
    color: '#FFFFFF',
  },
});
