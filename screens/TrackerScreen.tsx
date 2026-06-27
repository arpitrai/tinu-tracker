import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Image,
  StatusBar,
  Animated,
  Easing,
  BackHandler,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import TrendsChart from '../components/TrendsChart';
import ProfileMenu from '../components/ProfileMenu';
import ProfileModal from '../components/ProfileModal';
import SplitToggle from '../components/SplitToggle';
import CalendarModal from '../components/CalendarModal';
import HistoryTable from '../components/HistoryTable';
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

function ChevronDownIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24">
      <Path d="M6 9L12 15L18 9" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
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

const NAV_ACCENT_W = 42; // width of the sliding gradient accent bar

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
  return (
    user.user_metadata?.avatar_url ||
    user.user_metadata?.picture ||
    user.identities?.[0]?.identity_data?.avatar_url ||
    user.identities?.[0]?.identity_data?.picture ||
    null
  ) ?? null;
}

// "Thu, 25 Jun"
function formatDatePretty(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const wd = dt.toLocaleDateString('en-US', { weekday: 'short' });
  const mon = dt.toLocaleDateString('en-US', { month: 'short' });
  return `${wd}, ${d} ${mon}`;
}

interface Props { user: User; }

export default function TrackerScreen({ user }: Props) {
  const today = useMemo(() => todayKey(), []);
  const yesterday = useMemo(() => offsetDateStr(today, -1), [today]);

  const [activeTab, setActiveTab] = useState<Tab>('entries');
  const [selectedDate, setSelectedDate] = useState(today);

  // Bottom-nav sliding accent bar (concept: Top Accent Slide)
  const [navWidth, setNavWidth] = useState(0);
  const navIndicator = useRef(new Animated.Value(0)).current; // 0 = Daily Log, 1 = Trend
  useEffect(() => {
    Animated.timing(navIndicator, {
      toValue: activeTab === 'entries' ? 0 : 1,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeTab, navIndicator]);
  const [allEntries, setAllEntries] = useState<Map<string, DayEntry>>(new Map());
  const [loading, setLoading] = useState(true);

  const [exercised, setExercised] = useState<boolean | null>(null);
  const [ateSweets, setAteSweets] = useState<boolean | null>(null);
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [menuVisible, setMenuVisible] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [displayName, setDisplayName] = useState(() => getFirstName(user));
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => getAvatarUrl(user));
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    const url = getAvatarUrl(user);
    if (url !== avatarUrl) {
      setAvatarUrl(url);
      setAvatarError(false);
    }
  }, [user]);

  const isToday = selectedDate === today;
  const hasSavedEntry = allEntries.has(selectedDate);
  const readOnly = hasSavedEntry && !isEditing;

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

  const navigateToDate = useCallback((newDate: string) => {
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
  }, [allEntries]);

  const goLeft = () => navigateToDate(offsetDateStr(selectedDate, -1));
  const goRight = () => { if (!isToday) navigateToDate(offsetDateStr(selectedDate, 1)); };

  const handleCancelEdit = useCallback(() => {
    const entry = allEntries.get(selectedDate);
    if (entry) {
      setExercised(entry.exercised);
      setAteSweets(entry.ate_sweets);
      setWeight(entry.weight != null ? String(entry.weight) : '');
    }
    setIsEditing(false);
  }, [allEntries, selectedDate]);

  // Hardware back while editing reverts to the saved view (replaces the old Cancel button).
  useEffect(() => {
    const onBack = () => {
      if (isEditing) { handleCancelEdit(); return true; }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [isEditing, handleCancelEdit]);

  // Seed the weight stepper with the most recent recorded weight (or a default).
  function handleAddWeight() {
    const prior = Array.from(allEntries.values())
      .filter(e => e.weight != null && e.weight !== '' && e.date <= selectedDate)
      .sort((a, b) => b.date.localeCompare(a.date));
    setWeight(prior.length ? String(prior[0].weight) : '70.0');
  }

  const nothingEntered = exercised === null && ateSweets === null && !weight;

  const incrementWeight = () => {
    const current = parseFloat(weight) || 0;
    setWeight((Math.round((current + 0.1) * 10) / 10).toFixed(1));
  };

  const decrementWeight = () => {
    const current = parseFloat(weight) || 0;
    if (current > 0) setWeight((Math.round((current - 0.1) * 10) / 10).toFixed(1));
  };

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

  const performReset = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('entries')
      .delete()
      .eq('user_id', user.id)
      .eq('date', selectedDate);
    if (!error) {
      setAllEntries(prev => {
        const next = new Map(prev);
        next.delete(selectedDate);
        return next;
      });
      setExercised(null);
      setAteSweets(null);
      setWeight('');
      setIsEditing(false);
    }
    setSaving(false);
  };

  const handleReset = () => {
    const title = 'Reset this day?';
    const message =
      'This permanently clears exercise, sugar, and weight for this day — the same as if you had never logged it.';

    // React Native's Alert is a no-op on react-native-web, so fall back to
    // window.confirm there; native still gets the styled destructive dialog.
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) {
        performReset();
      }
      return;
    }

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: performReset },
    ]);
  };

  const chartEntries = useMemo(() => Array.from(allEntries.values()), [allEntries]);

  // Last 30 days (not including today — today is shown in the day card)
  const recentEntries = useMemo<DayEntry[]>(() => {
    const result: DayEntry[] = [];
    for (let i = 1; i <= 30; i++) {
      const d = offsetDateStr(today, -i);
      result.push(allEntries.get(d) ?? { date: d, exercised: null, ate_sweets: null, weight: null });
    }
    return result;
  }, [allEntries, today]);

  const hasEntryFor = useCallback((d: string) => allEntries.has(d), [allEntries]);

  function getDateStatus(): { text: string; tone: 'muted' | 'saved' | 'edit' } {
    if (isEditing) return { text: 'Editing…', tone: 'edit' };
    const rel = isToday ? 'Today' : selectedDate === yesterday ? 'Yesterday' : null;
    if (hasSavedEntry) {
      return { text: rel ? `${rel} · saved ✓` : 'Saved ✓', tone: 'saved' };
    }
    return { text: rel ? `${rel} · not logged` : 'Not logged', tone: 'muted' };
  }

  // Slide the accent bar to the centre of the active tab (two equal-width tabs).
  const accentTranslate = navIndicator.interpolate({
    inputRange: [0, 1],
    outputRange: [navWidth / 4 - NAV_ACCENT_W / 2, (navWidth * 3) / 4 - NAV_ACCENT_W / 2],
  });

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={P.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Hi {displayName}</Text>
        <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.avatarBtn}>
          {avatarUrl && !avatarError ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImg} onError={() => setAvatarError(true)} />
          ) : (
            <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
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
      <CalendarModal
        visible={calendarVisible}
        selectedDate={selectedDate}
        today={today}
        hasEntry={hasEntryFor}
        onSelect={navigateToDate}
        onClose={() => setCalendarVisible(false)}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {activeTab === 'entries' ? (
            <>
              {/* ── Date row (own row, back/forth arrows) ── */}
              <View style={styles.dateRow}>
                <TouchableOpacity
                  style={styles.dateNav}
                  onPress={goLeft}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dateNavText}>‹</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dateCenter}
                  onPress={() => setCalendarVisible(true)}
                  activeOpacity={0.7}
                >
                  <View style={styles.dateMainRow}>
                    <Text style={styles.dateMain}>{formatDatePretty(selectedDate)}</Text>
                    <View style={styles.dateCaret}>
                      <ChevronDownIcon color={P.textMuted} />
                    </View>
                  </View>
                  {(() => {
                    const st = getDateStatus();
                    return (
                      <Text style={[
                        styles.dateSub,
                        st.tone === 'saved' && styles.dateSubSaved,
                        st.tone === 'edit' && styles.dateSubEdit,
                      ]}>
                        {st.text}
                      </Text>
                    );
                  })()}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dateNav, isToday && styles.dateNavOff]}
                  onPress={goRight}
                  disabled={isToday}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dateNavText}>›</Text>
                </TouchableOpacity>
              </View>

              {/* ── Entry section (Thumb Zone) ── */}
              <View style={styles.entrySection}>
                {/* Exercise */}
                <View style={styles.metric}>
                  <View style={styles.mtitleRow}>
                    <Text style={styles.mTitle}>Exercise</Text>
                    <Text style={styles.mHelper}>Any movement</Text>
                  </View>
                  <SplitToggle
                    value={exercised}
                    onChange={setExercised}
                    yesColor={P.green}
                    noColor={P.red}
                    locked={readOnly}
                  />
                </View>

                {/* Sugar */}
                <View style={styles.metric}>
                  <View style={styles.mtitleRow}>
                    <Text style={styles.mTitle}>Sugar</Text>
                    <Text style={styles.mHelper}>Sweets or dessert</Text>
                  </View>
                  <SplitToggle
                    value={ateSweets}
                    onChange={setAteSweets}
                    yesColor={P.red}
                    noColor={P.green}
                    locked={readOnly}
                  />
                </View>

                {/* Weight */}
                <View style={styles.metric}>
                  <View style={styles.mtitleRow}>
                    <Text style={styles.mTitle}>Weight</Text>
                    <Text style={styles.mHelper}>kg</Text>
                  </View>
                  {readOnly ? (
                    <View style={[styles.wtBox, styles.wtBoxLocked]}>
                      <View style={styles.wtSpacer} />
                      <View style={styles.wtVal}>
                        {weight ? (
                          <>
                            <Text style={styles.wtNum}>{weight}</Text>
                            <Text style={styles.wtUnit}>kg</Text>
                          </>
                        ) : (
                          <Text style={styles.wtNotSpecified}>Not specified</Text>
                        )}
                      </View>
                      <View style={styles.wtSpacer} />
                    </View>
                  ) : weight === '' ? (
                    <TouchableOpacity style={styles.wtEmpty} onPress={handleAddWeight} activeOpacity={0.8}>
                      <Text style={styles.wtEmptyText}>+ Add weight</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.wtBox}>
                      <TouchableOpacity style={styles.wtStep} onPress={decrementWeight} activeOpacity={0.7}>
                        <Text style={styles.wtStepText}>–</Text>
                      </TouchableOpacity>
                      <View style={styles.wtVal}>
                        <TextInput
                          style={styles.wtNumInput}
                          value={weight}
                          onChangeText={text => {
                            let v = text.replace(/[^0-9.]/g, '');
                            const dot = v.indexOf('.');
                            if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '');
                            setWeight(v);
                          }}
                          keyboardType="decimal-pad"
                          returnKeyType="done"
                        />
                        <Text style={styles.wtUnit}>kg</Text>
                      </View>
                      <TouchableOpacity style={styles.wtStep} onPress={incrementWeight} activeOpacity={0.7}>
                        <Text style={styles.wtStepText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Action */}
                <View style={styles.actionWrap}>
                  {readOnly ? (
                    // Pressable (not TouchableOpacity): the legacy Touchable responder
                    // intermittently loses the tap to the ScrollView's pan responder,
                    // which is why Edit sometimes needed several taps.
                    <Pressable
                      style={({ pressed }) => [styles.editBtn, pressed && styles.editBtnPressed]}
                      onPress={() => setIsEditing(true)}
                      hitSlop={8}
                    >
                      <Text style={styles.editBtnText}>Edit</Text>
                    </Pressable>
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.saveBtn,
                        isEditing && styles.saveBtnEdit,
                        justSaved && styles.saveBtnDone,
                        nothingEntered && !isEditing && styles.saveBtnWait,
                        saving && styles.disabled,
                      ]}
                      onPress={handleSave}
                      disabled={saving || (nothingEntered && !isEditing)}
                      activeOpacity={0.85}
                    >
                      {saving ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={[
                          styles.saveBtnText,
                          nothingEntered && !isEditing && styles.saveBtnWaitText,
                        ]}>
                          {justSaved ? '✓  Saved' : 'Save'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                  {/* Constant-height slot so the action block stays the same height in every
                      state (read-only / editable / editing) — prevents layout shift. Holds the
                      Reset link when a saved entry exists; otherwise an empty spacer. */}
                  <View style={styles.saveHintWrap}>
                    {hasSavedEntry && (
                      <Pressable
                        onPress={handleReset}
                        disabled={saving}
                        hitSlop={8}
                      >
                        <Text style={styles.resetBtnText}>Reset day</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>

              {/* ── Recent history ── */}
              <HistoryTable entries={recentEntries} onRowPress={navigateToDate} />
            </>
          ) : (
            <TrendsChart
              entries={chartEntries}
              today={today}
              onJumpToDate={(d) => { navigateToDate(d); setActiveTab('entries'); }}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Bottom navigation (Top Accent Slide) ── */}
      <View style={styles.bottomNav} onLayout={e => setNavWidth(e.nativeEvent.layout.width)}>
        {navWidth > 0 && (
          <Animated.View style={[styles.navAccent, { transform: [{ translateX: accentTranslate }] }]}>
            <LinearGradient
              colors={['#F59E0B', '#F43F5E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.navAccentFill}
            />
          </Animated.View>
        )}
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('entries')} activeOpacity={0.7}>
          <NavListIcon color={activeTab === 'entries' ? P.text : P.textMuted} />
          <Text style={[styles.navLabel, activeTab === 'entries' && styles.navLabelActive]}>Daily Log</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('trend')} activeOpacity={0.7}>
          <NavTrendIcon color={activeTab === 'trend' ? P.text : P.textMuted} />
          <Text style={[styles.navLabel, activeTab === 'trend' && styles.navLabelActive]}>Trend</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/* ── Design tokens ── */

const P = {
  bg: '#FFFDFB',
  surface: '#FBF7F2',
  text: '#1C1915',
  textMuted: '#9A9082',
  divider: '#F1ECE5',
  navBtnBg: '#F3EFEA',
  primary: '#7C3AED',
  primaryLight: '#F3EEFE',
  green: '#10B981',
  red: '#EF4444',
};

/* ── Styles ── */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: P.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  flex: { flex: 1 },
  loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: P.bg },
  scroll: { padding: 16, paddingBottom: 32, gap: 12 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
  },
  greeting: { fontSize: 19, fontWeight: '800', color: P.text, letterSpacing: -0.3 },
  avatarBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: P.navBtnBg,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarText: { fontSize: 15, fontWeight: '700', color: P.text },
  avatarImg: { width: 38, height: 38, borderRadius: 19 },

  // Date row (own row)
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: P.navBtnBg,
    borderRadius: 16,
    padding: 6,
    paddingHorizontal: 8,
  },
  dateNav: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 1,
  },
  dateNavOff: { opacity: 0.35, backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0 },
  dateNavText: { fontSize: 20, color: P.text, fontWeight: '400', lineHeight: 24 },
  dateCenter: { alignItems: 'center' },
  dateMainRow: { flexDirection: 'row', alignItems: 'center' },
  dateMain: { fontSize: 15, fontWeight: '800', color: P.text, letterSpacing: -0.2 },
  dateCaret: { marginLeft: 5, marginTop: 2 },
  dateSub: { fontSize: 11, fontWeight: '700', color: P.textMuted, marginTop: 1 },
  dateSubSaved: { color: '#0F8A66' },
  dateSubEdit: { color: '#7C3AED' },

  // Entry section
  entrySection: { paddingTop: 6, gap: 18 },
  metric: {},
  mtitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  mTitle: { fontSize: 17, fontWeight: '800', color: P.text, letterSpacing: -0.3 },
  mHelper: { fontSize: 11.5, fontWeight: '600', color: P.textMuted },

  // Weight
  wtEmpty: {
    backgroundColor: '#F8F7FE',
    borderWidth: 1.5,
    borderColor: '#D6CFE9',
    borderStyle: 'dashed',
    borderRadius: 16,
    height: 60,            // match wtBox so the layout doesn't shift between states
    alignItems: 'center',
    justifyContent: 'center',
  },
  wtEmptyText: { color: '#7C3AED', fontWeight: '700', fontSize: 15 },
  wtBox: {
    backgroundColor: '#F4F1FD',
    borderRadius: 16,
    height: 60,            // fixed so empty/filled/locked states are all the same height
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wtBoxLocked: { backgroundColor: '#F6F4FB' },
  wtStep: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 2,
  },
  wtStepText: { fontSize: 22, color: '#7C3AED', fontWeight: '700', lineHeight: 24 },
  wtSpacer: { width: 38 },
  wtVal: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  wtNum: { fontSize: 28, fontWeight: '800', color: '#7C3AED', letterSpacing: -0.5 },
  wtNumInput: {
    fontSize: 28,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: -0.5,
    textAlign: 'center',
    minWidth: 86,
    padding: 0,
  },
  wtUnit: { fontSize: 13, color: P.textMuted, fontWeight: '700' },
  wtNotSpecified: { fontSize: 15, color: P.textMuted, fontWeight: '600' },

  // Action area
  actionWrap: {},
  editBtn: {
    borderWidth: 1.5,
    borderColor: '#E3D7FB',
    borderRadius: 16,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnPressed: { opacity: 0.6, backgroundColor: '#F8F4FE' },
  editBtnText: { color: P.primary, fontSize: 15.5, fontWeight: '700', letterSpacing: 0.1 },
  saveBtn: {
    backgroundColor: P.primary,
    borderRadius: 16,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: P.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  saveBtnEdit: { backgroundColor: '#7C3AED', shadowColor: '#7C3AED' },
  saveBtnDone: { backgroundColor: '#059669', shadowColor: '#059669' },
  saveBtnWait: { backgroundColor: '#F2EDE7', shadowOpacity: 0, elevation: 0 },
  saveBtnWaitText: { color: '#C8C0B8' },
  disabled: { opacity: 0.4 },
  saveBtnText: { color: '#fff', fontSize: 15.5, fontWeight: '700', letterSpacing: 0.1 },
  saveHintWrap: { height: 30, alignItems: 'center', justifyContent: 'center' },
  resetBtnText: { color: P.textMuted, fontSize: 13.5, fontWeight: '600', letterSpacing: 0.1 },

  // Bottom nav (Top Accent Slide)
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: P.bg,
    borderTopWidth: 1,
    borderTopColor: P.divider,
    paddingTop: 14,
    paddingBottom: 16,
  },
  navAccent: {
    position: 'absolute',
    top: -1.5,
    left: 0,
    width: NAV_ACCENT_W,
    height: 3,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    overflow: 'hidden',
  },
  navAccentFill: { flex: 1 },
  navItem: { flex: 1, alignItems: 'center', gap: 5 },
  navLabel: { fontSize: 11, fontWeight: '500', color: P.textMuted, letterSpacing: 0.3 },
  navLabelActive: { color: P.text, fontWeight: '700' },
});
