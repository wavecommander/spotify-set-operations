/**
 * Source Search & Direct Import Component (<sso-source-search>)
 * Enables searching playlists and albums or pasting direct URLs/IDs across Spotify and YouTube Music.
 */

import { ProviderRegistry } from '../providers/provider-registry.js';
import { spotifyProvider } from '../providers/spotify/spotify-provider.js';
import { ytMusicProvider } from '../providers/ytmusic/ytmusic-provider.js';
import { SvgIcons } from '../utils/svg-icons.js';
import { notify } from './sso-toast.js';

export class SsoSourceSearch extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.searchMode = 'search'; // 'search' or 'direct'
    this.results = { playlists: [], albums: [] };
    this.loading = false;
    this.searchTimeout = null;
    this._unsubscribeProvider = null;
  }

  connectedCallback() {
    this.render();
    this.setupListeners();

    this._unsubscribeProvider = ProviderRegistry.subscribe(() => {
      this.results = { playlists: [], albums: [] };
      this.render();
      this.setupListeners();
    });
  }

  disconnectedCallback() {
    if (this._unsubscribeProvider) {
      this._unsubscribeProvider();
    }
  }

  setupListeners() {
    const searchInput = this.shadowRoot.querySelector('#search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(this.searchTimeout);
        const query = e.target.value.trim();
        if (query.length >= 2) {
          this.searchTimeout = setTimeout(() => this.performSearch(query), 350);
        } else {
          this.results = { playlists: [], albums: [] };
          this.updateResultsView();
        }
      });
    }

    const directInput = this.shadowRoot.querySelector('#direct-input');
    const directBtn = this.shadowRoot.querySelector('#direct-add-btn');
    if (directBtn && directInput) {
      directBtn.addEventListener('click', async () => {
        const val = directInput.value.trim();
        if (!val) return;
        this.addDirectSource(val);
      });
      directInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          directBtn.click();
        }
      });
    }

    const tabBtns = this.shadowRoot.querySelectorAll('.tab-btn');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        this.searchMode = e.currentTarget.dataset.mode;
        this.render();
        this.setupListeners();
      });
    });

    this.shadowRoot.addEventListener('click', (e) => {
      const addBtn = e.target.closest('.add-result-btn');
      if (addBtn) {
        const raw = addBtn.dataset.item;
        if (raw) {
          const item = JSON.parse(decodeURIComponent(raw));
          this.dispatchEvent(new CustomEvent('source-select', { detail: item, bubbles: true }));
          notify(`Added "${item.name}" to workspace`, 'success');
        }
      }
    });
  }

  async performSearch(query) {
    const provider = ProviderRegistry.getActive();
    if (!provider) return;

    const isYT = provider.id === 'ytmusic';
    const isAuthed = await provider.isAuthenticated();

    if (!isAuthed) {
      const resultsContainer = this.shadowRoot.querySelector('#results-container');
      if (resultsContainer) {
        const signinIcon = isYT ? SvgIcons.ytmusic(16) : SvgIcons.spotify(16);
        const brandColor = isYT ? '#ff0000' : '#1db954';
        const brandTextColor = isYT ? '#ffffff' : '#000000';

        resultsContainer.innerHTML = `
          <div class="empty-state">
            <p style="margin-bottom: 12px;">Please sign in with ${provider.name} to search playlists and albums.</p>
            <button id="search-signin-btn" class="btn-action" style="padding: 8px 18px; border-radius: 20px; display: inline-flex; align-items: center; gap: 6px; background: ${brandColor}; color: ${brandTextColor};">
              ${signinIcon} Sign in with ${provider.name}
            </button>
          </div>
        `;
        const btn = resultsContainer.querySelector('#search-signin-btn');
        if (btn) {
          btn.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('request-login', { bubbles: true }));
          });
        }
      }
      return;
    }

    this.loading = true;
    this.updateLoadingState();

    try {
      this.results = await provider.search(query, ['playlist', 'album']);
    } catch (err) {
      let msg = err.message || `Search failed on ${provider.name}.`;
      if (err.status === 403 || String(err).includes('403')) {
        msg = isYT
          ? 'YouTube Data API 403: Verify YouTube Data API v3 is enabled in your Google Cloud Console project.'
          : 'Spotify 403 Forbidden: In Developer Mode, ensure your account is in "Users and Access" at developer.spotify.com/dashboard.';
      }
      notify(msg, 'error', 8000);
      this.results = { playlists: [], albums: [] };
    } finally {
      this.loading = false;
      this.updateResultsView();
    }
  }

  async addDirectSource(urlOrId) {
    const activeProvider = ProviderRegistry.getActive();

    // Intelligently route by URL pattern to support cross-service direct links
    let targetProvider = activeProvider;
    if (
      urlOrId.includes('youtube.com') ||
      urlOrId.includes('youtu.be') ||
      urlOrId.startsWith('PL') ||
      urlOrId.startsWith('OLAK5uy_') ||
      urlOrId.startsWith('MPREb_') ||
      urlOrId.startsWith('ytmusic:')
    ) {
      targetProvider = ytMusicProvider;
    } else if (urlOrId.includes('spotify.com') || urlOrId.startsWith('spotify:')) {
      targetProvider = spotifyProvider;
    }

    if (!targetProvider) return;

    try {
      notify(`Fetching collection from ${targetProvider.name}...`, 'info', 2000);
      let collection;
      if (
        urlOrId.includes('album') ||
        urlOrId.includes('OLAK5uy_') ||
        urlOrId.includes('MPREb_') ||
        urlOrId.startsWith('OLAK5uy_') ||
        urlOrId.startsWith('MPREb_')
      ) {
        collection = await targetProvider.getAlbum(urlOrId);
      } else {
        collection = await targetProvider.getPlaylist(urlOrId);
      }

      this.dispatchEvent(
        new CustomEvent('source-loaded', {
          detail: collection,
          bubbles: true,
        })
      );
      notify(`Loaded "${collection.name}" (${collection.trackCount} tracks)`, 'success');
      const directInput = this.shadowRoot.querySelector('#direct-input');
      if (directInput) directInput.value = '';
    } catch (err) {
      notify(`Failed to load source: ${err.message}`, 'error');
    }
  }

  updateLoadingState() {
    const statusEl = this.shadowRoot.querySelector('#status-message');
    if (statusEl) {
      statusEl.textContent = this.loading ? 'Searching catalog...' : '';
    }
  }

  updateResultsView() {
    const resultsContainer = this.shadowRoot.querySelector('#results-container');
    if (!resultsContainer) return;

    const provider = ProviderRegistry.getActive();
    const provName = provider?.name || 'catalog';

    const hasResults = this.results.playlists.length > 0 || this.results.albums.length > 0;
    if (!hasResults) {
      resultsContainer.innerHTML = `
        <div class="empty-state">
          Type a name above to search ${provName} playlists and albums.
        </div>
      `;
      return;
    }

    let html = '';
    if (this.results.playlists.length > 0) {
      html += `<div class="section-title">Playlists</div>`;
      html += '<div class="results-grid">';
      for (const item of this.results.playlists) {
        html += this.renderResultCard(item);
      }
      html += '</div>';
    }

    if (this.results.albums.length > 0) {
      html += `<div class="section-title" style="margin-top: 16px;">Albums</div>`;
      html += '<div class="results-grid">';
      for (const item of this.results.albums) {
        html += this.renderResultCard(item);
      }
      html += '</div>';
    }

    resultsContainer.innerHTML = html;
  }

  renderResultCard(item) {
    const encoded = encodeURIComponent(JSON.stringify(item));
    const isYT = item.platform === 'ytmusic';
    const tagBg = isYT ? 'rgba(255, 0, 0, 0.18)' : 'rgba(29, 185, 84, 0.18)';
    const tagColor = isYT ? '#ff4d4d' : '#1db954';
    const trackInfo = item.totalTracks > 0 ? `${item.totalTracks} tracks` : (item.owner || 'Music');

    return `
      <div class="result-card">
        <img class="result-thumb" src="${item.imageUrl || ''}" alt="" onerror="this.style.opacity='0.2'" />
        <div class="result-meta">
          <div class="result-title" title="${item.name}">${item.name}</div>
          <div class="result-subtitle">
            <span>${item.owner} • ${trackInfo}</span>
            <span style="font-size: 0.68rem; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; background: ${tagBg}; color: ${tagColor}; margin-left: 6px;">
              ${isYT ? 'YouTube' : 'Spotify'}
            </span>
          </div>
        </div>
        <button class="add-result-btn" data-item="${encoded}">
          ${SvgIcons.plus(16)} Add
        </button>
      </div>
    `;
  }

  render() {
    const provider = ProviderRegistry.getActive();
    const isYT = provider?.id === 'ytmusic';
    const providerName = provider?.name || 'Spotify';
    const brandColor = isYT ? '#ff0000' : '#1db954';
    const brandColorHover = isYT ? '#ff3333' : '#1ed760';
    const brandTextColor = isYT ? '#ffffff' : '#000000';

    const directPlaceholder = isYT
      ? 'Paste YouTube Music link or ID (e.g. https://music.youtube.com/playlist?list=...)'
      : 'Paste Spotify link or ID (e.g. https://open.spotify.com/playlist/...)';

    const directHint = isYT
      ? 'Paste any YouTube Music or YouTube playlist link. For albums, use the Share → Copy link URL (starts with playlist?list=OLAK5uy_).'
      : 'Paste any public or private Spotify link from your browser or Spotify app.';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .search-panel {
          background: #181818;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 20px;
        }
        .tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }
        .tab-btn {
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 0.82rem;
          font-weight: 600;
          background: #242424;
          color: #b3b3b3;
          border: 1px solid rgba(255, 255, 255, 0.08);
          cursor: pointer;
        }
        .tab-btn.active {
          background: #333333;
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.2);
        }
        .input-row {
          display: flex;
          gap: 10px;
          position: relative;
        }
        .search-field {
          flex: 1;
          background: #242424;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          padding: 10px 14px 10px 38px;
          color: #ffffff;
          font-size: 0.95rem;
        }
        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #727272;
          pointer-events: none;
          display: flex;
        }
        .btn-action {
          padding: 0 20px;
          background: ${brandColor};
          color: ${brandTextColor};
          font-weight: 700;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .btn-action:hover {
          background: ${brandColorHover};
        }
        .status-msg {
          font-size: 0.8rem;
          color: ${brandColor};
          margin-top: 8px;
          min-height: 18px;
        }
        .section-title {
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #b3b3b3;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .results-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 10px;
        }
        .result-card {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #242424;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          padding: 10px;
          transition: background 0.15s ease;
        }
        .result-card:hover {
          background: #2a2a2a;
        }
        .result-thumb {
          width: 48px;
          height: 48px;
          border-radius: 6px;
          object-fit: cover;
          background: #181818;
          flex-shrink: 0;
        }
        .result-meta {
          flex: 1;
          min-width: 0;
        }
        .result-title {
          font-size: 0.88rem;
          font-weight: 600;
          color: #ffffff;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .result-subtitle {
          font-size: 0.78rem;
          color: #b3b3b3;
          margin-top: 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          display: flex;
          align-items: center;
        }
        .add-result-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          border-radius: 16px;
          background: #333333;
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.1);
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
        }
        .add-result-btn:hover {
          background: ${brandColor};
          color: ${brandTextColor};
        }
        .empty-state {
          padding: 24px;
          text-align: center;
          color: #727272;
          font-size: 0.9rem;
        }
      </style>

      <div class="search-panel">
        <div class="tabs">
          <button class="tab-btn ${this.searchMode === 'search' ? 'active' : ''}" data-mode="search">
            Search ${providerName}
          </button>
          <button class="tab-btn ${this.searchMode === 'direct' ? 'active' : ''}" data-mode="direct">
            Paste URL / ID
          </button>
        </div>

        ${
          this.searchMode === 'search'
            ? `
          <div class="input-row">
            <span class="search-icon">${SvgIcons.search(18)}</span>
            <input id="search-input" class="search-field" type="text" placeholder="Search for ${providerName} playlists or albums..." />
          </div>
          <div id="status-message" class="status-msg"></div>
          <div id="results-container">
            <div class="empty-state">Type a search query to browse ${providerName} playlists and albums.</div>
          </div>
        `
            : `
          <div class="input-row">
            <input id="direct-input" class="search-field" style="padding-left: 14px;" type="text" placeholder="${directPlaceholder}" />
            <button id="direct-add-btn" class="btn-action">Load</button>
          </div>
          <div class="status-msg" style="color: #727272;">
            ${directHint}
          </div>
        `
        }
      </div>
    `;
  }
}

customElements.define('sso-source-search', SsoSourceSearch);
