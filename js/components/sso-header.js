/**
 * Header Web Component (<sso-header>)
 * Features branding, provider switcher, navigation tabs, and user profile / settings.
 */

import { ProviderRegistry } from '../providers/provider-registry.js';
import { spotifyAuth } from '../providers/spotify/spotify-auth.js';
import { ytmusicAuth } from '../providers/ytmusic/ytmusic-auth.js';
import { SvgIcons } from '../utils/svg-icons.js';

export class SsoHeader extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.profile = null;
    this.isLoggedIn = false;
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
    this._unsubscribers.push(ProviderRegistry.subscribe(async () => {
      this.profile = null;
      await this.checkAuth();
    }));
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
      this.isLoggedIn = await provider.isAuthenticated();
      this.render();
      this.setupListeners();
    }
  }

  setProfile(profile) {
    this.profile = profile;
    this.isLoggedIn = Boolean(profile) || this.isLoggedIn;
    this.render();
    this.setupListeners();
  }

  setupListeners() {
    const providerSelect = this.shadowRoot.querySelector('#provider-select');
    if (providerSelect) {
      providerSelect.addEventListener('change', (e) => {
        ProviderRegistry.setActive(e.target.value);
        this.dispatchEvent(new CustomEvent('provider-change', { detail: e.target.value, bubbles: true }));
      });
    }

    const loginBtn = this.shadowRoot.querySelector('#header-login-btn');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('request-login', { bubbles: true }));
      });
    }

    const logoutBtn = this.shadowRoot.querySelector('#header-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('request-logout', { bubbles: true }));
      });
    }

    const settingsBtn = this.shadowRoot.querySelector('#settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('open-settings', { bubbles: true }));
      });
    }
  }

  render() {
    const activeProvider = ProviderRegistry.getActive();
    const allProviders = ProviderRegistry.getAll();

    const isYT = activeProvider?.id === 'ytmusic';
    const providerName = activeProvider?.name || 'Spotify';
    const brandColor = isYT ? '#ff0000' : '#1db954';
    const brandColorHover = isYT ? '#ff3333' : '#1ed760';
    const brandTextColor = isYT ? '#ffffff' : '#000000';
    const brandIcon = isYT ? SvgIcons.ytmusic(18) : SvgIcons.spotify(18);
    const brandIconSmall = isYT ? SvgIcons.ytmusic(16) : SvgIcons.spotify(16);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          background: #181818;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .header-container {
          max-width: 1300px;
          margin: 0 auto;
          padding: 12px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }
        .brand-section {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          color: #ffffff;
        }
        .logo-icon {
          display: flex;
          align-items: center;
        }
        .brand-title {
          font-size: 1.15rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .brand-badge {
          background: hsl(32, 73%, 42%);
          color: #ffffff;
          font-size: 1rem;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;

          a {
            text-decoration: none;
            color: white;
          }
        }
        .right-controls {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .provider-select-wrapper {
          position: relative;
        }
        .provider-select {
          appearance: none;
          background: #242424;
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #ffffff;
          padding: 6px 28px 6px 12px;
          border-radius: 20px;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
        }
        .header-login-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: ${brandColor};
          color: ${brandTextColor};
          font-weight: 700;
          font-size: 0.85rem;
          padding: 7px 16px;
          border-radius: 20px;
          border: none;
          cursor: pointer;
          transition: all 0.15s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        .header-login-btn:hover {
          background: ${brandColorHover};
          transform: scale(1.02);
        }
        .user-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 10px 4px 6px;
          background: #242424;
          border-radius: 20px;
          font-size: 0.85rem;
          font-weight: 600;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          object-fit: cover;
          background: #333333;
        }
        .avatar-icon {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: ${brandColor};
          color: ${brandTextColor};
          flex-shrink: 0;
        }
        .btn-header-logout {
          background: transparent;
          border: none;
          color: #727272;
          font-size: 0.75rem;
          cursor: pointer;
          padding: 2px 4px;
          border-radius: 4px;
          margin-left: 4px;
        }
        .btn-header-logout:hover {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.15);
        }
        .icon-btn {
          padding: 8px;
          border-radius: 50%;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #b3b3b3;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .icon-btn:hover {
          background: #282828;
          color: #ffffff;
        }
      </style>
      <header class="header-container">
        <div class="brand-section">
          <div class="logo-icon">
            ${SvgIcons.vennUnion(32, '#1DB954')}
          </div>
          <div class="brand-title">
            Music Set Operations
            <span class="brand-badge">by <a href="https://tactile.software">tactile.software</a></span>
          </div>
        </div>

        <div class="right-controls">
          <div class="provider-select-wrapper">
            <select id="provider-select" class="provider-select" title="Switch Music Service">
              ${allProviders
                .map(
                  (p) =>
                    `<option value="${p.id}" ${activeProvider && activeProvider.id === p.id ? 'selected' : ''}>
                    ${p.name}
                  </option>`
                )
                .join('')}
            </select>
          </div>

          ${
            this.isLoggedIn || this.profile
              ? `
            <div class="user-badge" title="${this.profile ? `Logged in as ${this.profile.displayName}` : `${providerName} Connected`}">
              ${
                this.profile?.imageUrl
                  ? `<img class="avatar" src="${this.profile.imageUrl}" alt="" />`
                  : `<span class="avatar-icon">${brandIconSmall}</span>`
              }
              <span>${this.profile?.displayName || `${providerName} Connected`}</span>
              <button id="header-logout-btn" class="btn-header-logout" title="Sign out of ${providerName}">✕</button>
            </div>
          `
              : ``
          }

          <button id="settings-btn" class="icon-btn" title="Settings & Credentials">
            ${SvgIcons.settings(18)}
          </button>
        </div>
      </header>
    `;
  }
}

customElements.define('sso-header', SsoHeader);
