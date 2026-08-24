import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const DASH = 300;
const DRAW_MS = 1150;
const HOLD_MS = 520;
const ERASE_MS = 760;
const CYCLE_MS = DRAW_MS + HOLD_MS + ERASE_MS;
const PULSE_D = 'M9 63 L25 63 L33 49 L42 65 L52 79 L63 27 L74 49 L91 19';

function BrandMark({ size, color = '#FFFFFF' }: { size: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d={PULSE_D} stroke={color} strokeWidth={7.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={91} cy={19} r={6.5} fill={color} />
    </Svg>
  );
}

function PulseGlyph({ size, reduceMotion }: { size: number; reduceMotion: boolean }) {
  const offset = useSharedValue(reduceMotion ? 0 : DASH);
  const dot = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      offset.value = 0;
      dot.value = 1;
      return;
    }

    offset.value = withRepeat(
      withSequence(
        withTiming(0, { duration: DRAW_MS, easing: Easing.out(Easing.cubic) }),
        withDelay(HOLD_MS, withTiming(-DASH, { duration: ERASE_MS, easing: Easing.inOut(Easing.cubic) })),
        withTiming(DASH, { duration: 0 })
      ),
      -1,
      false
    );
    dot.value = withRepeat(
      withSequence(
        withDelay(880, withTiming(1, { duration: 220 })),
        withDelay(HOLD_MS + 50, withTiming(0, { duration: 180 })),
        withDelay(CYCLE_MS - 880 - 220 - HOLD_MS - 50 - 180, withTiming(0, { duration: 0 }))
      ),
      -1,
      false
    );
  }, [dot, offset, reduceMotion]);

  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
  const dotProps = useAnimatedProps(() => ({ opacity: dot.value }));

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <AnimatedPath
        d={PULSE_D}
        stroke="#FFFFFF"
        strokeWidth={7.4}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={DASH}
        animatedProps={lineProps}
      />
      <AnimatedCircle cx={91} cy={19} r={6.5} fill="#FFFFFF" animatedProps={dotProps} />
    </Svg>
  );
}

export default function PulseDrawLoader() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (alive) setReduceMotion(enabled);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <View style={styles.root} accessibilityRole="progressbar" accessibilityLabel="Loading Tinu Tracker">
      <View style={styles.brandRow}>
        <LinearGradient
          colors={['#F59E0B', '#F43F5E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.brandTile}
        >
          <BrandMark size={20} />
        </LinearGradient>
        <Text style={styles.brandName}>Tinu Tracker</Text>
      </View>

      <LinearGradient
        colors={['#F59E0B', '#F43F5E', '#8B5CF6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.pulseTile}
      >
        <PulseGlyph size={82} reduceMotion={reduceMotion} />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDFB',
    paddingHorizontal: 28,
  },
  brandRow: {
    position: 'absolute',
    top: (Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0) + 24,
    left: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandTile: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F43F5E',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 4,
  },
  brandName: {
    color: '#2A1A14',
    fontSize: 14,
    fontWeight: '800',
  },
  pulseTile: {
    width: 116,
    height: 116,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 7,
  },
});
