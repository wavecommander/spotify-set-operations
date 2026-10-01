/**
 * Spotify OAuth 2.0 PKCE Authentication
 * Pure client-side implementation using standard Web Crypto API.
 */

import { generatePKCE, generateRandomString } from '../../utils/pkce.js';
import { Storage } from '../../utils/storage.js';

const STORAGE_CLIENT_ID = 'sso_spotify_client_id';
const STORAGE_REDIRECT_URI = 'sso_spotify_redirect_uri';
const STORAGE_ACCESS_TOKEN = 'sso_spotify_access_token';
const STORAGE_REFRESH_TOKEN = 'sso_spotify_refresh_token';
const STORAGE_EXPIRES_AT = 'sso_spotify_expires_at';
const STORAGE_CODE_VERIFIER = 'sso_spotify_code_verifier';
const STORAGE_AUTH_STATE = 'sso_spotify_auth_state';
const STORAGE_SCOPE_VERSION = 'sso_spotify_scope_version';
const CURRENT_SCOPE_VERSION = 'v3_percent20_scopes';

// Pre-configured default Client ID and Callback URI from project settings
export const DEFAULT_CLIENT_ID = '88962541e5e34523861008cd3c75a285';
export const DEFAULT_REDIRECT_URI = 'http://127.0.0.1:8888/callback';

const DEFAULT_SCOPES = [
  'user-read-private',
  'user-read-email',
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-library-read',
  'user-library-modify',
].join(' ');

export class SpotifyAuth {
  constructor() {
    this._listeners = new Set();
  }

  /**
   * Retrieves current Spotify Client ID.
   * @returns {string}
   */
  getClientId() {
    return Storage.get(STORAGE_CLIENT_ID) || DEFAULT_CLIENT_ID;
  }

  /**
   * Saves a custom Spotify Client ID.
   * @param {string} clientId
   */
  setClientId(clientId) {
    if (clientId && clientId.trim()) {
      Storage.set(STORAGE_CLIENT_ID, clientId.trim());
    } else {
      Storage.remove(STORAGE_CLIENT_ID);
    }
    this.notify();
  }

  /**
   * Gets redirect URI. Defaults to http://127.0.0.1:8888/callback as registered with Spotify.
   * @returns {string}
   */
  getRedirectUri() {
    const custom = Storage.get(STORAGE_REDIRECT_URI);
    if (custom && custom.trim()) {
      return custom.trim();
    }
    return DEFAULT_REDIRECT_URI;
  }

  /**
   * Sets custom redirect URI.
   * @param {string} uri
   */
  setRedirectUri(uri) {
    if (uri && uri.trim()) {
      Storage.set(STORAGE_REDIRECT_URI, uri.trim());
    } else {
      Storage.remove(STORAGE_REDIRECT_URI);
    }
  }

  /**
   * Checks if valid access token exists or if refresh token can renew it.
   * @returns {boolean}
   */
  isAuthenticated() {
    const scopeVer = Storage.get(STORAGE_SCOPE_VERSION);
    if (scopeVer !== CURRENT_SCOPE_VERSION) {
      return false;
    }
    const token = Storage.get(STORAGE_ACCESS_TOKEN);
    const refreshToken = Storage.get(STORAGE_REFRESH_TOKEN);
    const expiresAt = Storage.get(STORAGE_EXPIRES_AT) || 0;
    const now = Date.now();

    if (token && now < expiresAt) {
      return true;
    }
    return Boolean(refreshToken);
  }

  /**
   * Alias for startLogin()
   */
  async login() {
    return this.startLogin();
  }

