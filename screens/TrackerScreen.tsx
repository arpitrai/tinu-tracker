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
  AppState,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { supabase } from '../lib/supabase';
import { setLoggedDates, syncDailyReminders } from '../lib/notifications';
import { validateWeight } from '../lib/weight';
import { friendlyWriteError } from '../lib/errors';
import type { User } from '@supabase/supabase-js';
import TrendsChart from '../components/TrendsChart';
import ProfileMenu from '../components/ProfileMenu';
import ProfileModal from '../components/ProfileModal';
import SplitToggle from '../components/SplitToggle';
import CalendarModal from '../components/CalendarModal';
import HistoryTable from '../components/HistoryTable';
import Toast, { type ToastKind, type ToastState } from '../components/Toast';
import UnsavedChangesModal from '../components/UnsavedChangesModal';
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

// Local time, never UTC: toISOString() would roll the day over at the wrong
// moment for any non-UTC timezone (in IST it reports yesterday until 05:30).
function todayKey(): string {
  const d = new Date();
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
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

// Seed the weight stepper with the nearest known reading so the user barely
// adjusts: prefer the most recent reading on or before the day; otherwise the
// closest reading after it; otherwise 70.0 for a brand-new user.
function pickSeedWeight(entries: Iterable<DayEntry>, forDate: string): string {
  let before: DayEntry | null = null; // latest reading with date <= forDate
  let after: DayEntry | null = null;  // earliest reading with date > forDate
  for (const e of entries) {
    if (e.weight == null || e.weight === '') continue;
    if (e.date <= forDate) {
      if (!before || e.date > before.date) before = e;
    } else if (!after || e.date < after.date) {
      after = e;
    }
  }
  const pick = before ?? after;
  return pick ? String(pick.weight) : '70.0';
}

// Weights are compared numerically, not as strings: stepping 70 up and back
// down yields "70.0", which is the same reading the day was saved with.
function sameWeight(a: string, b: string): boolean {
  const na = parseFloat(a);
  const nb = parseFloat(b);
  if (Number.isNaN(na) && Number.isNaN(nb)) return true; // both blank
  return na === nb;
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
  // The weight editor stays open once opened, even if the user clears every
  // digit — collapsing back to "+ Add weight" mid-typing would yank the field
  // out from under them. "Remove" is the explicit way back to the empty state.
  const [weightActive, setWeightActive] = useState(false);
  const [weightError, setWeightError] = useState(false);
  const weightInputRef = useRef<TextInput>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Tracked so the pending "✓ Saved" reset can be cancelled on unmount.
  const justSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (justSavedTimer.current) clearTimeout(justSavedTimer.current);
  }, []);

  const [toast, setToast] = useState<ToastState | null>(null);
  const toastSeq = useRef(0);
  const showToast = useCallback((kind: ToastKind, message: string) => {
    toastSeq.current += 1;
    setToast({ id: toastSeq.current, kind, message });
  }, []);

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

  // True when the form no longer matches what is stored for the day — either
  // new entries on an unlogged day, or edits to a saved one. Everything that
  // navigates away from the day is routed through `guardedNav` below, which
  // asks the user to save first while this is true.
  const isDirty = useMemo(() => {
    const saved = allEntries.get(selectedDate);
    const savedWeight = saved?.weight != null ? String(saved.weight) : '';
    return (
      exercised !== (saved?.exercised ?? null) ||
      ateSweets !== (saved?.ate_sweets ?? null) ||
      !sameWeight(weight, savedWeight)
    );
  }, [allEntries, selectedDate, exercised, ateSweets, weight]);

  // The navigation the guard prompt is holding back, replayed on Save/Discard.
  const pendingNav = useRef<(() => void) | null>(null);
  const [guardVisible, setGuardVisible] = useState(false);

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

  // Keep the daily reminders in step with what's logged: publish the set of
  // logged days (today forward — past days are never scheduled) and re-lay the
  // reminders. Runs on initial load and after every save/reset, so a day's
  // reminder is dropped the instant that day is logged. Fire-and-forget: no-ops
  // when notifications are off or permission is denied.
  useEffect(() => {
    const loggedForward = Array.from(allEntries.keys()).filter((k) => k >= today);
    setLoggedDates(loggedForward)
      .then(() => syncDailyReminders())
      .catch(() => {});
  }, [allEntries, today]);

  // Re-sync when the app returns to the foreground: the day may have rolled over,
  // or the user may have logged on another device since we last scheduled.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncDailyReminders().catch(() => {});
    });
    return () => sub.remove();
  }, []);

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
    setWeightActive(false);
    setWeightError(false);
  }, [allEntries]);

  // Drop whatever is in the form and show the stored day again (nothing stored
  // = the empty state). Used by Discard and by hardware back while editing.
  const revertToSaved = useCallback(() => {
    const entry = allEntries.get(selectedDate);
    setExercised(entry?.exercised ?? null);
    setAteSweets(entry?.ate_sweets ?? null);
    setWeight(entry?.weight != null ? String(entry.weight) : '');
    setIsEditing(false);
    setWeightActive(false);
    setWeightError(false);
  }, [allEntries, selectedDate]);

  // Every exit from the current day goes through here: run it straight away
  // when there is nothing to lose, otherwise park it behind the prompt.
  // An open editor counts even with nothing changed yet — leaving mid-edit
  // should never be silent.
  const guardedNav = useCallback((run: () => void) => {
    if (isDirty || isEditing) {
      pendingNav.current = run;
      setGuardVisible(true);
      return;
    }
    run();
  }, [isDirty, isEditing]);

  const runPendingNav = useCallback(() => {
    const run = pendingNav.current;
    pendingNav.current = null;
    setGuardVisible(false);
    run?.();
  }, []);

  const dismissGuard = useCallback(() => {
    pendingNav.current = null;
    setGuardVisible(false);
  }, []);

  // The two tabs are the app's only "pages", so switching them is what back and
  // a horizontal swipe both mean. Leaving the log is guarded; returning to it is
  // not — the guard is about abandoning unsaved entries, not about arriving.
  const switchTab = useCallback((next: Tab) => {
    if (next === activeTab) return;
    if (next === 'trend') guardedNav(() => setActiveTab('trend'));
    else setActiveTab('entries');
  }, [activeTab, guardedNav]);

  // Swipe left for Trend, right for Daily Log — the gesture users arrive
  // expecting from any tabbed app. activeOffsetX/failOffsetY keep it from
  // stealing the vertical scroll: it only takes over on a decisive sideways
  // drag, and gives up entirely once the finger has moved vertically.
  const swipeTabs = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-24, 24])
        .failOffsetY([-18, 18])
        .onEnd((e) => {
          if (e.translationX <= -60) runOnJS(switchTab)('trend');
          else if (e.translationX >= 60) runOnJS(switchTab)('entries');
        }),
    [switchTab],
  );

  const goLeft = () => guardedNav(() => navigateToDate(offsetDateStr(selectedDate, -1)));
  const goRight = () => {
    if (!isToday) guardedNav(() => navigateToDate(offsetDateStr(selectedDate, 1)));
  };

  // Android back / edge-swipe. There is no navigation stack to pop, so this is
  // the app's whole back hierarchy, innermost first. Returning false hands the
  // press to the OS, which closes the app — so that must stay the last resort,
  // reachable only from the Daily Log on today with nothing open.
  useEffect(() => {
    const onBack = () => {
      // 1. Anything overlaid closes first. (Each Modal also has its own
      //    onRequestClose; these cover the ones driven from this screen.)
      if (guardVisible) { dismissGuard(); return true; }
      if (calendarVisible) { setCalendarVisible(false); return true; }
      if (profileVisible) { setProfileVisible(false); return true; }
      if (menuVisible) { setMenuVisible(false); return true; }

      // 2. Unsaved work asks before anything is lost; an untouched editor just
      //    reverts, since back is this screen's Cancel gesture (it replaced the
      //    old Cancel button) and asking there would be circular.
      if (isDirty) { guardedNav(revertToSaved); return true; }
      if (isEditing) { revertToSaved(); return true; }

      // 3. Then unwind the screen itself: Trend back to the log, a past day
      //    back to today. Both are what the user last navigated away from.
      if (activeTab !== 'entries') { setActiveTab('entries'); return true; }
      if (!isToday) { navigateToDate(today); return true; }

      return false; // Daily Log, today, nothing open — let the OS exit.
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [
    guardVisible, dismissGuard, calendarVisible, profileVisible, menuVisible,
    isDirty, guardedNav, isEditing, revertToSaved, activeTab, isToday,
    navigateToDate, today,
  ]);

  // Web only: the same protection for a tab close or reload, which no in-app
  // handler can intercept. The browser shows its own generic prompt.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  // Open the weight editor seeded with the nearest recorded weight (or 70.0),
  // then focus and select it so typing a different number replaces the seed
  // outright — the stepper is a convenience, not the only way in.
  function handleAddWeight() {
    setWeight(pickSeedWeight(allEntries.values(), selectedDate));
    setWeightActive(true);
    setWeightError(false);
    // Focus on the next frame: the input only mounts once the editor is shown.
    requestAnimationFrame(() => weightInputRef.current?.focus());
  }

  function handleRemoveWeight() {
    setWeight('');
    setWeightActive(false);
    setWeightError(false);
  }

  // Shown whenever there is a value, or the user has deliberately opened it.
  const showWeightEditor = weight !== '' || weightActive;

  const nothingEntered = exercised === null && ateSweets === null && !weight;

  const stepWeight = (delta: number) => {
    setWeightError(false);
    if (weight.trim() === '') {
      // Stepping from an empty field starts at the seed rather than 0.1.
      setWeight(pickSeedWeight(allEntries.values(), selectedDate));
      return;
    }
    const current = parseFloat(weight) || 0;
    const next = Math.round((current + delta) * 10) / 10;
    if (next < 0) return;
    setWeight(next.toFixed(1));
  };

  const incrementWeight = () => stepWeight(0.1);
  const decrementWeight = () => stepWeight(-0.1);

  // Resolves to true only when the day actually reached the database — the
  // unsaved-changes prompt uses that to decide whether to let the user leave.
  const handleSave = async (): Promise<boolean> => {
    // Any single metric is enough to save a day, but a completely empty day is
    // not a day — that is what "Reset day" is for. The Save button is disabled
    // in this state; this guard keeps the rule true however it is reached.
    if (nothingEntered) {
      showToast('error', 'Log exercise, sugar or weight before saving.');
      return false;
    }

    const wt = validateWeight(weight);
    if (!wt.ok) {
      setWeightError(true);
      showToast('error', wt.message ?? 'Check the weight you entered');
      return false;
    }
    setWeightError(false);

    setSaving(true);
    const { error } = await supabase
      .from('entries')
      .upsert(
        { user_id: user.id, date: selectedDate, exercised, ate_sweets: ateSweets, weight: wt.value },
        { onConflict: 'user_id,date' },
      );
    setSaving(false);

    if (error) {
      // Flag the field when the failure is clearly about the weight value.
      if (error.code === '22P02' || error.code === '22003' || /weight/i.test(error.message ?? '')) {
        setWeightError(true);
      }
      showToast('error', friendlyWriteError(error, 'save'));
      return false;
    }

    setWeight(wt.value ?? '');
    setWeightActive(false);
    setAllEntries(prev => {
      const next = new Map(prev);
      next.set(selectedDate, { date: selectedDate, exercised, ate_sweets: ateSweets, weight: wt.value });
      return next;
    });
    setJustSaved(true);
    setIsEditing(false);
    showToast('success', 'Saved');
    if (justSavedTimer.current) clearTimeout(justSavedTimer.current);
    justSavedTimer.current = setTimeout(() => setJustSaved(false), 2000);
    return true;
  };

  // "Save" inside the prompt. A failed write keeps the user on the day so they
  // can see the error toast (which the modal would otherwise cover) and retry.
  const handleGuardSave = async () => {
    if (await handleSave()) runPendingNav();
    else dismissGuard();
  };

  const performReset = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('entries')
      .delete()
      .eq('user_id', user.id)
      .eq('date', selectedDate);
    setSaving(false);

    if (error) {
      showToast('error', friendlyWriteError(error, 'reset'));
      return;
    }

    setAllEntries(prev => {
      const next = new Map(prev);
      next.delete(selectedDate);
      return next;
    });
    setExercised(null);
    setAteSweets(null);
    setWeight('');
    setWeightActive(false);
    setWeightError(false);
    setIsEditing(false);
    showToast('success', 'Day reset');
  };

  const handleReset = () => {
    const title = 'Reset this day?';
    const message =
      'This permanently clears exercise, sugar, and weight for this day - the same as if you had never logged it.';

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

  // Last 30 days, today first. Today is also shown in the day card above, but
  // it has to appear here too — otherwise saving today changes nothing visible.
  const recentEntries = useMemo<DayEntry[]>(() => {
    const result: DayEntry[] = [];
    for (let i = 0; i < 30; i++) {
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
      return { text: rel ? `${rel} · Saved ✓` : 'Saved ✓', tone: 'saved' };
    }
    return { text: rel ? `${rel} · Not logged` : 'Not logged', tone: 'muted' };
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
        onSignOut={() => guardedNav(() => { supabase.auth.signOut(); })}
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
        onSelect={(d) => guardedNav(() => navigateToDate(d))}
        onClose={() => setCalendarVisible(false)}
      />
      <UnsavedChangesModal
        visible={guardVisible}
        dateLabel={formatDatePretty(selectedDate)}
        hasChanges={isDirty}
        canSave={!nothingEntered}
        saving={saving}
        onSave={handleGuardSave}
        onDiscard={() => { revertToSaved(); runPendingNav(); }}
        onCancel={dismissGuard}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <GestureDetector gesture={swipeTabs}>
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
                    {!readOnly && showWeightEditor ? (
                      <TouchableOpacity onPress={handleRemoveWeight} hitSlop={8}>
                        <Text style={styles.wtRemove}>Remove</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.mHelper}>kg</Text>
                    )}
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
                  ) : !showWeightEditor ? (
                    <TouchableOpacity style={styles.wtEmpty} onPress={handleAddWeight} activeOpacity={0.8}>
                      <Text style={styles.wtEmptyText}>+ Add weight</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.wtBox, weightError && styles.wtBoxError]}>
                      <TouchableOpacity style={styles.wtStep} onPress={decrementWeight} activeOpacity={0.7}>
                        <Text style={styles.wtStepText}>–</Text>
                      </TouchableOpacity>
                      <View style={styles.wtVal}>
                        <TextInput
                          testID="weight-input"
                          ref={weightInputRef}
                          style={[styles.wtNumInput, weightError && styles.wtNumInputError]}
                          value={weight}
                          onChangeText={text => {
                            let v = text.replace(/[^0-9.]/g, '');
                            const dot = v.indexOf('.');
                            if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '');
                            setWeight(v);
                            setWeightError(false);
                          }}
                          placeholder="0.0"
                          placeholderTextColor="#C4B8E4"
                          selectTextOnFocus
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
                        nothingEntered && styles.saveBtnWait,
                        saving && styles.disabled,
                      ]}
                      onPress={handleSave}
                      // At least one of the three must be logged — when editing
                      // too, not just when creating. Clearing every field is
                      // what "Reset day" is for.
                      disabled={saving || nothingEntered}
                      activeOpacity={0.85}
                    >
                      {saving ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={[
                          styles.saveBtnText,
                          nothingEntered && styles.saveBtnWaitText,
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

              {/* ── Recent history (hidden until the user has logged at least one day ever) ── */}
              {allEntries.size > 0 && (
                <HistoryTable
                  entries={recentEntries}
                  onRowPress={(d) => guardedNav(() => navigateToDate(d))}
                />
              )}
            </>
          ) : (
            <TrendsChart
              entries={chartEntries}
              today={today}
              onJumpToDate={(d) => { navigateToDate(d); setActiveTab('entries'); }}
            />
          )}
        </ScrollView>
        </GestureDetector>
      </KeyboardAvoidingView>

      <Toast toast={toast} onDismiss={() => setToast(null)} />

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
        <TouchableOpacity style={styles.navItem} onPress={() => switchTab('entries')} activeOpacity={0.7}>
          <NavListIcon color={activeTab === 'entries' ? P.text : P.textMuted} />
          <Text style={[styles.navLabel, activeTab === 'entries' && styles.navLabelActive]}>Daily Log</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => switchTab('trend')} activeOpacity={0.7}>
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
  wtRemove: { fontSize: 12.5, fontWeight: '700', color: P.primary },

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
  // Borders are inset in RN, so flagging the field keeps the fixed 60px height.
  wtBoxError: { backgroundColor: '#FEF2F2', borderWidth: 1.5, borderColor: P.red },
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
  wtVal: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wtNum: { fontSize: 26, fontWeight: '800', color: '#7C3AED', letterSpacing: -0.5 },
  // A fixed width, not minWidth: on web the input would otherwise stretch to
  // fill the row. 88px comfortably fits a 3-digit weight with one decimal.
  wtNumInput: {
    fontSize: 24,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: -0.5,
    textAlign: 'center',
    width: 88,
    height: 40,
    paddingVertical: 0,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  wtNumInputError: { color: P.red },
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
