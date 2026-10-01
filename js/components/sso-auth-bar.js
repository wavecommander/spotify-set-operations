/**
 * Authentication Banner Web Component (<sso-auth-bar>)
 * Supports dynamic streaming service providers (Spotify, YouTube Music).
 */

import { ProviderRegistry } from '../providers/provider-registry.js';
import { spotifyAuth } from '../providers/spotify/spotify-auth.js';
import { ytmusicAuth } from '../providers/ytmusic/ytmusic-auth.js';
import { SvgIcons } from '../utils/svg-icons.js';
import { notify } from './sso-toast.js';

export class SsoAuthBar extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.isLoggedIn = false;
    this.providerName = 'Spotify';
    this.providerId = 'spotify';
    this._unsubscribers = [];
  }

  connectedCallback() {
    this.render();
    this.setupListeners();
    this.checkAuth();

    const onAuthChange = async () => {
      await this.checkAuth();
    };

    this._unsubscribers.push(spotifyAuth.subscribe(onAuthChange));
    this._unsubscribers.push(ytmusicAuth.subscribe(onAuthChange));
    this._unsubscribers.push(
      ProviderRegistry.subscribe(async (active) => {
        if (active) {
          this.providerName = active.name;
          this.providerId = active.id;
        }
        await this.checkAuth();
      })
    );
  }

  disconnectedCallback() {
    for (const unsub of this._unsubscribers) {
      if (typeof unsub === 'function') unsub();
    }
    this._unsubscribers = [];
  }

  async checkAuth() {
    const provider = ProviderRegistry.getActive();
    if (provider) {
      this.providerName = provider.name;
      this.providerId = provider.id;
      this.isLoggedIn = await provider.isAuthenticated();
      this.render();
      this.setupListeners();
    }
  }

  setupListeners() {
    const loginBtn = this.shadowRoot.querySelector('#login-btn');
    if (loginBtn) {
      loginBtn.addEventListener('click', async () => {
        try {
          const provider = ProviderRegistry.getActive();
          if (provider) {
            await provider.login();
          }
        } catch (err) {
          notify(err.message, 'error');
        }
      });
    }

    const logoutBtn = this.shadowRoot.querySelector('#logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        const provider = ProviderRegistry.getActive();
        if (provider) {
          await provider.logout();
          this.isLoggedIn = false;
          this.render();
          this.setupListeners();
          this.dispatchEvent(new CustomEvent('auth-changed', { detail: false, bubbles: true }));
          notify(`Signed out from ${this.providerName}`, 'info');
        }
      });
    }

    const configBtn = this.shadowRoot.querySelector('#edit-config-btn');
    if (configBtn) {
      configBtn.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('open-settings', { bubbles: true }));
      });
    }
  }

  render() {
    const isYT = this.providerId === 'ytmusic';
    const clientId = isYT ? ytmusicAuth.getClientId() : spotifyAuth.getClientId();
    const redirectUri = isYT ? ytmusicAuth.getRedirectUri() : spotifyAuth.getRedirectUri();

    const brandColor = isYT ? '#ff0000' : '#1db954';
    const brandColorHover = isYT ? '#ff3333' : '#1ed760';
    const brandTextColor = isYT ? '#ffffff' : '#000000';
    const brandIcon = isYT ? SvgIcons.ytmusic(20) : SvgIcons.spotify(20);

    const subText = this.isLoggedIn
      ? `Authenticated with ${this.providerName} via OAuth 2.0 PKCE. Ready to search playlists, albums, and create results.`
      : !clientId && isYT
      ? 'Google OAuth Client ID required. Open Settings to configure your Client ID before signing in.'
      : `Sign in to access your ${this.providerName} playlists, albums, and export resulting collections.`;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .auth-bar {
          background: #181818;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 16px 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }
        .status-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .status-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: ${this.isLoggedIn ? brandColor : '#ef4444'};
          box-shadow: 0 0 10px ${this.isLoggedIn ? brandColor : 'rgba(239, 68, 68, 0.6)'};
          flex-shrink: 0;
        }
        .status-text {
          font-size: 0.95rem;
          font-weight: 600;
          color: #ffffff;
        }
        .status-sub {
          font-size: 0.8rem;
          color: #b3b3b3;
          margin-top: 2px;
        }
        .config-details {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.75rem;
          color: #727272;
          margin-top: 6px;
          flex-wrap: wrap;
        }
        .config-tag {
          background: #242424;
          padding: 2px 8px;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .config-tag code {
          color: #b3b3b3;
          font-family: monospace;
        }
        .config-edit-link {
          color: ${brandColor};
          background: none;
          border: none;
          font-size: 0.75rem;
          cursor: pointer;
          text-decoration: underline;
          padding: 0;
        }
        .action-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 22px;
          border-radius: 24px;
          font-size: 0.9rem;
          font-weight: 700;
          border: none;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }
        .btn-connect {
          background: ${brandColor};
          color: ${brandTextColor};
          box-shadow: 0 4px 14px ${isYT ? 'rgba(255, 0, 0, 0.35)' : 'rgba(29, 185, 84, 0.35)'};
        }
        .btn-connect:hover {
          background: ${brandColorHover};
          transform: scale(1.03);
          box-shadow: 0 6px 18px ${isYT ? 'rgba(255, 0, 0, 0.5)' : 'rgba(29, 185, 84, 0.5)'};
        }
        .btn-disconnect {
          background: #2a2a2a;
          color: #b3b3b3;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .btn-disconnect:hover {
          background: #333333;
          color: #ffffff;
        }
      </style>
      <div class="auth-bar">
        <div class="status-section">
          <div class="status-dot"></div>
          <div>
            <div class="status-text">
              ${this.isLoggedIn ? `Connected to ${this.providerName}` : `Not connected to ${this.providerName}`}
            </div>
            <div class="status-sub">
              ${subText}
            </div>
            <div class="config-details">
              <span class="config-tag">Client ID: <code>${clientId ? clientId.substring(0, 10) + '...' : '(Not configured)'}</code></span>
              <span class="config-tag">Callback: <code>${redirectUri}</code></span>
              <button id="edit-config-btn" class="config-edit-link">Settings</button>
            </div>
          </div>
        </div>

        <div>
          ${
            this.isLoggedIn
              ? `<button id="logout-btn" class="action-btn btn-disconnect">Sign out</button>`
              : `<button id="login-btn" class="action-btn btn-connect">
                  ${brandIcon}
                  <span>Sign in with ${this.providerName}</span>
                </button>`
          }
        </div>
      </div>
    `;
  }
}

customElements.define('sso-auth-bar', SsoAuthBar);
