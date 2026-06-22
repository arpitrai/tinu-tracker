import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import TrendsChart from '../components/TrendsChart';
import ProfileMenu from '../components/ProfileMenu';
import ProfileModal from '../components/ProfileModal';
import TriToggle from '../components/TriToggle';
import Svg, { Path } from 'react-native-svg';

function NavListIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path d="M3 6h18M3 12h18M3 18h18" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function NavTrendIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path d="M4 18L9 12L13 15L20 7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

interface DayEntry {
  id?: string;
  date: string;
  exercised: boolean | null;
  ate_sweets: boolean | null;
  weight: string | number | null;
}


type Tab = 'entries' | 'trend';

function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function offsetDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function getFirstName(user: User): string {
  const full: string = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'there';
  return full.split(' ')[0];
}

function getAvatarUrl(user: User): string | null {
  // Supabase maps Google's `picture` claim to avatar_url, but also keeps `picture` raw.
  // Identities array has the unprocessed provider data as a fallback.
  return (
    user.user_metadata?.avatar_url ||
    user.user_metadata?.picture ||
    user.identities?.[0]?.identity_data?.avatar_url ||
    user.identities?.[0]?.identity_data?.picture ||
    null
  ) ?? null;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function formatDateFull(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

interface Props { user: User; }

export default function TrackerScreen({ user }: Props) {
  const today = useMemo(() => todayKey(), []);
  const yesterday = useMemo(() => offsetDateStr(today, -1), [today]);

  const [activeTab, setActiveTab] = useState<Tab>('entries');
  const [selectedDate, setSelectedDate] = useState(today);
  const [allEntries, setAllEntries] = useState<Map<string, DayEntry>>(new Map());
  const [loading, setLoading] = useState(true);

  // Form state for the currently selected day
  const [exercised, setExercised] = useState<boolean | null>(null);
  const [ateSweets, setAteSweets] = useState<boolean | null>(null);
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const [menuVisible, setMenuVisible] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const [displayName, setDisplayName] = useState(() => getFirstName(user));
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => getAvatarUrl(user));
  const [avatarError, setAvatarError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Sync avatar if the user object is updated (e.g. after OAuth completes)
  useEffect(() => {
    const url = getAvatarUrl(user);
    if (url !== avatarUrl) {
      setAvatarUrl(url);
      setAvatarError(false);
    }
  }, [user]);

  const savedEntry = allEntries.get(selectedDate);
  const hasSavedEntry = !!savedEntry;
  const isToday = selectedDate === today;

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('entries')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (!error && data) {
      const map = new Map<string, DayEntry>();
      for (const e of data) map.set(e.date, e);
      setAllEntries(map);
      const todayEntry = map.get(today);
      if (todayEntry) {
        setExercised(todayEntry.exercised ?? null);
        setAteSweets(todayEntry.ate_sweets ?? null);
        setWeight(todayEntry.weight != null ? String(todayEntry.weight) : '');
      }
    }
    setLoading(false);
  }, [user.id, today]);

  useEffect(() => { loadData(); }, [loadData]);

  function navigateToDate(newDate: string) {
    setSelectedDate(newDate);
    const entry = allEntries.get(newDate);
    if (entry) {
      setExercised(entry.exercised);
      setAteSweets(entry.ate_sweets);
      setWeight(entry.weight != null ? String(entry.weight) : '');
    } else {
      setExercised(null);
      setAteSweets(null);
      setWeight('');
    }
    setJustSaved(false);
    setIsEditing(false);
  }

  const goLeft = () => navigateToDate(offsetDateStr(selectedDate, -1));
  const goRight = () => { if (!isToday) navigateToDate(offsetDateStr(selectedDate, 1)); };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('entries')
      .upsert(
        { user_id: user.id, date: selectedDate, exercised, ate_sweets: ateSweets, weight: weight || null },
        { onConflict: 'user_id,date' },
      );
    if (!error) {
      setAllEntries(prev => {
        const next = new Map(prev);
        next.set(selectedDate, { date: selectedDate, exercised, ate_sweets: ateSweets, weight: weight || null });
        return next;
      });
      setJustSaved(true);
      setIsEditing(false);
      setTimeout(() => setJustSaved(false), 2000);
    }
    setSaving(false);
  };

  const chartEntries = useMemo(() => Array.from(allEntries.values()), [allEntries]);

  function getDayLabel(): string {
    if (selectedDate === today) return 'Today';
    if (selectedDate === yesterday) return 'Yesterday';
    return formatDateShort(selectedDate);
  }

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={M3.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}, {displayName}</Text>
        </View>
        <TouchableOpacity
          onPress={() => setMenuVisible(true)}
          style={styles.avatarBtn}
        >
          {avatarUrl && !avatarError ? (
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatarImg}
              onError={() => setAvatarError(true)}
            />
          ) : (
            <Text style={styles.avatarText}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ProfileMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onProfile={() => setProfileVisible(true)}
        onSignOut={() => supabase.auth.signOut()}
      />
      <ProfileModal
        visible={profileVisible}
        onClose={() => setProfileVisible(false)}
        user={user}
        avatarUrl={avatarUrl}
        onNameSaved={(name) => setDisplayName(name.split(' ')[0] || name)}
      />


      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {activeTab === 'entries' ? (
            /* ── Entries tab ── */
            <View style={styles.dayCard}>
              {/* Day navigation — arrows tucked beside label */}
              <View style={styles.dayNav}>
                <TouchableOpacity style={styles.navBtn} onPress={goLeft} activeOpacity={0.7}>
                  <Text style={styles.navBtnText}>‹</Text>
                </TouchableOpacity>

                <View style={styles.dayLabelWrap}>
                  <Text style={styles.dayLabel}>{getDayLabel()}</Text>
                  <Text style={styles.daySubLabel}>{formatDateFull(selectedDate)}</Text>
                </View>

                <TouchableOpacity
                  style={[styles.navBtn, isToday && styles.navBtnDisabled]}
                  onPress={goRight}
                  disabled={isToday}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.navBtnText, isToday && styles.navBtnTextDisabled]}>›</Text>
                </TouchableOpacity>
              </View>

              {/* Entry fields — read-only when saved, editable otherwise */}
              {hasSavedEntry && !isEditing ? (
                <View>
                  <ReadOnlyRow icon="🏃" label="Exercise" value={exercised === null ? '—' : exercised ? 'Yes' : 'No'} valueColor={exercised === null ? M3.onSurfaceVariant : exercised ? M3.green : M3.red} />
                  <View style={styles.entryDivider} />
                  <ReadOnlyRow icon="🍬" label="Sweets" value={ateSweets === null ? '—' : ateSweets ? 'Yes' : 'No'} valueColor={ateSweets === null ? M3.onSurfaceVariant : !ateSweets ? M3.green : M3.red} />
                  <View style={styles.entryDivider} />
                  <ReadOnlyRow icon="⚖️" label="Weight" value={weight ? `${weight} kg` : '—'} />
                </View>
              ) : (
                <View>
                  <View style={styles.entryRow}>
                    <View style={styles.entryRowLeft}>
                      <Text style={styles.entryRowIcon}>🏃</Text>
                      <Text style={styles.entryRowLabel}>Exercise</Text>
                    </View>
                    <TriToggle
                      value={exercised}
                      onChange={setExercised}
                      yesColor={M3.green}
                      noColor={M3.red}
                    />
                  </View>

                  <View style={styles.entryDivider} />

                  <View style={styles.entryRow}>
                    <View style={styles.entryRowLeft}>
                      <Text style={styles.entryRowIcon}>🍬</Text>
                      <Text style={styles.entryRowLabel}>Sweets</Text>
                    </View>
                    <TriToggle
                      value={ateSweets}
                      onChange={setAteSweets}
                      yesColor={M3.red}
                      noColor={M3.green}
                    />
                  </View>

                  <View style={styles.entryDivider} />

                  <View style={styles.entryRow}>
                    <View style={styles.entryRowLeft}>
                      <Text style={styles.entryRowIcon}>⚖️</Text>
                      <Text style={styles.entryRowLabel}>Weight</Text>
                    </View>
                    <View style={styles.weightInputWrap}>
                      <TextInput
                        style={styles.weightRowInput}
                        value={weight}
                        onChangeText={text => {
                          let v = text.replace(/[^0-9.]/g, '');
                          const dot = v.indexOf('.');
                          if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '');
                          setWeight(v);
                        }}
                        keyboardType="decimal-pad"
                        placeholder=""
                        returnKeyType="done"
                      />
                      <Text style={styles.weightRowUnit}>kg</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Edit / Save button */}
              {hasSavedEntry && !isEditing ? (
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => setIsEditing(true)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.primaryBtn, justSaved && styles.savedBtn, saving && styles.disabled]}
                  onPress={handleSave}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      {justSaved ? '✓  Saved' : 'Save'}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ) : (
            /* ── Trend tab ── */
            <>
              {chartEntries.length > 0 ? (
                <TrendsChart entries={chartEntries} />
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>📊</Text>
                  <Text style={styles.emptyTitle}>No data yet</Text>
                  <Text style={styles.emptyDesc}>Log some entries to see your trends here.</Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Bottom navigation ── */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('entries')}
          activeOpacity={0.7}
        >
          <View style={[styles.navIndicator, activeTab === 'entries' && styles.navIndicatorActive]}>
            <NavListIcon color={activeTab === 'entries' ? M3.primary : M3.onSurfaceVariant} />
          </View>
          <Text style={[styles.navLabel, activeTab === 'entries' && styles.navLabelActive]}>
            Daily Log
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('trend')}
          activeOpacity={0.7}
        >
          <View style={[styles.navIndicator, activeTab === 'trend' && styles.navIndicatorActive]}>
            <NavTrendIcon color={activeTab === 'trend' ? M3.primary : M3.onSurfaceVariant} />
          </View>
          <Text style={[styles.navLabel, activeTab === 'trend' && styles.navLabelActive]}>
            Trend
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/* ── Sub-components ── */

function ReadOnlyRow({ icon, label, value, valueColor }: {
  icon: string;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.entryRow}>
      <View style={styles.entryRowLeft}>
        <Text style={styles.entryRowIcon}>{icon}</Text>
        <Text style={styles.entryRowLabel}>{label}</Text>
      </View>
      <Text style={[styles.readOnlyValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

/* ── Design tokens (Material Design 3) ── */

const M3 = {
  primary: '#1C6EF2',
  onPrimary: '#FFFFFF',
  primaryContainer: '#D8E2FF',
  onPrimaryContainer: '#001252',
  secondaryContainer: '#DAE2F9',
  onSecondaryContainer: '#131C2B',
  surface: '#FEFBFF',
  onSurface: '#1B1B1F',
  surfaceVariant: '#E1E2EC',
  onSurfaceVariant: '#44474F',
  surfaceContainerLow: '#F0F2FF',
  outline: '#74777F',
  outlineVariant: '#C4C6D0',
  green: '#00C896',
  red: '#FF4D4D',
};

/* ── Styles ── */

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: M3.surface },
  flex: { flex: 1 },
  loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: M3.surface },
  scroll: { padding: 20, paddingBottom: 24 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  greeting: { fontSize: 22, fontWeight: '400', color: M3.onSurface },
  headerDate: { fontSize: 13, color: M3.onSurfaceVariant, marginTop: 2 },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: M3.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: M3.onPrimaryContainer },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },

  // Bottom navigation (M3 Navigation Bar)
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: M3.surface,
    borderTopWidth: 1,
    borderTopColor: M3.outlineVariant,
    paddingTop: 12,
    paddingBottom: 16,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  navIndicator: {
    width: 64,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIndicatorActive: {
    backgroundColor: M3.primaryContainer,
  },
  navLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: M3.onSurfaceVariant,
    letterSpacing: 0.4,
  },
  navLabelActive: {
    color: M3.primary,
    fontWeight: '700',
  },

  // Day card (M3 ElevatedCard tonal)
  dayCard: {
    backgroundColor: M3.surfaceContainerLow,
    borderRadius: 28,
    padding: 18,
    gap: 14,
  },

  // Day navigation
  dayNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: M3.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBtnDisabled: { opacity: 0.38 },
  navBtnText: { fontSize: 24, color: M3.onSurface, fontWeight: '300', lineHeight: 28 },
  navBtnTextDisabled: { color: M3.outline },
  dayLabelWrap: { alignItems: 'center', minWidth: 120 },
  dayLabel: { fontSize: 22, fontWeight: '400', color: M3.onSurface },
  daySubLabel: { fontSize: 12, color: M3.onSurfaceVariant, marginTop: 2 },

  // Entry rows
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 4,
  },
  entryRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  entryRowIcon: { fontSize: 20 },
  entryRowLabel: { fontSize: 16, fontWeight: '400', color: M3.onSurface },
  entryDivider: { height: 1, backgroundColor: M3.outlineVariant },

  weightInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  weightRowInput: {
    fontSize: 22,
    fontWeight: '400',
    color: M3.onSurface,
    letterSpacing: -0.5,
    width: 90,
    textAlign: 'right',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  weightRowUnit: { fontSize: 14, color: M3.onSurfaceVariant, fontWeight: '400' },

  // Read-only value
  readOnlyValue: { fontSize: 16, fontWeight: '400', color: M3.onSurface },

  // Edit button (M3 Outlined Button)
  editBtn: {
    borderWidth: 1,
    borderColor: M3.outline,
    borderRadius: 100,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 2,
  },
  editBtnText: { color: M3.primary, fontSize: 14, fontWeight: '500', letterSpacing: 0.1 },

  // Primary button (M3 Filled Button)
  primaryBtn: {
    backgroundColor: M3.primary,
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 2,
  },
  savedBtn: { backgroundColor: '#146C2E' },
  disabled: { opacity: 0.38 },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '500', letterSpacing: 0.1 },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 24, fontWeight: '400', color: M3.onSurface },
  emptyDesc: { fontSize: 14, color: M3.onSurfaceVariant, textAlign: 'center' },
});
