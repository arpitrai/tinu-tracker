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
  SafeAreaView,
  ScrollView,
  Image,
  StatusBar,
  Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface Props {
  visible: boolean;
  onClose: () => void;
  user: User;
  avatarUrl?: string | null;
  onNameSaved?: (name: string) => void;
}

export default function ProfileModal({ visible, onClose, user, avatarUrl, onNameSaved }: Props) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(user.user_metadata?.full_name ?? '');
      setError(null);
      setImgError(false);
    }
  }, [visible, user]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const trimmedName = name.trim();
    try {
      const { error: nameErr } = await supabase.auth.updateUser({
        data: { full_name: trimmedName },
      });
      if (nameErr) throw nameErr;
      onNameSaved?.(trimmedName);
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
      // Server-side RPC (SECURITY DEFINER) — removes the user's entries and their
      // auth.users record. The client can't delete an auth user directly.
      const { error: delErr } = await supabase.rpc('delete_user_account');
      if (delErr) throw delErr;
      // signOut clears the now-orphaned session; App.tsx then swaps to SignInScreen.
      await supabase.auth.signOut();
      // No further state updates: this screen unmounts once the session clears.
    } catch (e: any) {
      setError(e.message ?? 'Could not delete your account. Please try again.');
      setDeleting(false);
    }
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account and all of your logged data. ' +
        'This cannot be undone and your data is not recoverable.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: handleDeleteAccount },
      ],
    );
  };

  const busy = saving || deleting;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn} disabled={busy}>
              <Text style={[styles.cancelText, busy && styles.btnDisabled]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Profile</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.avatarSection}>
              {avatarUrl && !imgError ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.avatarImg}
                  onError={() => setImgError(true)}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>
                    {(user.user_metadata?.full_name ?? user.email ?? '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                style={styles.fieldInput}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={M3.outline}
                autoCapitalize="words"
                returnKeyType="done"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email</Text>
              <View style={styles.fieldReadOnly}>
                <Text style={styles.fieldReadOnlyText}>{user.email}</Text>
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryBtn, busy && styles.btnDisabled]}
              onPress={handleSave}
              disabled={busy}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Save</Text>
              )}
            </TouchableOpacity>

            {/* Danger zone — irreversible account deletion.
                Temporarily disabled until the delete flow is verified end-to-end.
                The handlers (confirmDeleteAccount / handleDeleteAccount) and the
                delete_user_account RPC are still in place — re-enable by uncommenting.
            <View style={styles.dangerZone}>
              <TouchableOpacity
                style={[styles.deleteBtn, busy && styles.btnDisabled]}
                onPress={confirmDeleteAccount}
                disabled={busy}
                activeOpacity={0.85}
              >
                {deleting ? (
                  <ActivityIndicator color={M3.error} />
                ) : (
                  <Text style={styles.deleteBtnText}>Delete account</Text>
                )}
              </TouchableOpacity>
              <Text style={styles.deleteHint}>
                Permanently deletes your account and all logged data. This cannot be undone.
              </Text>
            </View>
            */}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const M3 = {
  primary: '#7C3AED',
  onPrimary: '#FFFFFF',
  primaryContainer: '#ECE0FF',
  onPrimaryContainer: '#2A0A5E',
  surface: '#FEFBFF',
  onSurface: '#1B1B1F',
  surfaceVariant: '#E1E2EC',
  onSurfaceVariant: '#44474F',
  outline: '#74777F',
  outlineVariant: '#C4C6D0',
  error: '#B3261E',
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: M3.surface,
    // Android Modal/SafeAreaView don't inset the status bar — pad it manually so
    // the header lines up with the data-entry screen (see TrackerScreen.safeArea).
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: M3.outlineVariant,
    backgroundColor: M3.surface,
  },
  cancelBtn: { paddingVertical: 4 },
  cancelText: { fontSize: 14, color: M3.primary, fontWeight: '500' },
  title: { fontSize: 16, fontWeight: '500', color: M3.onSurface },
  headerSpacer: { width: 60 },

  content: {
    padding: 24,
    gap: 20,
  },

  avatarSection: { alignItems: 'center', paddingVertical: 8 },
  avatarImg: { width: 80, height: 80, borderRadius: 40 },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: M3.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { fontSize: 32, fontWeight: '400', color: M3.onPrimaryContainer },

  fieldGroup: { gap: 8 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: M3.onSurfaceVariant,
    letterSpacing: 0.5,
  },
  fieldInput: {
    backgroundColor: M3.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: M3.outline,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: M3.onSurface,
  },
  fieldHint: { fontSize: 12, color: M3.onSurfaceVariant },
  fieldReadOnly: {
    backgroundColor: M3.surfaceVariant,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: M3.outlineVariant,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  fieldReadOnlyText: { fontSize: 16, color: M3.onSurfaceVariant },

  primaryBtn: {
    backgroundColor: M3.primary,
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.38 },
  primaryBtnText: { color: M3.onPrimary, fontSize: 14, fontWeight: '500', letterSpacing: 0.1 },

  errorText: { fontSize: 13, color: M3.error, textAlign: 'center' },

  dangerZone: {
    marginTop: 16,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: M3.outlineVariant,
    gap: 8,
  },
  deleteBtn: {
    borderRadius: 100,
    borderWidth: 1,
    borderColor: M3.error,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: M3.surface,
  },
  deleteBtnText: { color: M3.error, fontSize: 14, fontWeight: '500', letterSpacing: 0.1 },
  deleteHint: { fontSize: 12, color: M3.onSurfaceVariant, textAlign: 'center', lineHeight: 18 },

  otpHeading: {
    fontSize: 28,
    fontWeight: '400',
    color: M3.onSurface,
  },
  otpSub: { fontSize: 15, color: M3.onSurfaceVariant, lineHeight: 24 },
  otpEmailBold: { fontWeight: '700', color: M3.onSurface },
  otpInput: {
    backgroundColor: M3.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: M3.outline,
    fontSize: 38,
    fontWeight: '700',
    color: M3.onSurface,
    letterSpacing: 10,
    paddingVertical: 22,
    textAlign: 'center',
    marginTop: 8,
  },

  backBtn: { alignItems: 'center', paddingVertical: 10 },
  backBtnText: { fontSize: 14, color: M3.onSurfaceVariant },
});