  /**
   * Starts PKCE authorization flow by redirecting the browser to Spotify.
   */
  async startLogin() {
    if (typeof window === 'undefined') return;

    const clientId = this.getClientId();
    if (!clientId) {
      throw new Error('Spotify Client ID is required to login');
    }

    const { codeVerifier, codeChallenge } = await generatePKCE();
    const state = generateRandomString(16);
    const redirectUri = this.getRedirectUri();

    Storage.set(STORAGE_CODE_VERIFIER, codeVerifier);
    Storage.set(STORAGE_AUTH_STATE, state);
    Storage.set('sso_spotify_used_redirect_uri', redirectUri);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      redirect_uri: redirectUri,
      state: state,
      show_dialog: 'true',
    });

    // Spotify OAuth strictly expects '%20' space-delimited scopes, not '+'
    const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}&scope=${encodeURIComponent(DEFAULT_SCOPES)}`;
    window.location.href = authUrl;
  }

  /**
   * Checks current URL for authorization callback code and exchanges for tokens.
   * Cleans URL query parameters on success.
   * @returns {Promise<boolean>} True if callback was processed
   */
  async handleCallback() {
    if (typeof window === 'undefined') return false;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      console.error('Spotify OAuth error callback:', error);
      this.clearUrlParams();
      return false;
    }

    if (!code) {
      return false;
    }

    const savedState = Storage.get(STORAGE_AUTH_STATE);
    const codeVerifier = Storage.get(STORAGE_CODE_VERIFIER);

    if (!state || state !== savedState) {
      console.warn('Spotify OAuth state mismatch. Possible CSRF.');
      this.clearUrlParams();
      return false;
    }

    const clientId = this.getClientId();
    const redirectUri = Storage.get('sso_spotify_used_redirect_uri') || this.getRedirectUri();

    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error_description || 'Failed to exchange authorization code');
      }

      const data = await response.json();
      console.log('[SpotifyAuth] Code exchange successful. Granted scopes:', data.scope);
      this.saveTokens(data);
      this.clearUrlParams();
      this.notify();
      return true;
    } catch (err) {
      console.error('Error exchanging Spotify authorization code:', err);
      this.clearUrlParams();
      throw err;
    }
  }

  /**
   * Returns a valid access token, automatically refreshing if expired.
   * @returns {Promise<string|null>}
   */
  async getAccessToken() {
    const token = Storage.get(STORAGE_ACCESS_TOKEN);
    const expiresAt = Storage.get(STORAGE_EXPIRES_AT) || 0;
    const now = Date.now();

    // If token valid and has at least 60s remaining
    if (token && now < expiresAt - 60000) {
      return token;
    }

    const refreshToken = Storage.get(STORAGE_REFRESH_TOKEN);
    if (!refreshToken) {
      return null;
    }

    // Refresh token
    const clientId = this.getClientId();
    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        this.logout();
        return null;
      }

      const data = await response.json();
      this.saveTokens(data);
      return data.access_token;
    } catch (err) {
      console.error('Error refreshing Spotify access token:', err);
      return null;
    }
  }

  saveTokens(data) {
    Storage.set(STORAGE_ACCESS_TOKEN, data.access_token);
    if (data.refresh_token) {
      Storage.set(STORAGE_REFRESH_TOKEN, data.refresh_token);
    }
    const expiresInMs = (data.expires_in || 3600) * 1000;
    Storage.set(STORAGE_EXPIRES_AT, Date.now() + expiresInMs);
    Storage.set(STORAGE_SCOPE_VERSION, CURRENT_SCOPE_VERSION);
    if (data.scope) {
      Storage.set('sso_spotify_granted_scopes', data.scope);
    }
    Storage.remove(STORAGE_CODE_VERIFIER);
    Storage.remove(STORAGE_AUTH_STATE);
  }

  logout() {
    Storage.remove(STORAGE_ACCESS_TOKEN);
    Storage.remove(STORAGE_REFRESH_TOKEN);
    Storage.remove(STORAGE_EXPIRES_AT);
    Storage.remove(STORAGE_SCOPE_VERSION);
    Storage.remove('sso_spotify_granted_scopes');
    this.notify();
  }

  clearUrlParams() {
    if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }

  subscribe(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  notify() {
    for (const listener of this._listeners) {
      try {
        listener(this.isAuthenticated());
      } catch (e) {
        console.error(e);
      }
    }
  }
}

export const spotifyAuth = new SpotifyAuth();
