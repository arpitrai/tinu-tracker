import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import SignInScreen from './screens/SignInScreen';
import TrackerScreen from './screens/TrackerScreen';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setLoading(false);
      })
      .catch((e: any) => {
        setInitError(e?.message ?? String(e));
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1C6EF2" />
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
    <>
      <StatusBar style="dark" />
      {session?.user ? (
        <TrackerScreen user={session.user} />
      ) : (
        <SignInScreen />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5FA', padding: 24 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#dc2626', marginBottom: 12 },
  errorMsg: { fontSize: 13, color: '#333', textAlign: 'center', lineHeight: 20 },
});
