const React = require('react');
const { View } = require('react-native');

// CartesianChart uses a render-prop child; call it with stub args so the
// chart series (Line/Area) render to nothing in tests.
const CartesianChart = ({ children }) => {
  const arg = {
    points: { weight: [] },
    chartBounds: { left: 0, right: 0, top: 0, bottom: 0 },
    xScale: () => 0,
    yScale: () => 0,
  };
  return React.createElement(
    View,
    { testID: 'cartesian-chart' },
    typeof children === 'function' ? children(arg) : children,
  );
};

module.exports = {
  CartesianChart,
  Line: () => null,
  Area: () => null,
  useChartPressState: () => ({
    state: {
      isActive: { value: false },
      x: { value: { value: 0 }, position: { value: 0 } },
      y: { weight: { value: { value: 0 }, position: { value: 0 } } },
    },
    isActive: false,
  }),
};
