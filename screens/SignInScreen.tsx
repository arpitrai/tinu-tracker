import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

/* ── SVG icons ─────────────────────────────────────────────────────────── */

function PulseIcon({ size, color = '#FFFFFF' }: { size: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        d="M3 24H14L19 10L25 38L31 18L36 29H45"
        stroke={color}
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function DumbbellIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {/* Left outer plate */}
      <Rect x="1" y="9" width="6" height="14" rx="3" fill={color} />
      {/* Left inner collar */}
      <Rect x="7" y="12" width="3" height="8" rx="1.5" fill={color} opacity={0.7} />
      {/* Bar */}
      <Rect x="10" y="14" width="12" height="4" rx="2" fill={color} />
      {/* Right inner collar */}
      <Rect x="22" y="12" width="3" height="8" rx="1.5" fill={color} opacity={0.7} />
      {/* Right outer plate */}
      <Rect x="25" y="9" width="6" height="14" rx="3" fill={color} />
    </Svg>
  );
}

function LollipopIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {/* Candy */}
      <Circle cx="16" cy="13" r="10" fill={color} />
      {/* Gloss highlight */}
      <Path
        d="M11 9 Q14 6.5 18 8.5"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* Stick */}
      <Rect x="14.5" y="23" width="3" height="9" rx="1.5" fill={color} />
    </Svg>
  );
}

function ScaleIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {/* Base platform */}
      <Rect x="2" y="26" width="28" height="4" rx="2" fill={color} />
      {/* Scale body */}
      <Rect x="4" y="12" width="24" height="14" rx="5" fill={color} />
      {/* Display screen */}
      <Rect x="8" y="15.5" width="16" height="7" rx="2.5" fill="rgba(255,255,255,0.28)" />
      {/* Screen shine */}
      <Path
        d="M9.5 17 H18"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Top sensor strip */}
      <Rect x="11" y="9" width="10" height="3" rx="1.5" fill={color} opacity={0.65} />
      <Rect x="14" y="7" width="4" height="2.5" rx="1.25" fill={color} opacity={0.45} />
    </Svg>
  );
}

/* ── Google G icon (SVG — sharp at all sizes) ───────────────────────────── */

function GoogleIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

/* ── Data ───────────────────────────────────────────────────────────────── */

type FeatureDef = {
  Icon: React.ComponentType<{ color: string; size: number }>;
  label: string;
  tint: string;
  glow: string;
};

const FEATURES: FeatureDef[] = [
  { Icon: DumbbellIcon, label: 'Exercise', tint: '#16A34A', glow: '#F0FDF4' },
  { Icon: LollipopIcon, label: 'Sweets',   tint: '#DB2777', glow: '#FDF2F8' },
  { Icon: ScaleIcon,    label: 'Weight',   tint: '#7C3AED', glow: '#F5F3FF' },
];

/* ── Screen ─────────────────────────────────────────────────────────────── */

export default function SignInScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTo = AuthSession.makeRedirectUri();

  const signInWithGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;

      const result = await WebBrowser.openAuthSessionAsync(data.url!, redirectTo);
      if (result.type === 'success') {
        const url = result.url;
        const params = new URL(url);
        const hashParams = new URLSearchParams(params.hash.slice(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        } else {
          const code = params.searchParams.get('code');
          if (code) await supabase.auth.exchangeCodeForSession(url);
        }
      }
    } catch (e: any) {
      setError(e.message ?? 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#F8FAFF', '#FFFFFF', '#F5F0FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.root}>
      <View style={styles.glowOrb} />

      <SafeAreaView style={styles.safe}>
        {/* ── Hero ── */}
        <View style={styles.hero}>
          {/* App icon */}
          <LinearGradient
            colors={['#1C6EF2', '#0057D9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoRing}
          >
            <PulseIcon size={52} />
          </LinearGradient>

          <Text style={styles.title}>Tinu Tracker</Text>
          <Text style={styles.subtitle}>
            Created for Tinu to track her health and fitness.
          </Text>

          {/* Tag pills */}
          <View style={styles.statRow}>
            {['Daily habits', 'Weight trends', 'Habit insights'].map(s => (
              <View key={s} style={styles.statPill}>
                <Text style={styles.statPillText}>{s}</Text>
              </View>
            ))}
          </View>

          {/* Feature tiles */}
          <View style={styles.featureRow}>
            {FEATURES.map(({ Icon, label, tint, glow }) => (
              <View key={label} style={[styles.featureTile, { backgroundColor: glow }]}>
                <View style={[styles.featureIconWrap, { borderColor: tint + '50', backgroundColor: tint + '22' }]}>
                  <Icon color={tint} size={34} />
                </View>
                <Text style={[styles.featureLabel, { color: tint }]}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Benefit tagline */}
          <View style={styles.benefitWrap}>
            <LinearGradient
              colors={['rgba(28,110,242,0.0)', 'rgba(28,110,242,0.06)', 'rgba(28,110,242,0.0)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.benefitGradient}
            >
              <Text style={styles.benefitText}>
                See exactly how your habits move the scale.
              </Text>
            </LinearGradient>
          </View>
        </View>

        {/* ── CTA ── */}
        <View style={styles.cta}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.googleBtn, loading && styles.disabled]}
            onPress={signInWithGoogle}
            disabled={loading}
            activeOpacity={0.88}
          >
            {loading ? (
              <ActivityIndicator color="#111" />
            ) : (
              <>
                <GoogleIcon size={20} />
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  glowOrb: {
    position: 'absolute',
    top: -140,
    alignSelf: 'center',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: '#1C6EF2',
    opacity: 0.05,
  },

  safe: { flex: 1 },

  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },

  logoRing: {
    width: 96,
    height: 96,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#1C6EF2',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },

  title: {
    fontSize: 48,
    fontWeight: '300',
    color: '#1B1B1F',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#49454F',
    textAlign: 'center',
    lineHeight: 25,
    marginTop: 4,
    marginBottom: 8,
  },

  statRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 4,
  },
  statPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D7FF',
  },
  statPillText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1C6EF2',
    letterSpacing: 0.2,
  },

  featureRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    alignSelf: 'stretch',
  },
  featureTile: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  featureIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 17,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  benefitWrap: {
    alignSelf: 'stretch',
    marginTop: 16,
  },
  benefitGradient: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  benefitText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#49454F',
    textAlign: 'center',
    lineHeight: 20,
  },

  cta: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    gap: 14,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C6EF2',
    borderRadius: 100,
    paddingVertical: 17,
    gap: 12,
    shadowColor: '#1C6EF2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  disabled: { opacity: 0.38 },
  googleBtnText: { fontSize: 14, fontWeight: '500', color: '#FFFFFF', letterSpacing: 0.1 },
  error: { color: '#F2B8B5', fontSize: 13, textAlign: 'center' },
});
