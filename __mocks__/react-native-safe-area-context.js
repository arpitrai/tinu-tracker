// The real provider measures native insets, which don't exist under Jest, so
// screens get zero insets and a pass-through provider.
const React = require('react');
const { View } = require('react-native');

const insets = { top: 0, right: 0, bottom: 0, left: 0 };
const frame = { x: 0, y: 0, width: 320, height: 640 };

module.exports = {
  SafeAreaProvider: ({ children }) => children,
  SafeAreaView: (props) => React.createElement(View, props),
  useSafeAreaInsets: () => insets,
  useSafeAreaFrame: () => frame,
  initialWindowMetrics: { insets, frame },
};
