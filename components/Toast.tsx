import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';

export type ToastKind = 'success' | 'error';

export interface ToastState {
  /** Bumped on every show so re-raising the same message re-triggers the animation. */
  id: number;
  kind: ToastKind;
  message: string;
}

const C = {
  successBg: '#065F46',
  successFg: '#ECFDF5',
  errorBg: '#991B1B',
  errorFg: '#FEF2F2',
};

const VISIBLE_MS = 2600;
const FADE_MS = 180;

// react-native-web has no native animation driver; asking for one only warns.
const USE_NATIVE = Platform.OS !== 'web';

interface Props {
  toast: ToastState | null;
  onDismiss: () => void;
}

/**
 * A transient status banner. Rendered absolutely so it floats over the content
 * and never contributes height — showing one must not shift the layout.
 */
export default function Toast({ toast, onDismiss }: Props) {
  const anim = useRef(new Animated.Value(0)).current;

  // Keep the latest callback without making it an effect dependency, so a new
  // parent render doesn't restart the dismiss timer mid-toast.
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const toastId = toast?.id;

  useEffect(() => {
    if (toastId == null) return;

    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: FADE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE,
    }).start();

    let cancelled = false;
    const timer = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 0,
        duration: FADE_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: USE_NATIVE,
      }).start(() => {
        if (!cancelled) onDismissRef.current();
      });
    }, VISIBLE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [toastId, anim]);

  if (!toast) return null;

  const isError = toast.kind === 'error';

  return (
    <Animated.View
      pointerEvents="none"
      testID="toast"
      style={[
        styles.wrap,
        {
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
          ],
        },
      ]}
    >
      <View style={[styles.toast, { backgroundColor: isError ? C.errorBg : C.successBg }]}>
        <Text style={[styles.icon, { color: isError ? C.errorFg : C.successFg }]}>
          {isError ? '!' : '✓'}
        </Text>
        <Text
          testID="toast-message"
          style={[styles.msg, { color: isError ? C.errorFg : C.successFg }]}
          numberOfLines={3}
        >
          {toast.message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    // The bottom nav is ~72pt tall before the home indicator, so 96 left the
    // toast hugging it and reading as part of the bar. This floats it clear.
    bottom: 148,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 420,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  icon: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 19, // pinned so the glyph can't grow the row
  },
  msg: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
});
