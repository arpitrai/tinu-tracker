import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import SignInScreen from './screens/SignInScreen';
import TrackerScreen from './screens/TrackerScreen';
import SplashScreen from './screens/SplashScreen';
import { configureNotificationHandler, registerPushToken } from './lib/notifications';

// Per-install flag: set once the first-run splash has been seen, so it shows
// exactly once per install and never again. Cleared by uninstall / clear-data.
const ONBOARDED_KEY = '@tinu/onboarded';

// Foreground display behaviour must be set before the app renders. Module-level
// so it runs exactly once, regardless of re-renders.
configureNotificationHandler();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  // null = still reading the flag; false = show splash; true = already seen.
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(ONBOARDED_KEY)
      .then((v) => { if (mounted) setOnboarded(v === '1'); })
      .catch(() => { if (mounted) setOnboarded(true); }); // never block on a storage read

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return;
        setSession(session);
        setLoading(false);
      })
      .catch((e: any) => {
        if (!mounted) return;
        setInitError(e?.message ?? String(e));
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setSession(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Register this device for remote push once a user is signed in. Fire-and-forget:
  // it no-ops on simulators / when permission is denied, and never blocks the UI.
  useEffect(() => {
    if (session?.user) {
      registerPushToken().catch(() => {});
    }
  }, [session?.user?.id]);

  const dismissSplash = () => {
    setOnboarded(true);
    AsyncStorage.setItem(ONBOARDED_KEY, '1').catch(() => {}); // best-effort persist
  };

  // First-run splash takes precedence over everything and ignores auth entirely:
  // on a fresh install it shows once, before the sign-in screen. We only need the
  // flag (not the session) to decide, so this renders as soon as the flag resolves.
  if (onboarded === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <StatusBar style="dark" />
      </View>
    );
  }

  if (!onboarded) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light" />
        <SplashScreen onDone={dismissSplash} />
      </GestureHandlerRootView>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <StatusBar style="dark" />
      </View>
    );
  }

  if (initError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Startup error</Text>
        <Text style={styles.errorMsg}>{initError}</Text>
        <StatusBar style="dark" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      {session?.user ? (
        <TrackerScreen user={session.user} />
      ) : (
        <SignInScreen />
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5FA', padding: 24 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#dc2626', marginBottom: 12 },
  errorMsg: { fontSize: 13, color: '#333', textAlign: 'center', lineHeight: 20 },
});
