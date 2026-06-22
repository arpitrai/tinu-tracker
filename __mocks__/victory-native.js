const React = require('react');
const { View } = require('react-native');
module.exports = {
  CartesianChart: ({ children }) => React.createElement(View, { testID: 'cartesian-chart' }, children),
  Line: () => null,
  useChartPressState: () => ({ state: { isActive: { value: false }, x: { value: { value: 0 }, position: { value: 0 } }, y: { weight: { position: { value: 0 } } } }, isActive: false }),
};
