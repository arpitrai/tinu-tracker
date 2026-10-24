import { AuthRetryableFetchError, AuthApiError } from '@supabase/supabase-js';

const mockGetSession = jest.fn();
let mockStored: string | null = null;

jest.mock('../lib/supabase', () => ({
  supabase: { auth: { storageKey: 'sb-test-auth-token', getSession: () => mockGetSession() } },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => mockStored) },
}));

import { launchSession } from '../lib/session';

const stored = { access_token: 'x', refresh_token: 'r', expires_at: 1, user: { id: 'u1' } };

beforeEach(() => {
  mockGetSession.mockReset();
  mockStored = null;
});

describe('launchSession', () => {
  it('uses the live session when there is one', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'live' } } }, error: null });
    expect((await launchSession())?.user.id).toBe('live');
  });

  it('keeps the stored session when renewal fails for lack of a connection', async () => {
    mockStored = JSON.stringify(stored);
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: new AuthRetryableFetchError('fetch failed', 0),
    });
    expect((await launchSession())?.user.id).toBe('u1');
  });

  it('signs out when the server rejects the session', async () => {
    mockStored = JSON.stringify(stored);
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: new AuthApiError('Invalid Refresh Token', 400, 'refresh_token_not_found'),
    });
    expect(await launchSession()).toBeNull();
  });

  it('does not keep the user on the loading screen while renewal retries', async () => {
    mockStored = JSON.stringify(stored);
    mockGetSession.mockReturnValue(new Promise(() => {})); // retrying, never settles here
    expect((await launchSession(20))?.user.id).toBe('u1');
  });

  it('is signed out when nothing is stored', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    expect(await launchSession()).toBeNull();
  });
});
