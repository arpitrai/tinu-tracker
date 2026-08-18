import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

interface Props {
  visible: boolean;
  /** Pretty label of the day being left, e.g. "Thu, 25 Jun". */
  dateLabel: string;
  /** False when the editor is open but nothing has actually been changed yet. */
  hasChanges: boolean;
  /** False when the day has nothing logged — an empty day cannot be saved. */
  canSave: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

/**
 * Asked before the user leaves a day with unsaved entries, or with the editor
 * still open (date arrows, calendar, history row, Trend tab, log out).
 *
 * A custom modal rather than Alert.alert: Alert is a no-op on react-native-web,
 * and three buttons stack awkwardly in the Android system dialog.
 */
function UnsavedChangesModal({
  visible,
  dateLabel,
  hasChanges,
  canSave,
  saving,
  onSave,
  onDiscard,
  onCancel,
}: Props) {
  const message = !hasChanges
    ? `You are still editing ${dateLabel}. Leaving now closes the editor without saving.`
    : canSave
      ? `You have unsaved changes for ${dateLabel}. Leaving now discards them.`
      : `Your changes to ${dateLabel} leave the day empty, so there is nothing to save. Leaving now discards them.`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={saving ? undefined : onCancel}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{hasChanges ? 'Save your entries?' : 'Finish editing?'}</Text>
          <Text style={styles.message}>{message}</Text>

          {canSave && (
            <Pressable
              testID="unsaved-save"
              style={({ pressed }) => [
                styles.saveBtn,
                pressed && styles.pressed,
                saving && styles.disabled,
              ]}
              onPress={onSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </Pressable>
          )}

          <Pressable
            testID="unsaved-discard"
            style={({ pressed }) => [
              styles.discardBtn,
              pressed && styles.pressed,
              saving && styles.disabled,
            ]}
            onPress={onDiscard}
            disabled={saving}
          >
            <Text style={styles.discardText}>
              {hasChanges ? 'Discard changes' : 'Close without saving'}
            </Text>
          </Pressable>

          <Pressable
            testID="unsaved-cancel"
            style={styles.cancelBtn}
            onPress={onCancel}
            disabled={saving}
            hitSlop={8}
          >
            <Text style={styles.cancelText}>Keep editing</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default React.memo(UnsavedChangesModal);

const PRIMARY = '#7C3AED';
const TEXT = '#1C1915';
const MUTED = '#9A9082';

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  title: { fontSize: 18, fontWeight: '800', color: TEXT, letterSpacing: -0.3 },
  message: {
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: '500',
    color: MUTED,
    marginTop: 8,
    marginBottom: 18,
  },
  saveBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { color: '#fff', fontSize: 15.5, fontWeight: '700', letterSpacing: 0.1 },
  discardBtn: {
    borderWidth: 1.5,
    borderColor: '#F0DCDC',
    borderRadius: 16,
    height: 50,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardText: { color: '#B3261E', fontSize: 15, fontWeight: '700' },
  cancelBtn: { height: 40, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  cancelText: { color: MUTED, fontSize: 13.5, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
});
