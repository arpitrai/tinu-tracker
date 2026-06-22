const React = require('react');
const { View } = require('react-native');

const Animated = { View };

module.exports = {
  default: Animated,
  useAnimatedStyle: () => ({}),
  useAnimatedReaction: () => {},
  runOnJS: (fn) => fn,
  useSharedValue: (v) => ({ value: v }),
  withTiming: (v) => v,
  withSpring: (v) => v,
};
