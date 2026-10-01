/**
 * YouTube Music (Google OAuth 2.0 PKCE) Authentication
 * Pure client-side implementation using standard Web Crypto API.
 */

import { generatePKCE, generateRandomString } from '../../utils/pkce.js';
import { Storage } from '../../utils/storage.js';
import { UserProfile, MusicPlatform } from '../../core/models.js';

export const STORAGE_CLIENT_ID = 'sso_ytmusic_client_id';
export const STORAGE_CLIENT_SECRET = 'sso_ytmusic_client_secret';
export const STORAGE_REDIRECT_URI = 'sso_ytmusic_redirect_uri';
export const STORAGE_ACCESS_TOKEN = 'sso_ytmusic_access_token';
export const STORAGE_REFRESH_TOKEN = 'sso_ytmusic_refresh_token';
export const STORAGE_EXPIRES_AT = 'sso_ytmusic_expires_at';
export const STORAGE_CODE_VERIFIER = 'sso_ytmusic_code_verifier';
export const STORAGE_AUTH_STATE = 'sso_ytmusic_auth_state';
export const STORAGE_GRANTED_SCOPES = 'sso_ytmusic_granted_scopes';
export const STORAGE_USER_PROFILE = 'sso_ytmusic_user_profile';

export const DEFAULT_REDIRECT_URI = 'http://127.0.0.1:8888/callback';

export const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid',
  'email',
].join(' ');

export class YTMusicAuth {
  constructor() {
    /** @type {Set<Function>} */
    this._listeners = new Set();
  }

  /**
   * Retrieves configured Google OAuth Client ID.
   * @returns {string}
   */
  getClientId() {
    return Storage.get(STORAGE_CLIENT_ID) || '';
  }

  /**
   * Saves custom Google OAuth Client ID.
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
   * Retrieves configured Google OAuth Client Secret.
   * @returns {string}
   */
  getClientSecret() {
    return Storage.get(STORAGE_CLIENT_SECRET) || '';
  }

  /**
   * Saves custom Google OAuth Client Secret.
   * @param {string} clientSecret
   */
  setClientSecret(clientSecret) {
    if (clientSecret && clientSecret.trim()) {
      Storage.set(STORAGE_CLIENT_SECRET, clientSecret.trim());
    } else {
      Storage.remove(STORAGE_CLIENT_SECRET);
    }
    this.notify();
  }

  /**
   * Gets redirect URI.
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
   * Checks if valid access token exists.
   * @returns {boolean}
   */
  isAuthenticated() {
    const token = Storage.get(STORAGE_ACCESS_TOKEN);
    const expiresAt = Storage.get(STORAGE_EXPIRES_AT) || 0;
    const now = Date.now();

    if (token && now < expiresAt) {
      return true;
    }
    const refreshToken = Storage.get(STORAGE_REFRESH_TOKEN);
    return Boolean(refreshToken);
  }

