// expo-apple-authentication is a native module with no JS fallback, so the test
// suite gets a stand-in. Tests drive it via the exported jest.fn()s.
const React = require('react');
const { Pressable, Text } = require('react-native');

const AppleAuthenticationButton = ({ onPress, ...rest }) =>
  React.createElement(
    Pressable,
    { onPress, testID: 'apple-signin-button', ...rest },
    React.createElement(Text, null, 'Continue with Apple'),
  );

module.exports = {
  isAvailableAsync: jest.fn(async () => true),
  signInAsync: jest.fn(async () => ({
    identityToken: 'apple-identity-token',
    fullName: { givenName: null, familyName: null },
    email: null,
  })),
  AppleAuthenticationButton,
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  AppleAuthenticationButtonType: { SIGN_IN: 0, CONTINUE: 1, SIGN_UP: 2 },
  AppleAuthenticationButtonStyle: { WHITE: 0, WHITE_OUTLINE: 1, BLACK: 2 },
};
