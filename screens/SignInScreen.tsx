import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Linking,
  Platform,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const PRIVACY_URL = 'https://arpitrai.github.io/tinu-tracker/privacy.html';

/* ── Brand mark: a pulse line trending upward into a node (matches the app icon) ── */

function PulseRiseIcon({ size, color = '#FFFFFF' }: { size: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        d="M9 63 L25 63 L33 49 L42 65 L52 79 L63 27 L74 49 L91 19"
        stroke={color}
        strokeWidth={7.4}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={91} cy={19} r={6.5} fill={color} />
    </Svg>
  );
}

/* ── Google G icon (SVG — sharp at all sizes) ── */

function GoogleIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </Svg>
  );
}

/* ── Habit mosaic — days fill in with a warm sunrise gradient (amber → rose → violet) ── */

// 5 rows × 11 columns of intensity (0 = barely logged, 4 = full). Tapers at the
// end so the most recent days read as "not yet logged".
const MOSAIC: number[][] = [
  [3, 2, 4, 1, 3, 4, 2, 3, 1, 2, 4],
  [2, 4, 3, 4, 1, 3, 4, 2, 4, 3, 1],
  [4, 3, 2, 3, 4, 2, 3, 4, 1, 4, 3],
  [1, 4, 3, 4, 2, 4, 3, 2, 4, 3, 2],
  [2, 3, 1, 2, 3, 1, 0, 1, 0, 0, 0],
];

const SUN_STOPS = ['#F59E0B', '#F43F5E', '#8B5CF6']; // amber → rose → violet
const FRAC = [0.1, 0.3, 0.55, 0.78, 1.0]; // intensity → how saturated the cell is

function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  const out = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return '#' + out.map(v => v.toString(16).padStart(2, '0')).join('');
}

// Hue comes from the column (left = amber, right = violet); intensity sets saturation.
function cellColor(col: number, level: number, cols: number): string {
  const t = col / (cols - 1);
  const base = t < 0.5
    ? mix(SUN_STOPS[0], SUN_STOPS[1], t / 0.5)
    : mix(SUN_STOPS[1], SUN_STOPS[2], (t - 0.5) / 0.5);
  return mix('#FFFFFF', base, FRAC[level]);
}

/* ── Screen ── */

export default function SignInScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Hidden email/password path — primarily so app-store reviewers can sign in
  // without Google OAuth (Google blocks reviewer logins as suspicious new devices).
  // Not shown to normal users: revealed by tapping the brand logo 5 times. The
  // App access notes in Play Console tell reviewers to do this.
  const [emailMode, setEmailMode] = useState(false);
  const [logoTaps, setLogoTaps] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const redirectTo = AuthSession.makeRedirectUri({ scheme: 'tinutracker' });

  const handleLogoTap = () => {
    if (emailMode) return;
    setLogoTaps(n => {
      if (n + 1 >= 5) {
        setError(null);
        setEmailMode(true);
        return 0;
      }
      return n + 1;
    });
  };

  const signInWithEmail = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      // onAuthStateChange in App.tsx swaps to TrackerScreen on success.
    } catch (e: any) {
      setError(e.message ?? 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
    <LinearGradient colors={['#FFF5EC', '#FFFDFB']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.55 }} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        {/* ── Hero ── */}
        <View style={styles.hero}>
          {/* Brand row */}
          <View style={styles.brandRow}>
            <TouchableOpacity activeOpacity={1} onPress={handleLogoTap}>
              <LinearGradient
                colors={['#F59E0B', '#F43F5E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoTile}
              >
                <PulseRiseIcon size={26} />
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.brandName}>Tinu Tracker</Text>
          </View>

          {/* Headline + mosaic */}
          <View style={styles.heroBody}>
            <Text style={styles.headline}>Small wins,{'\n'}every single day.</Text>

            <View style={styles.mosaic}>
              {MOSAIC.map((row, r) => (
                <View key={r} style={styles.mosaicRow}>
                  {row.map((lvl, c) => (
                    <View key={c} style={[styles.cell, { backgroundColor: cellColor(c, lvl, row.length) }]} />
                  ))}
                </View>
              ))}
            </View>

            <Text style={styles.subtitle}>
              Log exercise, sugar and weight in seconds - and watch your progress add up.
            </Text>
          </View>
        </View>

        {/* ── CTA ── */}
        <View style={styles.cta}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {emailMode ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#B0998D"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                editable={!loading}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#B0998D"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                editable={!loading}
                onSubmitEditing={signInWithEmail}
                returnKeyType="go"
              />
              <TouchableOpacity
                style={[styles.googleBtn, loading && styles.disabled]}
                onPress={signInWithEmail}
                disabled={loading}
                activeOpacity={0.88}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.googleBtnText}>Sign in</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.googleBtn, loading && styles.disabled]}
              onPress={signInWithGoogle}
              disabled={loading}
              activeOpacity={0.88}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <View style={styles.googleChip}>
                    <GoogleIcon size={16} />
                  </View>
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Only shown once the hidden email path is unlocked — lets you back out. */}
          {emailMode ? (
            <TouchableOpacity
              onPress={() => {
                setError(null);
                setEmailMode(false);
              }}
              disabled={loading}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.altLink}>Continue with Google instead</Text>
            </TouchableOpacity>
          ) : null}

          {/* Consent line — privacy policy link (required by app stores) */}
          <Text style={styles.consent}>
            By continuing, you agree to our{' '}
            <Text style={styles.consentLink} onPress={() => Linking.openURL(PRIVACY_URL)}>
              Privacy Policy
            </Text>
          </Text>
        </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  // SafeAreaView only insets on iOS; pad past the status bar manually on Android.
  safe: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },

  hero: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 24,
  },

  // Brand
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  logoTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F43F5E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 6,
  },
  brandName: { fontSize: 18, fontWeight: '800', color: '#2A1A14', letterSpacing: -0.3 },

  // Hero body (centered between brand row and CTA)
  heroBody: { flex: 1, justifyContent: 'center', gap: 22 },
  headline: {
    fontSize: 31,
    lineHeight: 37,
    fontWeight: '800',
    color: '#2A1A14',
    letterSpacing: -0.6,
  },

  // Mosaic
  mosaic: { gap: 6 },
  mosaicRow: { flexDirection: 'row', gap: 6 },
  cell: { flex: 1, aspectRatio: 1, borderRadius: 4 },

  subtitle: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '500',
    color: '#8A6A5C',
  },

  // CTA
  cta: { paddingHorizontal: 28, paddingBottom: 24, gap: 16 },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1917',
    borderRadius: 16,
    height: 56,
    gap: 11,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
  googleChip: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  googleBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.1 },
  error: { color: '#DC2626', fontSize: 13, textAlign: 'center' },

  // Email/password fields (secondary path)
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0E2D8',
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 15,
    fontWeight: '500',
    color: '#2A1A14',
  },
  altLink: { fontSize: 13, fontWeight: '700', color: '#E0533F', textAlign: 'center' },

  // Consent line
  consent: { fontSize: 11, lineHeight: 15, fontWeight: '500', color: '#B0998D', textAlign: 'center' },
  consentLink: { fontWeight: '700', color: '#E0533F', textDecorationLine: 'underline' },
});
