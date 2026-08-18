import React from 'react';
import { render, fireEvent, waitFor, screen, cleanup } from '@testing-library/react-native';

// makeRedirectUri reads the expo-constants manifest, which Jest has no access
// to; maybeCompleteAuthSession touches the browser. Neither matters to the
// Apple flow, which never leaves the app.
jest.mock('expo-auth-session', () => ({ makeRedirectUri: () => 'tinutracker://' }));
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(async () => ({ type: 'cancel' })),
}));

const mockSignInWithIdToken = jest.fn(async () => ({ error: null as any }));
const mockUpdateUser = jest.fn(async () => ({ error: null as any }));

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithIdToken: (...args: any[]) => (mockSignInWithIdToken as any)(...args),
      updateUser: (...args: any[]) => (mockUpdateUser as any)(...args),
      signInWithOAuth: jest.fn(async () => ({ data: { url: 'https://example.test' }, error: null })),
      signInWithPassword: jest.fn(async () => ({ error: null })),
    },
  },
}));

import * as AppleAuthentication from 'expo-apple-authentication';
import SignInScreen from '../screens/SignInScreen';

const appleMock = AppleAuthentication as unknown as {
  isAvailableAsync: jest.Mock;
  signInAsync: jest.Mock;
};

async function renderSignIn() {
  await render(<SignInScreen />);
  // The button only mounts after the async availability check resolves.
  return screen.findByTestId('apple-signin-button');
}

beforeEach(() => {
  mockSignInWithIdToken.mockClear();
  mockSignInWithIdToken.mockImplementation(async () => ({ error: null }));
  mockUpdateUser.mockClear();
  appleMock.isAvailableAsync.mockClear();
  appleMock.isAvailableAsync.mockImplementation(async () => true);
  appleMock.signInAsync.mockClear();
  appleMock.signInAsync.mockImplementation(async () => ({
    identityToken: 'apple-identity-token',
    fullName: { givenName: null, familyName: null },
    email: null,
  }));
});

afterEach(() => {
  cleanup();
});

describe('Sign in with Apple', () => {
  it('exchanges the identity token with Supabase', async () => {
    fireEvent.press(await renderSignIn());

    await waitFor(() => expect(mockSignInWithIdToken).toHaveBeenCalled());
    expect(mockSignInWithIdToken.mock.calls[0][0]).toEqual({
      provider: 'apple',
      token: 'apple-identity-token',
    });
  });

  it('requests name and email scopes', async () => {
    fireEvent.press(await renderSignIn());

    await waitFor(() => expect(appleMock.signInAsync).toHaveBeenCalled());
    const scopes = appleMock.signInAsync.mock.calls[0][0].requestedScopes;
    expect(scopes).toContain(AppleAuthentication.AppleAuthenticationScope.FULL_NAME);
    expect(scopes).toContain(AppleAuthentication.AppleAuthenticationScope.EMAIL);
  });

  it('saves the name Apple only ever returns once', async () => {
    appleMock.signInAsync.mockImplementation(async () => ({
      identityToken: 'apple-identity-token',
      fullName: { givenName: 'Arpit', familyName: 'Rai' },
      email: 'a@example.com',
    }));

    fireEvent.press(await renderSignIn());

    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalled());
    expect(mockUpdateUser.mock.calls[0][0]).toEqual({ data: { full_name: 'Arpit Rai' } });
  });

  it('does not write an empty name on later sign-ins', async () => {
    fireEvent.press(await renderSignIn()); // fullName is null in the default mock

    await waitFor(() => expect(mockSignInWithIdToken).toHaveBeenCalled());
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('stays silent when the user backs out of the Apple sheet', async () => {
    appleMock.signInAsync.mockImplementation(async () => {
      const err: any = new Error('The user canceled the authorization attempt.');
      err.code = 'ERR_REQUEST_CANCELED';
      throw err;
    });

    fireEvent.press(await renderSignIn());

    await waitFor(() => expect(appleMock.signInAsync).toHaveBeenCalled());
    expect(screen.queryByText(/canceled|failed/i)).toBeNull();
    expect(mockSignInWithIdToken).not.toHaveBeenCalled();
  });

  it('surfaces a real Apple failure', async () => {
    appleMock.signInAsync.mockImplementation(async () => {
      throw new Error('Apple is unavailable right now.');
    });

    fireEvent.press(await renderSignIn());

    expect(await screen.findByText('Apple is unavailable right now.')).toBeTruthy();
  });

  it('surfaces a Supabase rejection of the token', async () => {
    mockSignInWithIdToken.mockImplementation(async () => ({
      error: { message: 'Provider is not enabled' },
    }));

    fireEvent.press(await renderSignIn());

    expect(await screen.findByText('Provider is not enabled')).toBeTruthy();
  });

  it('hides the button where Apple sign-in is unsupported', async () => {
    appleMock.isAvailableAsync.mockImplementation(async () => false);

    await render(<SignInScreen />);

    // Google is still offered; only the Apple option is absent.
    expect(await screen.findByText('Continue with Google')).toBeTruthy();
    expect(screen.queryByTestId('apple-signin-button')).toBeNull();
  });
});