  /**
   * Builds the Google OAuth 2.0 authorization URL with PKCE parameters.
   * @param {Object} options
   * @param {string} options.codeChallenge
   * @param {string} options.state
   * @param {string} [options.redirectUri]
   * @param {string} [options.clientId]
   * @returns {string}
   */
  buildAuthUrl({ codeChallenge, state, redirectUri, clientId }) {
    const cid = clientId || this.getClientId();
    const rUri = redirectUri || this.getRedirectUri();

    const params = new URLSearchParams({
      client_id: cid,
      redirect_uri: rUri,
      response_type: 'code',
      scope: DEFAULT_SCOPES,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      state: state,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Initiates Google OAuth 2.0 PKCE login flow.
   * @returns {Promise<void>}
   */
  async startLogin() {
    const clientId = this.getClientId();
    if (!clientId) {
      throw new Error(
        'Google OAuth Client ID is required. Please set your Client ID in Settings before connecting to YouTube Music.'
      );
    }

    const { codeVerifier, codeChallenge } = await generatePKCE();
    const randomNonce = generateRandomString(16);
    const state = `ytmusic:${randomNonce}`;
    const redirectUri = this.getRedirectUri();

    Storage.set(STORAGE_CODE_VERIFIER, codeVerifier);
    Storage.set(STORAGE_AUTH_STATE, state);
    Storage.set('sso_ytmusic_used_redirect_uri', redirectUri);

    const authUrl = this.buildAuthUrl({
      codeChallenge,
      state,
      redirectUri,
      clientId,
    });

    if (typeof window !== 'undefined') {
      window.location.href = authUrl;
    }
  }

  /**
   * Checks current URL or custom URL for OAuth callback code and exchanges for tokens.
   * @param {string} [url] - Optional custom URL for testing
   * @returns {Promise<boolean>} True if callback was processed
   */
  async handleCallback(url) {
    const targetUrl = url || (typeof window !== 'undefined' ? window.location.href : null);
    if (!targetUrl) return false;

    const parsed = new URL(targetUrl, 'http://localhost');
    const code = parsed.searchParams.get('code');
    const state = parsed.searchParams.get('state');
    const error = parsed.searchParams.get('error');

    if (error) {
      console.error('Google OAuth error callback:', error);
      this.clearUrlParams();
      return false;
    }

    if (!code) {
      return false;
    }

    const savedState = Storage.get(STORAGE_AUTH_STATE);
    const codeVerifier = Storage.get(STORAGE_CODE_VERIFIER);

    if (!state || (savedState && state !== savedState)) {
      console.warn('Google OAuth state mismatch. Possible CSRF.');
      this.clearUrlParams();
      return false;
    }

    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    const redirectUri = Storage.get('sso_ytmusic_used_redirect_uri') || this.getRedirectUri();

    try {
      const tokenBody = {
        client_id: clientId,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier || '',
      };
      if (clientSecret) {
        tokenBody.client_secret = clientSecret;
      }

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(tokenBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error_description || errorData.error || 'Failed to exchange Google authorization code');
      }

      const data = await response.json();
      this.saveTokens(data);

      // Attempt to load and store user profile immediately
      await this.fetchAndStoreProfile(data.access_token).catch((err) => {
        console.warn('Could not immediately fetch Google user profile:', err);
      });

      this.clearUrlParams();
      this.notify();
      return true;
    } catch (err) {
      console.error('Error exchanging Google authorization code:', err);
      this.clearUrlParams();
      throw err;
    }
  }

  /**
   * Saves tokens to storage.
   * @param {Object} tokenData
   */
  saveTokens(tokenData) {
    const { access_token, refresh_token, expires_in, scope } = tokenData;
    const expiresAt = Date.now() + (expires_in ? expires_in * 1000 : 3600 * 1000);

    Storage.set(STORAGE_ACCESS_TOKEN, access_token);
    Storage.set(STORAGE_EXPIRES_AT, expiresAt);
    if (refresh_token) {
      Storage.set(STORAGE_REFRESH_TOKEN, refresh_token);
    }
    if (scope) {
      Storage.set(STORAGE_GRANTED_SCOPES, scope);
    }
    Storage.remove(STORAGE_CODE_VERIFIER);
    Storage.remove(STORAGE_AUTH_STATE);
    Storage.remove('sso_ytmusic_used_redirect_uri');
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

    try {
      const refreshed = await this.refreshAccessToken(refreshToken);
      return refreshed;
    } catch (err) {
      console.warn('Failed to refresh Google access token:', err);
      return null;
    }
  }

  /**
   * Refreshes access token using refresh_token.
   * @param {string} refreshToken
   * @returns {Promise<string>}
   */
  async refreshAccessToken(refreshToken) {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    const refreshBody = {
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    };
    if (clientSecret) {
      refreshBody.client_secret = clientSecret;
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(refreshBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error_description || 'Token refresh failed');
    }

    const data = await response.json();
    this.saveTokens(data);
    return data.access_token;
  }

  /**
   * Fetches Google / YouTube user profile.
   * @param {string} [tokenOverride]
   * @returns {Promise<UserProfile>}
   */
  async fetchAndStoreProfile(tokenOverride) {
    const token = tokenOverride || (await this.getAccessToken());
    if (!token) {
      throw new Error('Not authenticated with Google / YouTube Music');
    }

    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to fetch Google profile (${res.status})`);
    }

    const data = await res.json();
    const profile = new UserProfile({
      id: data.id || 'ytmusic_user',
      displayName: data.name || data.email || 'YouTube Music User',
      email: data.email || '',
      imageUrl: data.picture || '',
      platform: MusicPlatform.YTMUSIC,
    });

    Storage.set(STORAGE_USER_PROFILE, {
      id: profile.id,
      displayName: profile.displayName,
      email: profile.email,
      imageUrl: profile.imageUrl,
    });

    return profile;
  }

  /**
   * Gets current user profile (from cache or API).
   * @returns {Promise<UserProfile>}
   */
  async getUserProfile() {
    const cached = Storage.get(STORAGE_USER_PROFILE);
    if (cached && cached.displayName) {
      return new UserProfile({
        id: cached.id,
        displayName: cached.displayName,
        email: cached.email,
        imageUrl: cached.imageUrl,
        platform: MusicPlatform.YTMUSIC,
      });
    }

    return this.fetchAndStoreProfile();
  }

  /**
   * Clears tokens and logs out.
   */
  logout() {
    Storage.remove(STORAGE_ACCESS_TOKEN);
    Storage.remove(STORAGE_REFRESH_TOKEN);
    Storage.remove(STORAGE_EXPIRES_AT);
    Storage.remove(STORAGE_GRANTED_SCOPES);
    Storage.remove(STORAGE_USER_PROFILE);
    Storage.remove(STORAGE_AUTH_STATE);
    Storage.remove(STORAGE_CODE_VERIFIER);
    this.notify();
  }

  /**
   * Cleans OAuth parameters from the browser address bar.
   */
  clearUrlParams() {
    if (typeof window === 'undefined' || !window.history || !window.location) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    url.searchParams.delete('error');
    url.searchParams.delete('scope');
    url.searchParams.delete('authuser');
    url.searchParams.delete('prompt');
    window.history.replaceState({}, document.title, url.pathname + (url.search || '') + (url.hash || ''));
  }

  /**
   * Subscribes to auth state changes.
   * @param {Function} callback
   * @returns {Function} unsubscribe function
   */
  subscribe(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  notify() {
    const authed = this.isAuthenticated();
    for (const listener of this._listeners) {
      try {
        listener(authed);
      } catch (err) {
        console.error('Error in YTMusicAuth listener:', err);
      }
    }
  }
}

export const ytmusicAuth = new YTMusicAuth();
