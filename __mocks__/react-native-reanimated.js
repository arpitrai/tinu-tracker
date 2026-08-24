const { View } = require('react-native');

// Animated components render as their underlying RN component in tests.
const createAnimatedComponent = (Component) => Component;

const Animated = { View, createAnimatedComponent };

const Easing = {
  out: (fn) => fn,
  inOut: (fn) => fn,
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
  // react-native-gesture-handler's GestureDetector reaches for these through
  // its reanimated wrapper. Stubs are enough: gestures never fire under the
  // test renderer, but the component has to mount for the screen to render.
  useEvent: () => ({}),
  useHandler: () => ({ context: {}, doDependenciesDiffer: false }),
  withTiming: (v) => v,
  withDelay: (_delay, v) => v,
  withRepeat: (v) => v,
  withSequence: (...values) => values[values.length - 1],
  withSpring: (v) => v,
  Easing,
};
