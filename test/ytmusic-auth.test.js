import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  ytmusicAuth,
  STORAGE_CLIENT_ID,
  STORAGE_REDIRECT_URI,
  STORAGE_ACCESS_TOKEN,
  STORAGE_REFRESH_TOKEN,
  STORAGE_EXPIRES_AT,
  STORAGE_AUTH_STATE,
  STORAGE_CODE_VERIFIER,
  DEFAULT_REDIRECT_URI,
} from '../js/providers/ytmusic/ytmusic-auth.js';
import { ytMusicProvider } from '../js/providers/ytmusic/ytmusic-provider.js';
import { Storage } from '../js/utils/storage.js';

describe('YouTube Music (Google OAuth 2.0 PKCE) Authentication', () => {
  beforeEach(() => {
    Storage.clear();
  });

  test('defaults to standard callback URI and allows Client ID and Secret configuration', () => {
    assert.equal(ytmusicAuth.getRedirectUri(), DEFAULT_REDIRECT_URI);
    assert.equal(ytmusicAuth.getClientId(), '');
    assert.equal(ytmusicAuth.getClientSecret(), '');

    ytmusicAuth.setClientId('test-google-client-id-123.apps.googleusercontent.com');
    assert.equal(ytmusicAuth.getClientId(), 'test-google-client-id-123.apps.googleusercontent.com');

    ytmusicAuth.setClientSecret('GOCSPX-mock_secret_12345');
    assert.equal(ytmusicAuth.getClientSecret(), 'GOCSPX-mock_secret_12345');

    ytmusicAuth.setRedirectUri('http://127.0.0.1:8888/custom-callback');
    assert.equal(ytmusicAuth.getRedirectUri(), 'http://127.0.0.1:8888/custom-callback');

    ytmusicAuth.setRedirectUri('');
    assert.equal(ytmusicAuth.getRedirectUri(), DEFAULT_REDIRECT_URI);
  });

  test('buildAuthUrl generates valid Google OAuth 2.0 PKCE authorization URL', () => {
    const urlString = ytmusicAuth.buildAuthUrl({
      clientId: 'google-client-123',
      redirectUri: 'http://127.0.0.1:8888/callback',
      codeChallenge: 'challenge-abc-123',
      state: 'ytmusic:random-nonce-999',
    });

    const parsed = new URL(urlString);
    assert.equal(parsed.origin, 'https://accounts.google.com');
    assert.equal(parsed.pathname, '/o/oauth2/v2/auth');
    assert.equal(parsed.searchParams.get('client_id'), 'google-client-123');
    assert.equal(parsed.searchParams.get('redirect_uri'), 'http://127.0.0.1:8888/callback');
    assert.equal(parsed.searchParams.get('response_type'), 'code');
    assert.equal(parsed.searchParams.get('code_challenge'), 'challenge-abc-123');
    assert.equal(parsed.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(parsed.searchParams.get('state'), 'ytmusic:random-nonce-999');
    assert.equal(parsed.searchParams.get('access_type'), 'offline');
    assert.ok(parsed.searchParams.get('scope').includes('https://www.googleapis.com/auth/youtube'));
    assert.ok(parsed.searchParams.get('scope').includes('https://www.googleapis.com/auth/userinfo.profile'));
  });

  test('evaluates isAuthenticated correctly across token and refresh token states', () => {
    assert.equal(ytmusicAuth.isAuthenticated(), false);

    // Active unexpired token
    Storage.set(STORAGE_ACCESS_TOKEN, 'active-access-token');
    Storage.set(STORAGE_EXPIRES_AT, Date.now() + 3600 * 1000);
    assert.equal(ytmusicAuth.isAuthenticated(), true);

    // Expired token but valid refresh token
    Storage.set(STORAGE_EXPIRES_AT, Date.now() - 1000);
    Storage.set(STORAGE_REFRESH_TOKEN, 'valid-refresh-token');
    assert.equal(ytmusicAuth.isAuthenticated(), true);

    // Expired token and no refresh token
    Storage.remove(STORAGE_REFRESH_TOKEN);
    assert.equal(ytmusicAuth.isAuthenticated(), false);
  });

  test('handleCallback rejects state mismatch (CSRF prevention)', async () => {
    Storage.set(STORAGE_AUTH_STATE, 'ytmusic:expected-state');
    Storage.set(STORAGE_CODE_VERIFIER, 'test-verifier');

    const result = await ytmusicAuth.handleCallback('http://127.0.0.1:8888/callback?code=mock_code&state=ytmusic:wrong-state');
    assert.equal(result, false);
  });

  test('handleCallback processes token exchange and stores credentials', async () => {
    Storage.set(STORAGE_AUTH_STATE, 'ytmusic:valid-state');
    Storage.set(STORAGE_CODE_VERIFIER, 'test-verifier-xyz');
    Storage.set(STORAGE_CLIENT_ID, 'test-client-id');
    Storage.set('sso_ytmusic_client_secret', 'test-client-secret-gocspx');

    let capturedTokenBody = null;
    // Mock global fetch for token exchange and userinfo
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      const urlStr = String(url);
      if (urlStr.includes('oauth2.googleapis.com/token')) {
        capturedTokenBody = options.body.toString();
        return {
          ok: true,
          json: async () => ({
            access_token: 'mock-google-access-token',
            refresh_token: 'mock-google-refresh-token',
            expires_in: 3600,
            scope: 'https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/userinfo.profile',
          }),
        };
      }
      if (urlStr.includes('googleapis.com/oauth2/v2/userinfo')) {
        return {
          ok: true,
          json: async () => ({
            id: 'google-user-456',
            name: 'Jane Doe',
            email: 'jane@example.com',
            picture: 'https://example.com/avatar.jpg',
          }),
        };
      }
      return originalFetch(url, options);
    };

    try {
      let notified = false;
      const unsubscribe = ytmusicAuth.subscribe((authed) => {
        if (authed) notified = true;
      });

      const success = await ytmusicAuth.handleCallback(
        'http://127.0.0.1:8888/callback?code=valid-auth-code&state=ytmusic:valid-state'
      );

      assert.equal(success, true);
      assert.equal(ytmusicAuth.isAuthenticated(), true);
      assert.ok(capturedTokenBody.includes('client_secret=test-client-secret-gocspx'));
      assert.equal(Storage.get(STORAGE_ACCESS_TOKEN), 'mock-google-access-token');
      assert.equal(Storage.get(STORAGE_REFRESH_TOKEN), 'mock-google-refresh-token');
      assert.equal(notified, true);

      unsubscribe();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('getUserProfile returns parsed UserProfile model for YouTube Music', async () => {
    Storage.set(STORAGE_ACCESS_TOKEN, 'mock-token');
    Storage.set(STORAGE_EXPIRES_AT, Date.now() + 3600 * 1000);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      if (String(url).includes('googleapis.com/oauth2/v2/userinfo')) {
        return {
          ok: true,
          json: async () => ({
            id: 'yt-channel-789',
            name: 'Alex Producer',
            email: 'alex@example.com',
            picture: 'https://example.com/alex.jpg',
          }),
        };
      }
      return originalFetch(url);
    };

    try {
      const profile = await ytmusicAuth.getUserProfile();
      assert.equal(profile.id, 'yt-channel-789');
      assert.equal(profile.displayName, 'Alex Producer');
      assert.equal(profile.email, 'alex@example.com');
      assert.equal(profile.imageUrl, 'https://example.com/alex.jpg');
      assert.equal(profile.platform, 'ytmusic');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('ytMusicProvider integrates cleanly with ytmusicAuth and interface contract', async () => {
    assert.equal(ytMusicProvider.id, 'ytmusic');
    assert.equal(ytMusicProvider.name, 'YouTube Music');
    assert.equal(ytMusicProvider.auth, ytmusicAuth);

    Storage.clear();
    assert.equal(await ytMusicProvider.isAuthenticated(), false);

    Storage.set(STORAGE_ACCESS_TOKEN, 'test-yt-token');
    Storage.set(STORAGE_EXPIRES_AT, Date.now() + 3600 * 1000);
    assert.equal(await ytMusicProvider.isAuthenticated(), true);

    await ytMusicProvider.logout();
    assert.equal(await ytMusicProvider.isAuthenticated(), false);

    assert.equal(typeof ytMusicProvider.createPlaylist, 'function');
    assert.equal(typeof ytMusicProvider.replacePlaylistTracks, 'function');
  });
});
