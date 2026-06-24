import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
} from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  onProfile: () => void;
  onSignOut: () => void;
}

export default function ProfileMenu({ visible, onClose, onProfile, onSignOut }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.card}>
              <MenuItem
                label="Profile"
                onPress={() => { onClose(); onProfile(); }}
              />
              <View style={styles.divider} />
              <MenuItem
                label="Log Out"
                color="#B3261E"
                onPress={() => { onClose(); onSignOut(); }}
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function MenuItem({
  label,
  onPress,
  color,
}: {
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.65}>
      <Text style={[styles.itemText, color ? { color } : null]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
    alignItems: 'flex-end',
    paddingTop: 108,
    paddingRight: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
    minWidth: 168,
    borderWidth: 1,
    borderColor: '#F0EEE8',
  },
  item: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  itemText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1C1915',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0EEE8',
  },
});
