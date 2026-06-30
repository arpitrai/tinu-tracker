const { View } = require('react-native');

// Animated components render as their underlying RN component in tests.
const createAnimatedComponent = (Component) => Component;

const Animated = { View, createAnimatedComponent };

const Easing = {
  out: (fn) => fn,
  cubic: (t) => t,
};

// __esModule so `import Animated from 'react-native-reanimated'` resolves to
// `default` (carrying View + createAnimatedComponent), while the named hooks
// below back `import { useAnimatedProps, ... }`.
module.exports = {
  __esModule: true,
  default: Animated,
  View,
  createAnimatedComponent,
  useAnimatedStyle: () => ({}),
  useAnimatedProps: () => ({}),
  useAnimatedReaction: () => {},
  runOnJS: (fn) => fn,
  useSharedValue: (v) => ({ value: v }),
  withTiming: (v) => v,
  withDelay: (_delay, v) => v,
  withSpring: (v) => v,
  Easing,
};
