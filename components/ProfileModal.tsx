import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Image,
  StatusBar,
  Alert,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import { scheduleDailyReminders } from '../lib/notifications';

interface Props {
  visible: boolean;
  onClose: () => void;
  user: User;
  avatarUrl?: string | null;
  onNameSaved?: (name: string) => void;
}

// New multi-time storage; legacy single-time keys are migrated on first load.
const REMINDER_TIMES_KEY = '@tinu/reminderTimes';
const LEGACY_ON_KEY = '@tinu/reminderEnabled';
const LEGACY_TIME_KEY = '@tinu/reminderTime';

// Quick-pick times shown as chips. Any of them can be on at once, and the user
// can add their own via the picker. Values are "HH:MM" (24h).
const PRESETS = ['09:00', '14:00', '22:00'];
const DEFAULT_TIME = '22:00';

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function toHHMM(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function ProfileModal({ visible, onClose, user, avatarUrl, onNameSaved }: Props) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [times, setTimes] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerValue, setPickerValue] = useState(new Date());

  const remindersOn = times.length > 0;

  useEffect(() => {
    if (!visible) return;
    setName(user.user_metadata?.full_name ?? '');
    setError(null);
    setImgError(false);
    // Load saved reminder times, migrating from the old single-time keys once.
    (async () => {
      const raw = await AsyncStorage.getItem(REMINDER_TIMES_KEY);
      if (raw != null) {
        try { setTimes(JSON.parse(raw)); } catch { setTimes([]); }
        return;
      }
      const legacyOn = await AsyncStorage.getItem(LEGACY_ON_KEY);
      const legacyTime = await AsyncStorage.getItem(LEGACY_TIME_KEY);
      const migrated = legacyOn === '1' && legacyTime ? [legacyTime] : [];
      setTimes(migrated);
      await AsyncStorage.setItem(REMINDER_TIMES_KEY, JSON.stringify(migrated));
    })();
  }, [visible, user]);

  // Single source of truth: persist `next` and (re)schedule the OS notifications.
  // Reverts if the user denied the notification permission.
  const commitTimes = async (next: string[]) => {
    const sorted = Array.from(new Set(next)).sort();
    setTimes(sorted);
    await AsyncStorage.setItem(REMINDER_TIMES_KEY, JSON.stringify(sorted));
    const ok = await scheduleDailyReminders(sorted);
    if (!ok && sorted.length > 0) {
      setTimes([]);
      await AsyncStorage.setItem(REMINDER_TIMES_KEY, JSON.stringify([]));
      const msg = 'Enable notifications for Tinu Tracker in your device Settings to get reminders.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Notifications are off', msg);
    }
  };

  const toggleReminders = (on: boolean) => commitTimes(on ? (times.length ? times : [DEFAULT_TIME]) : []);
  const togglePreset = (t: string) =>
    commitTimes(times.includes(t) ? times.filter((x) => x !== t) : [...times, t]);
  const removeTime = (t: string) => commitTimes(times.filter((x) => x !== t));

  const onPickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (event.type === 'set' && date) commitTimes([...times, toHHMM(date)]);
    } else if (date) {
      setPickerValue(date); // iOS spinner updates live; committed via Done
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const trimmed = name.trim();
      const { error: nameErr } = await supabase.auth.updateUser({ data: { full_name: trimmed } });
      if (nameErr) throw nameErr;
      onNameSaved?.(trimmed);
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
    }
    setSaving(false);
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setError(null);
    try {
      const { error: delErr } = await supabase.rpc('delete_user_account');
      if (delErr) throw delErr;
      await supabase.auth.signOut();
      const doneMsg = 'Your account and all of your data have been permanently deleted.';
      if (Platform.OS === 'web') window.alert(`Account deleted\n\n${doneMsg}`);
      else Alert.alert('Account deleted', doneMsg);
    } catch (e: any) {
      setError(e.message ?? 'Could not delete your account. Please try again.');
      setDeleting(false);
    }
  };

  const confirmDeleteAccount = () => {
    const message =
      'This permanently deletes your account and all of your logged data. ' +
      'This cannot be undone and your data is not recoverable.';
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete account?\n\n${message}`)) handleDeleteAccount();
      return;
    }
    Alert.alert('Delete account?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: handleDeleteAccount },
    ]);
  };

  const busy = saving || deleting;
  const initial = (user.user_metadata?.full_name ?? user.email ?? '?').charAt(0).toUpperCase();
  // Custom (non-preset) times get their own removable chips.
  const customTimes = times.filter((t) => !PRESETS.includes(t));

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {/* Gradient hero header */}
            <LinearGradient
              colors={['#F59E0B', '#F43F5E', '#8B5CF6']}
              locations={[0, 0.46, 1]}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={styles.hero}
            >
              <TouchableOpacity onPress={onClose} disabled={busy} hitSlop={12} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </LinearGradient>

            {/* Avatar overlapping the gradient */}
            <View style={styles.avatarWrap}>
              {avatarUrl && !imgError ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImg} onError={() => setImgError(true)} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>{initial}</Text>
                </View>
              )}
            </View>

            {/* Editable name + read-only email, centered */}
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              placeholder="Add your name"
              placeholderTextColor={M3.outline}
              autoCapitalize="words"
              returnKeyType="done"
              textAlign="center"
            />
            <Text style={styles.email}>{user.email}</Text>

            {/* Reminder card */}
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>Daily reminder</Text>
                <Switch
                  value={remindersOn}
                  onValueChange={toggleReminders}
                  trackColor={{ true: M3.primary, false: M3.outlineVariant }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {remindersOn ? (
                <>
                  <Text style={styles.remindLabel}>REMIND ME AT</Text>
                  <View style={styles.chips}>
                    {PRESETS.map((t) => {
                      const sel = times.includes(t);
                      return (
                        <TouchableOpacity
                          key={t}
                          style={[styles.chip, sel && styles.chipSel]}
                          onPress={() => togglePreset(t)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.chipText, sel && styles.chipTextSel]}>{formatTime(t)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                    {customTimes.map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.chip, styles.chipSel]}
                        onPress={() => removeTime(t)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, styles.chipTextSel]}>{formatTime(t)}  ✕</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={[styles.chip, styles.chipAdd]}
                      onPress={() => { setPickerValue(new Date()); setShowPicker(true); }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.chipAddText}>+ Add</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.remindHint}>You'll get a nudge to log your day at each time.</Text>
                </>
              ) : (
                <Text style={styles.remindHint}>Off - turn on to get a daily nudge to log your day.</Text>
              )}
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.saveBtn, busy && styles.btnDisabled]}
              onPress={handleSave}
              disabled={busy}
              activeOpacity={0.85}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save changes</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteLink}
              onPress={confirmDeleteAccount}
              disabled={busy}
              activeOpacity={0.6}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {deleting ? (
                <ActivityIndicator size="small" color={M3.error} />
              ) : (
                <Text style={[styles.deleteText, busy && styles.btnDisabled]}>Delete account</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* iOS: spinner in a bottom sheet with Done. Android: native dialog (rendered inline). */}
        {showPicker && Platform.OS === 'ios' ? (
          <Modal visible transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
            <View style={styles.sheetBackdrop}>
              <View style={styles.sheet}>
                <View style={styles.sheetBar}>
                  <TouchableOpacity onPress={() => setShowPicker(false)} hitSlop={10}>
                    <Text style={styles.sheetCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.sheetTitle}>Add a time</Text>
                  <TouchableOpacity
                    onPress={() => { commitTimes([...times, toHHMM(pickerValue)]); setShowPicker(false); }}
                    hitSlop={10}
                  >
                    <Text style={styles.sheetDone}>Add</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={pickerValue}
                  mode="time"
                  is24Hour={false}
                  display="spinner"
                  onChange={onPickerChange}
                />
              </View>
            </View>
          </Modal>
        ) : showPicker ? (
          <DateTimePicker value={pickerValue} mode="time" is24Hour={false} display="default" onChange={onPickerChange} />
        ) : null}

        <StatusBar barStyle="light-content" />
      </View>
    </Modal>
  );
}

const M3 = {
  primary: '#7C3AED',
  ink: '#1B1B1F',
  onSurface: '#1B1B1F',
  onSurfaceVariant: '#44474F',
  outline: '#9A9AA5',
  outlineVariant: '#C4C6D0',
  surface: '#FEFBFF',
  line: '#E5E3EC',
  primaryContainer: '#ECE0FF',
  onPrimaryContainer: '#2A0A5E',
  error: '#DC2626',
};

const HERO_HEIGHT = 150;
const AVATAR = 92;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: M3.surface },
  flex: { flex: 1 },
  scroll: { paddingBottom: 40 },

  hero: {
    height: HERO_HEIGHT,
    paddingTop: Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight ?? 24) + 12,
    paddingHorizontal: 18,
  },
  cancelBtn: { alignSelf: 'flex-start' },
  cancelText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },

  avatarWrap: { alignItems: 'center', marginTop: -AVATAR / 2 },
  avatarImg: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, borderWidth: 4, borderColor: M3.surface },
  avatarPlaceholder: {
    width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, borderWidth: 4, borderColor: M3.surface,
    backgroundColor: M3.primaryContainer, justifyContent: 'center', alignItems: 'center',
  },
  avatarInitial: { fontSize: 38, fontWeight: '700', color: M3.onPrimaryContainer },

  nameInput: {
    marginTop: 12, fontSize: 22, fontWeight: '800', color: M3.onSurface,
    letterSpacing: -0.3, paddingVertical: 2, paddingHorizontal: 20,
  },
  email: { textAlign: 'center', fontSize: 13, color: M3.onSurfaceVariant, marginTop: 2 },

  card: {
    marginTop: 24, marginHorizontal: 20, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: M3.line, borderRadius: 20, padding: 16, gap: 12,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: M3.onSurface },
  remindLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.9, color: M3.onSurfaceVariant },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8, paddingHorizontal: 13, borderRadius: 999,
    borderWidth: 1, borderColor: M3.outlineVariant, backgroundColor: '#FFFFFF',
  },
  chipSel: { backgroundColor: M3.primary, borderColor: M3.primary },
  chipAdd: { borderStyle: 'dashed', borderColor: '#C9B6F2' },
  chipText: { fontSize: 12.5, fontWeight: '600', color: M3.onSurfaceVariant },
  chipTextSel: { color: '#FFFFFF' },
  chipAddText: { fontSize: 12.5, fontWeight: '700', color: M3.primary },
  remindHint: { fontSize: 12.5, color: M3.onSurfaceVariant, lineHeight: 18 },

  errorText: { fontSize: 13, color: M3.error, textAlign: 'center', marginTop: 16, marginHorizontal: 20 },

  saveBtn: {
    marginTop: 22, marginHorizontal: 20, backgroundColor: M3.ink,
    borderRadius: 14, paddingVertical: 15, alignItems: 'center',
  },
  saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },

  deleteLink: { alignSelf: 'center', marginTop: 16, paddingVertical: 8, minHeight: 36, justifyContent: 'center' },
  deleteText: { fontSize: 13, color: M3.error, fontWeight: '600' },

  // iOS picker bottom sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: M3.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 28 },
  sheetBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: M3.line,
  },
  sheetTitle: { fontSize: 15, fontWeight: '700', color: M3.onSurface },
  sheetCancel: { fontSize: 15, color: M3.onSurfaceVariant },
  sheetDone: { fontSize: 15, color: M3.primary, fontWeight: '700' },
});
