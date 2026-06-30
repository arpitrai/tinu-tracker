import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  AccessibilityInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

/* ── Brand glyph — the PulseRise mark (heartbeat line rising to a dot).
   Kept local to this screen, mirroring SignInScreen's own copy; the line
   draws itself in on first launch. ── */
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// strokeDasharray length that comfortably exceeds the path's own length, so
// animating the offset from DASH→0 sweeps the stroke on from left to right.
const DASH = 300;
const PULSE_D = 'M9 63 L25 63 L33 49 L42 65 L52 79 L63 27 L74 49 L91 19';

function AnimatedPulse({ size, reduceMotion }: { size: number; reduceMotion: boolean }) {
  const offset = useSharedValue(reduceMotion ? 0 : DASH);
  const dot = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    offset.value = withDelay(250, withTiming(0, { duration: 1400, easing: Easing.out(Easing.cubic) }));
    dot.value = withDelay(1550, withTiming(1, { duration: 350 }));
  }, [reduceMotion]);

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

// Small static mark for the brand row (no animation needed there).
function BrandMark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d={PULSE_D} stroke="#FFFFFF" strokeWidth={7.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={91} cy={19} r={6.5} fill="#FFFFFF" />
    </Svg>
  );
}

const FEATURES = ['Exercise', 'Sugar', 'Weight'];

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [reduceMotion, setReduceMotion] = React.useState(false);
  const content = useSharedValue(0);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!alive) return;
      setReduceMotion(enabled);
      content.value = enabled ? 1 : withDelay(700, withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }));
    });
    return () => {
      alive = false;
    };
  }, []);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: content.value,
    transform: [{ translateY: (1 - content.value) * 14 }],
  }));

  return (
    <LinearGradient
      // amber → rose → violet, matching the app's sunrise brand gradient
      colors={['#F59E0B', '#F43F5E', '#8B5CF6']}
      locations={[0, 0.46, 1]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.45, y: 1 }}
      style={styles.root}
    >
      <View style={styles.pad}>
        <View style={styles.brandRow}>
          <View style={styles.brandTile}>
            <BrandMark size={18} />
          </View>
          <Text style={styles.brandName}>Tinu Tracker</Text>
        </View>

        <View style={styles.spacer} />

        {/* Glyph + headline + body + pills as one vertically-centered cluster. */}
        <Animated.View style={[styles.cluster, contentStyle]}>
          <AnimatedPulse size={108} reduceMotion={reduceMotion} />
          <Text style={styles.title}>Watch yourself get healthier.</Text>
          <Text style={styles.body}>Log exercise, sugar & weight. Tiny effort, real trends.</Text>

          <View style={styles.chips}>
            {FEATURES.map((f) => (
              <View key={f} style={styles.chip}>
                <Text style={styles.chipText}>{f}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <View style={styles.spacer} />

        <TouchableOpacity
          testID="splash-get-started"
          style={styles.cta}
          activeOpacity={0.85}
          onPress={onDone}
          accessibilityRole="button"
        >
          <Text style={styles.ctaText}>Get started</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pad: {
    flex: 1,
    paddingTop: (Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0) + 34,
    paddingHorizontal: 28,
    paddingBottom: 36,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9, alignSelf: 'flex-start' },
  brandTile: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  spacer: { flex: 1 },
  cluster: { alignItems: 'center' },
  title: {
    color: '#FFFFFF',
    fontSize: 31,
    lineHeight: 35,
    fontWeight: '800',
    letterSpacing: -1,
    textAlign: 'center',
    marginTop: 26,
  },
  body: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
    maxWidth: 280,
    textAlign: 'center',
  },
  chips: { flexDirection: 'row', gap: 7, marginTop: 24, justifyContent: 'center' },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  cta: {
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  ctaText: { color: '#241018', fontSize: 15, fontWeight: '700', letterSpacing: 0.1 },
});
