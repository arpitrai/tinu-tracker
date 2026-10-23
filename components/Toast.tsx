import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastState {
  /** Bumped on every show so re-raising the same message re-triggers the animation. */
  id: number;
  kind: ToastKind;
  message: string;
  /** Optional button on the toast, e.g. Retry after a failed save. */
  action?: { label: string; onPress: () => void };
  /** Stays until tapped or replaced instead of fading. */
  sticky?: boolean;
}

// 'info' is for explanations (why a control can't be used yet), which are
// neither a success nor a failure.
const C: Record<ToastKind, { bg: string; fg: string; icon: string }> = {
  success: { bg: '#065F46', fg: '#ECFDF5', icon: '✓' },
  error: { bg: '#991B1B', fg: '#FEF2F2', icon: '!' },
  info: { bg: '#2E2A26', fg: '#F7F3EE', icon: 'i' },
};

// Toasts fade on their own. Sticky ones (a save or reset that failed to reach
// the server) stay until tapped or replaced: a failure that vanished while the
// user was looking away was indistinguishable from success. Hints like "log
// something first" are not sticky; left up, they cover the history below.
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
  const { width } = useWindowDimensions();

  // Keep the latest callback without making it an effect dependency, so a new
  // parent render doesn't restart the dismiss timer mid-toast.
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const toastId = toast?.id;
  const persistent = !!toast?.sticky;
  const idRef = useRef(toastId);
  idRef.current = toastId;

  // A newer toast may have replaced this one mid-fade; only dismiss our own.
  const fadeOut = () => {
    const id = idRef.current;
    Animated.timing(anim, {
      toValue: 0,
      duration: FADE_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: USE_NATIVE,
    }).start(() => {
      if (idRef.current === id) onDismissRef.current();
    });
  };

  useEffect(() => {
    if (toastId == null) return;

    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: FADE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE,
    }).start();

    if (persistent) return;

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
  }, [toastId, persistent, anim]);

  if (!toast) return null;

  const pal = C[toast.kind];

  return (
    <Animated.View
      // Only the toast itself takes touches; the empty strip either side of it
      // must not swallow taps meant for the screen underneath.
      pointerEvents="box-none"
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
      <Pressable
        onPress={fadeOut}
        // Capped to the screen as well as 420: centred content is sized to fit, so a
        // long error would otherwise run past the side margins.
        style={[styles.toast, { backgroundColor: pal.bg, maxWidth: Math.min(420, width - 32) }]}
      >
        <Text style={[styles.icon, { color: pal.fg }]}>
          {pal.icon}
        </Text>
        <Text
          testID="toast-message"
          style={[styles.msg, { color: pal.fg }]}
          numberOfLines={3}
        >
          {toast.message}
        </Text>
        {toast.action && (
          <Pressable
            testID="toast-action"
            onPress={() => { const run = toast.action!.onPress; fadeOut(); run(); }}
            hitSlop={8}
          >
            <Text style={[styles.action, { color: pal.fg }]}>
              {toast.action.label}
            </Text>
          </Pressable>
        )}
        {persistent && !toast.action && (
          <Text style={[styles.icon, { color: pal.fg }]}>✕</Text>
        )}
      </Pressable>
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
  action: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
    textDecorationLine: 'underline',
  },
});
