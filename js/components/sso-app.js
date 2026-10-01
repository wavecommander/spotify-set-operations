/**
 * Root Application Web Component (<sso-app>)
 * Coordinates application state, view tabs, OAuth PKCE lifecycle, and component communication.
 */

import { ProviderRegistry } from '../providers/provider-registry.js';
import { spotifyProvider } from '../providers/spotify/spotify-provider.js';
import { ytMusicProvider } from '../providers/ytmusic/ytmusic-provider.js';
import { spotifyAuth } from '../providers/spotify/spotify-auth.js';
import { ytmusicAuth } from '../providers/ytmusic/ytmusic-auth.js';
import { SetEngine, SetOperationType } from '../core/set-engine.js';
import { MusicCollection, CollectionType } from '../core/models.js';
import { Storage } from '../utils/storage.js';
import { SvgIcons } from '../utils/svg-icons.js';
import { notify } from './sso-toast.js';

// Import all Web Components
import './sso-toast.js';
import './sso-header.js';
import './sso-auth-bar.js';
import './sso-source-search.js';
import './sso-visual-builder.js';
import './sso-venn-diagram.js';
import './sso-track-preview.js';
import './sso-export-modal.js';

export class SsoApp extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.settingsOpen = false;
    this.settingsTab = 'spotify';
    this.pipelineResult = null;
    this.activeVennSteps = [];
  }

  async connectedCallback() {
    // Register available music providers
    ProviderRegistry.register(spotifyProvider);
    ProviderRegistry.register(ytMusicProvider);

    this.render();
    this.setupListeners();
    this.renderVennPipeline(null, null, []);

    // Check for OAuth PKCE redirect callback
    await this.handleOAuthCallback();

    // Fetch user profile if already authenticated
    await this.loadUserProfile();
  }

  async handleOAuthCallback() {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const state = params.get('state') || '';
    const isYouTube = state.startsWith('ytmusic:') || Storage.get('sso_ytmusic_auth_state') === state;

    try {
      if (isYouTube) {
        const processed = await ytmusicAuth.handleCallback();
        if (processed) {
          notify('Successfully connected to YouTube Music!', 'success');
          ProviderRegistry.setActive('ytmusic');
          const header = this.shadowRoot.querySelector('sso-header');
          if (header) header.checkAuth();
          const authBar = this.shadowRoot.querySelector('sso-auth-bar');
          if (authBar) authBar.checkAuth();
          await this.loadUserProfile();
        }
      } else {
        const processed = await spotifyAuth.handleCallback();
        if (processed) {
          notify('Successfully connected to Spotify!', 'success');
          ProviderRegistry.setActive('spotify');
          const header = this.shadowRoot.querySelector('sso-header');
          if (header) header.checkAuth();
          const authBar = this.shadowRoot.querySelector('sso-auth-bar');
          if (authBar) authBar.checkAuth();
          await this.loadUserProfile();
        }
      }
    } catch (err) {
      const provName = isYouTube ? 'YouTube Music' : 'Spotify';
      notify(`${provName} authorization failed: ${err.message}`, 'error');
    }
  }

  async loadUserProfile() {
    const provider = ProviderRegistry.getActive();
    if (!provider) return;

    const isAuthed = await provider.isAuthenticated();
    if (isAuthed) {
      try {
        const profile = await provider.getUserProfile();
        const header = this.shadowRoot.querySelector('sso-header');
        if (header) header.setProfile(profile);
      } catch (err) {
        console.warn(`Could not load ${provider.name} user profile:`, err);
        const header = this.shadowRoot.querySelector('sso-header');
        if (header) header.checkAuth();
        const reason = err.data?.error?.message || err.message || 'Access Forbidden';
        notify(
          `${provider.name} profile error: "${reason}".`,
          'error',
          10000
        );
      }
    } else {
      const header = this.shadowRoot.querySelector('sso-header');
      if (header) header.setProfile(null);
    }
  }

  setupListeners() {
    // Sign in / Sign out requests
    this.shadowRoot.addEventListener('request-login', async () => {
      const provider = ProviderRegistry.getActive();
      if (provider) {
        try {
          await provider.login();
        } catch (err) {
          notify(err.message, 'error');
        }
      }
    });

    this.shadowRoot.addEventListener('request-logout', async () => {
      const provider = ProviderRegistry.getActive();
      if (provider) {
        await provider.logout();
        const header = this.shadowRoot.querySelector('sso-header');
        if (header) header.setProfile(null);
        const authBar = this.shadowRoot.querySelector('sso-auth-bar');
        if (authBar) authBar.checkAuth();
        notify('Signed out', 'info');
      }
    });

    // Provider changes
    this.shadowRoot.addEventListener('provider-change', async () => {
      const authBar = this.shadowRoot.querySelector('sso-auth-bar');
      if (authBar) authBar.checkAuth();
      await this.loadUserProfile();
    });

    // Open settings modal
    this.shadowRoot.addEventListener('open-settings', () => {
      const active = ProviderRegistry.getActive();
      this.settingsTab = active && active.id === 'ytmusic' ? 'ytmusic' : 'spotify';
      this.settingsOpen = true;
      this.renderSettingsModal();
    });

    // Adding source from search or direct link
    this.shadowRoot.addEventListener('source-select', async (e) => {
      const item = e.detail;
      const provider = (item?.platform ? ProviderRegistry.get(item.platform) : null) || ProviderRegistry.getActive();
      if (!provider) return;

      try {
        notify(`Loading "${item.name}"...`, 'info', 2000);
        let collection;
        if (item.type === 'album') {
          collection = await provider.getAlbum(item.id);
        } else {
          collection = await provider.getPlaylist(item.id);
        }

        const builder = this.shadowRoot.querySelector('sso-visual-builder');
        if (builder) builder.addCollection(collection);
      } catch (err) {
        notify(`Error loading collection: ${err.message}`, 'error');
      }
    });

    this.shadowRoot.addEventListener('source-loaded', (e) => {
      const collection = e.detail;
      const builder = this.shadowRoot.querySelector('sso-visual-builder');
      if (builder) builder.addCollection(collection);
    });

    // Pipeline change in visual builder
    this.shadowRoot.addEventListener('pipeline-change', (e) => {
      const { result, graph, baseCollection, steps } = e.detail;
      this.pipelineResult = result;

      // Update track preview table
      const preview = this.shadowRoot.querySelector('sso-track-preview');
      if (preview) {
        const nameMap = new Map();
        for (const [id, col] of graph.collections.entries()) {
          nameMap.set(id, col.name);
        }
        preview.setData({
          tracks: result.trackList,
          trackSources: result.trackSources,
          collectionNameMap: nameMap,
        });
      }

      // Update multi-step Venn diagram pipeline visualizer
      this.renderVennPipeline(graph, baseCollection, steps);
    });

    // Venn diagram slice filtering
    this.shadowRoot.addEventListener('filter-slice', (e) => {
      const detail = e.detail;
      const preview = this.shadowRoot.querySelector('sso-track-preview');
      if (!preview || !this.pipelineResult) return;

      const slice = typeof detail === 'string' ? detail : detail?.slice;
      const stepIndex = typeof detail === 'object' && detail?.stepIndex !== undefined ? detail.stepIndex : 0;

      // Clear filter selection highlighting on all OTHER venn diagram cards in the pipeline
      const container = this.shadowRoot.querySelector('#venn-pipeline-container');
      if (container) {
        const allVennCards = container.querySelectorAll('sso-venn-diagram');
        allVennCards.forEach((card, idx) => {
          if (idx !== stepIndex && card.activeFilter !== 'all') {
            card.clearFilter();
          }
        });
      }

      if (!slice || slice === 'all') {
        preview.setData({
          tracks: this.pipelineResult.trackList,
          trackSources: this.pipelineResult.trackSources,
        });
        return;
      }

      const activeStep = this.activeVennSteps?.[stepIndex];
      if (!activeStep) return;

      const partition = SetEngine.getVennPartition(
        activeStep.collectionA,
        activeStep.collectionB
      );

      let targetMap;
      if (slice === 'onlyA') targetMap = partition.onlyA;
      else if (slice === 'onlyB') targetMap = partition.onlyB;
      else if (slice === 'overlap') targetMap = partition.overlap;
      else targetMap = this.pipelineResult.tracks;

      const filteredTracks = Array.from(targetMap.values());
      preview.setData({
        tracks: filteredTracks,
        trackSources: this.pipelineResult.trackSources,
      });

      const sliceLabels = {
        onlyA: `Tracks only in ${activeStep.collectionA.name}`,
        onlyB: `Tracks only in ${activeStep.collectionB.name}`,
        overlap: 'Shared tracks (Overlap)',
      };
      notify(`Filtered to ${filteredTracks.length} ${sliceLabels[slice] || 'tracks'} (Step ${stepIndex + 1})`, 'info', 2500);
    });

    // Export request from preview table
    this.shadowRoot.addEventListener('request-export', (e) => {
      const modal = this.shadowRoot.querySelector('sso-export-modal');
      if (modal) {
        const tracks = e.detail?.tracks || this.pipelineResult?.trackList || [];
        modal.open(tracks, 'Set Operations Mix');
      }
    });
  }

  renderSettingsModal() {
    let container = this.shadowRoot.querySelector('#settings-container');
    if (!container) return;

    if (!this.settingsOpen) {
      container.innerHTML = '';
      return;
    }

    const isSpotifyTab = this.settingsTab === 'spotify';
    const isYTTab = this.settingsTab === 'ytmusic';

    const spotifyClientId = spotifyAuth.getClientId();
    const spotifyRedirect = spotifyAuth.getRedirectUri();
    const isSpotifyAuthed = spotifyAuth.isAuthenticated();

    const ytClientId = ytmusicAuth.getClientId();
    const ytClientSecret = ytmusicAuth.getClientSecret();
    const ytRedirect = ytmusicAuth.getRedirectUri();
    const isYTAuthed = ytmusicAuth.isAuthenticated();

    container.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h2 style="font-size: 1.15rem; font-weight: 700; color: #ffffff; margin: 0;">Settings & Credentials</h2>
            <button id="close-settings-btn" style="background: none; border: none; color: #727272; cursor: pointer;">
              ${SvgIcons.close(20)}
            </button>
          </div>

          <!-- Provider Tabs -->
          <div style="display: flex; gap: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); margin-bottom: 20px; padding-bottom: 10px;">
            <button id="tab-spotify-btn" type="button" style="display: flex; align-items: center; gap: 8px; background: ${isSpotifyTab ? 'rgba(29, 185, 84, 0.15)' : 'none'}; border: 1px solid ${isSpotifyTab ? '#1db954' : 'rgba(255,255,255,0.1)'}; color: ${isSpotifyTab ? '#1db954' : '#b3b3b3'}; padding: 6px 14px; border-radius: 20px; font-weight: 600; font-size: 0.82rem; cursor: pointer;">
              ${SvgIcons.spotify(16)}
              <span>Spotify</span>
            </button>
            <button id="tab-ytmusic-btn" type="button" style="display: flex; align-items: center; gap: 8px; background: ${isYTTab ? 'rgba(255, 0, 0, 0.15)' : 'none'}; border: 1px solid ${isYTTab ? '#ff0000' : 'rgba(255,255,255,0.1)'}; color: ${isYTTab ? '#ff4d4d' : '#b3b3b3'}; padding: 6px 14px; border-radius: 20px; font-weight: 600; font-size: 0.82rem; cursor: pointer;">
              ${SvgIcons.ytmusic(16)}
              <span>YouTube Music</span>
            </button>
          </div>

          ${
            isSpotifyTab
              ? `
              <div style="margin-bottom: 16px;">
                <label style="display: block; font-size: 0.82rem; font-weight: 600; color: #b3b3b3; margin-bottom: 6px;">
                  Spotify Client ID
                </label>
                <input id="settings-spotify-client-id" type="text" value="${spotifyClientId}" style="width: 100%;" />
                <div style="font-size: 0.75rem; color: #727272; margin-top: 4px;">
                  Your registered Spotify Developer App Client ID.
                </div>
              </div>

              <div style="margin-bottom: 20px;">
                <label style="display: block; font-size: 0.82rem; font-weight: 600; color: #b3b3b3; margin-bottom: 6px;">
                  Spotify Redirect URI
                </label>
                <input id="settings-spotify-redirect-uri" type="text" value="${spotifyRedirect}" style="width: 100%;" />
                <div style="font-size: 0.75rem; color: #727272; margin-top: 4px;">
                  Must exactly match the Redirect URI registered in your Spotify Developer Dashboard.
                </div>
              </div>

              <!-- Spotify Diagnostics Panel -->
              <div style="margin-bottom: 20px; padding: 12px; background: #202020; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
                <div style="font-size: 0.8rem; font-weight: 700; color: #ffffff; margin-bottom: 6px;">Spotify Diagnostics</div>
                <div style="font-size: 0.75rem; color: #b3b3b3; line-height: 1.6; margin-bottom: 10px;">
                  <div>Status: <strong style="color: ${isSpotifyAuthed ? '#1db954' : '#ef4444'};">${isSpotifyAuthed ? 'Authenticated' : 'Not Authenticated'}</strong></div>
                  <div>Granted Scopes: <code style="word-break: break-all; color: #1db954;">${Storage.get('sso_spotify_granted_scopes') || '(None recorded)'}</code></div>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                  <button id="test-spotify-api-btn" type="button" style="padding: 6px 12px; border-radius: 6px; background: #2a2a2a; border: 1px solid rgba(255,255,255,0.15); color: #fff; font-size: 0.75rem; cursor: pointer;">
                    Test /v1/me API
                  </button>
                  <button id="force-spotify-reauth-btn" type="button" style="padding: 6px 12px; border-radius: 6px; background: rgba(239,68,68,0.2); border: 1px solid rgba(239,68,68,0.4); color: #ef4444; font-size: 0.75rem; cursor: pointer;">
                    Reset Token & Sign In
                  </button>
                </div>
                <div id="test-spotify-api-output" style="margin-top: 8px; font-size: 0.72rem; font-family: monospace; color: #b3b3b3; white-space: pre-wrap; display: none; max-height: 120px; overflow-y: auto; background: #121212; padding: 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.06);"></div>
              </div>
            `
              : `
              <div style="margin-bottom: 16px;">
                <label style="display: block; font-size: 0.82rem; font-weight: 600; color: #b3b3b3; margin-bottom: 6px;">
                  Google Cloud OAuth Client ID
                </label>
                <input id="settings-ytmusic-client-id" type="text" value="${ytClientId}" placeholder="e.g. 123456789-abcdef.apps.googleusercontent.com" style="width: 100%;" />
                <div style="font-size: 0.75rem; color: #727272; margin-top: 4px;">
                  OAuth 2.0 Web Application Client ID created in Google Cloud Console.
                </div>
              </div>

              <div style="margin-bottom: 16px;">
                <label style="display: block; font-size: 0.82rem; font-weight: 600; color: #b3b3b3; margin-bottom: 6px;">
                  Google OAuth Client Secret
                </label>
                <input id="settings-ytmusic-client-secret" type="password" value="${ytClientSecret}" placeholder="Enter Google Client Secret (e.g. GOCSPX-...)" style="width: 100%;" />
                <div style="font-size: 0.75rem; color: #727272; margin-top: 4px;">
                  Found in Google Cloud Console under Credentials &gt; OAuth 2.0 Client IDs. Required for 'Web application' client types during token exchange.
                </div>
              </div>

              <div style="margin-bottom: 20px;">
                <label style="display: block; font-size: 0.82rem; font-weight: 600; color: #b3b3b3; margin-bottom: 6px;">
                  Google Redirect URI
                </label>
                <input id="settings-ytmusic-redirect-uri" type="text" value="${ytRedirect}" style="width: 100%;" />
                <div style="font-size: 0.75rem; color: #727272; margin-top: 4px;">
                  Authorized Redirect URI registered in Google Cloud Console (e.g. <code>http://127.0.0.1:8888/callback</code>).
                </div>
              </div>

              <!-- YouTube Music Diagnostics Panel -->
              <div style="margin-bottom: 20px; padding: 12px; background: #202020; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
                <div style="font-size: 0.8rem; font-weight: 700; color: #ffffff; margin-bottom: 6px;">YouTube Music Diagnostics</div>
                <div style="font-size: 0.75rem; color: #b3b3b3; line-height: 1.6; margin-bottom: 10px;">
                  <div>Status: <strong style="color: ${isYTAuthed ? '#ff4d4d' : '#ef4444'};">${isYTAuthed ? 'Authenticated' : 'Not Authenticated'}</strong></div>
                  <div>Granted Scopes: <code style="word-break: break-all; color: #ff4d4d;">${Storage.get('sso_ytmusic_granted_scopes') || '(None recorded)'}</code></div>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                  <button id="test-ytmusic-api-btn" type="button" style="padding: 6px 12px; border-radius: 6px; background: #2a2a2a; border: 1px solid rgba(255,255,255,0.15); color: #fff; font-size: 0.75rem; cursor: pointer;">
                    Test userinfo API
                  </button>
                  <button id="force-ytmusic-reauth-btn" type="button" style="padding: 6px 12px; border-radius: 6px; background: rgba(239,68,68,0.2); border: 1px solid rgba(239,68,68,0.4); color: #ef4444; font-size: 0.75rem; cursor: pointer;">
                    Reset Token & Sign In
                  </button>
                </div>
                <div id="test-ytmusic-api-output" style="margin-top: 8px; font-size: 0.72rem; font-family: monospace; color: #b3b3b3; white-space: pre-wrap; display: none; max-height: 120px; overflow-y: auto; background: #121212; padding: 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.06);"></div>
              </div>
            `
          }

          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button id="save-settings-btn" style="padding: 8px 20px; border-radius: 20px; background: #1db954; color: #000000; font-weight: 700; border: none; cursor: pointer;">
              Save Settings
            </button>
          </div>
        </div>
      </div>
    `;

    // Tab buttons
    const spotifyTabBtn = container.querySelector('#tab-spotify-btn');
    if (spotifyTabBtn) {
      spotifyTabBtn.addEventListener('click', () => {
        this.settingsTab = 'spotify';
        this.renderSettingsModal();
      });
    }

    const ytTabBtn = container.querySelector('#tab-ytmusic-btn');
    if (ytTabBtn) {
      ytTabBtn.addEventListener('click', () => {
        this.settingsTab = 'ytmusic';
        this.renderSettingsModal();
      });
    }

    const closeBtn = container.querySelector('#close-settings-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.settingsOpen = false;
        container.innerHTML = '';
      });
    }

    // Spotify Actions
    const testSpotifyBtn = container.querySelector('#test-spotify-api-btn');
    const testSpotifyOutput = container.querySelector('#test-spotify-api-output');
    if (testSpotifyBtn && testSpotifyOutput) {
      testSpotifyBtn.addEventListener('click', async () => {
        testSpotifyOutput.style.display = 'block';
        testSpotifyOutput.textContent = 'Calling https://api.spotify.com/v1/me...';
        try {
          const token = await spotifyAuth.getAccessToken();
          if (!token) {
            testSpotifyOutput.textContent = 'Error: No access token available. Please sign in with Spotify first.';
            return;
          }
          const res = await fetch('https://api.spotify.com/v1/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const text = await res.text();
          testSpotifyOutput.textContent = `HTTP ${res.status} ${res.statusText}\n${text}`;
          if (res.ok) {
            await this.loadUserProfile();
          }
        } catch (err) {
          testSpotifyOutput.textContent = `Fetch error: ${err.message}`;
        }
      });
    }

    const reauthSpotifyBtn = container.querySelector('#force-spotify-reauth-btn');
    if (reauthSpotifyBtn) {
      reauthSpotifyBtn.addEventListener('click', async () => {
        spotifyAuth.logout();
        this.settingsOpen = false;
        container.innerHTML = '';
        await spotifyAuth.startLogin();
      });
    }

    // YouTube Music Actions
    const testYTBtn = container.querySelector('#test-ytmusic-api-btn');
    const testYTOutput = container.querySelector('#test-ytmusic-api-output');
    if (testYTBtn && testYTOutput) {
      testYTBtn.addEventListener('click', async () => {
        testYTOutput.style.display = 'block';
        testYTOutput.textContent = 'Calling https://www.googleapis.com/oauth2/v2/userinfo...';
        try {
          const token = await ytmusicAuth.getAccessToken();
          if (!token) {
            testYTOutput.textContent = 'Error: No access token available. Please sign in with YouTube Music first.';
            return;
          }
          const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const text = await res.text();
          testYTOutput.textContent = `HTTP ${res.status} ${res.statusText}\n${text}`;
          if (res.ok) {
            await this.loadUserProfile();
          }
        } catch (err) {
          testYTOutput.textContent = `Fetch error: ${err.message}`;
        }
      });
    }

    const reauthYTBtn = container.querySelector('#force-ytmusic-reauth-btn');
    if (reauthYTBtn) {
      reauthYTBtn.addEventListener('click', async () => {
        ytmusicAuth.logout();
        this.settingsOpen = false;
        container.innerHTML = '';
        await ytmusicAuth.startLogin();
      });
    }

    // Save All Settings
    const saveBtn = container.querySelector('#save-settings-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const spotifyCidInput = container.querySelector('#settings-spotify-client-id');
        const spotifyRedirInput = container.querySelector('#settings-spotify-redirect-uri');
        if (spotifyCidInput) spotifyAuth.setClientId(spotifyCidInput.value);
        if (spotifyRedirInput) spotifyAuth.setRedirectUri(spotifyRedirInput.value);

        const ytCidInput = container.querySelector('#settings-ytmusic-client-id');
        const ytSecretInput = container.querySelector('#settings-ytmusic-client-secret');
        const ytRedirInput = container.querySelector('#settings-ytmusic-redirect-uri');
        if (ytCidInput) ytmusicAuth.setClientId(ytCidInput.value);
        if (ytSecretInput) ytmusicAuth.setClientSecret(ytSecretInput.value);
        if (ytRedirInput) ytmusicAuth.setRedirectUri(ytRedirInput.value);

        this.settingsOpen = false;
        container.innerHTML = '';
        notify('Settings saved successfully', 'success');

        const authBar = this.shadowRoot.querySelector('sso-auth-bar');
        if (authBar) await authBar.checkAuth();
      });
    }
  }

  /**
   * Renders a connected chain of Venn diagrams for each step in the pipeline.
   * Feeds the result of step i as the left operand into step i+1.
   * @param {import('../core/graph-engine.js').GraphEngine} graph
   * @param {import('../core/models.js').MusicCollection} baseCollection
   * @param {Array<import('../core/graph-engine.js').PipelineStep>} steps
   */
  renderVennPipeline(graph, baseCollection, steps) {
    const container = this.shadowRoot.querySelector('#venn-pipeline-container');
    if (!container) return;

    if (!baseCollection) {
      container.innerHTML = `
        <div class="empty-venn-placeholder">
          <div class="empty-icon">${SvgIcons.vennUnion(48, '#727272')}</div>
          <h3>Venn Diagram Visualizer</h3>
          <p>Add playlists or albums from the left or search above to visualize their set intersections.</p>
        </div>
      `;
      this.activeVennSteps = [];
      return;
    }

    if (!steps || steps.length === 0) {
      container.innerHTML = `
        <div class="empty-venn-placeholder">
          <div class="empty-icon">${SvgIcons.vennUnion(48, '#1db954')}</div>
          <h3>${baseCollection.name} (${baseCollection.trackCount} tracks)</h3>
          <p>Add a second collection to configure operations (Union, Intersection, Difference) and explore live Venn overlaps.</p>
        </div>
      `;
      this.activeVennSteps = [];
      return;
    }

    container.innerHTML = '';
    this.activeVennSteps = [];

    let currentCollection = baseCollection;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const rightCol = graph.getCollection(step.rightCollectionId);
      if (!rightCol) continue;

      // Add visual connector if not the first step
      if (i > 0) {
        const connector = document.createElement('div');
        connector.className = 'venn-flow-connector';
        connector.innerHTML = `
          <div class="flow-line"></div>
          <div class="flow-badge">
            <span class="flow-arrow">${SvgIcons.arrowDown(14)}</span>
            <span>Step ${i} Output (${currentCollection.trackCount} tracks) feeds into Step ${i + 1}</span>
          </div>
          <div class="flow-line"></div>
        `;
        container.appendChild(connector);
      }

      // Create Venn Diagram card for this step
      const vennCard = document.createElement('sso-venn-diagram');
      vennCard.setData({
        collectionA: currentCollection,
        collectionB: rightCol,
        operation: step.operation,
        stepNumber: i + 1,
        totalSteps: steps.length,
        stepIndex: i,
      });

      container.appendChild(vennCard);

      // Compute intermediate result for the next step
      const stepResultTracks = SetEngine.execute(
        step.operation,
        currentCollection.tracks,
        rightCol.tracks
      );

      this.activeVennSteps.push({
        stepIndex: i,
        collectionA: currentCollection,
        collectionB: rightCol,
        operation: step.operation,
        resultTracks: stepResultTracks,
        element: vennCard,
      });

      // Prepare left collection for the next step
      currentCollection = new MusicCollection({
        id: `step-${i}-result`,
        name: `Step ${i + 1} Result`,
        tracks: stepResultTracks,
        imageUrl: currentCollection.imageUrl || rightCol.imageUrl,
        type: CollectionType.PLAYLIST,
      });
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          min-height: 100vh;
          background: #121212;
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        .main-shell {
          max-width: 1300px;
          margin: 0 auto;
          padding: 24px 20px 48px;
        }
        .builder-layout {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .split-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .split-grid {
            grid-template-columns: 1fr;
          }
        }
        .venn-pipeline-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .venn-flow-connector {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 6px 0;
          position: relative;
        }
        .flow-line {
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
        }
        .flow-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #1e1e1e;
          border: 1px solid rgba(29, 185, 84, 0.4);
          padding: 5px 14px;
          border-radius: 20px;
          font-size: 0.78rem;
          font-weight: 600;
          color: #1db954;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          white-space: nowrap;
        }
        .flow-arrow {
          display: flex;
          align-items: center;
        }
        .empty-venn-placeholder {
          background: #181818;
          border: 1px dashed rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          padding: 48px 24px;
          text-align: center;
          color: #b3b3b3;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .empty-venn-placeholder .empty-icon {
          margin-bottom: 4px;
          opacity: 0.8;
        }
        .empty-venn-placeholder h3 {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 700;
          color: #ffffff;
        }
        .empty-venn-placeholder p {
          margin: 0;
          font-size: 0.85rem;
          color: #727272;
          max-width: 380px;
          line-height: 1.5;
        }
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          padding: 16px;
        }
        .modal-card {
          background: #181818;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          width: 100%;
          max-width: 500px;
          padding: 24px;
        }
        input {
          background: #242424;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          padding: 8px 12px;
          color: #ffffff;
          font-family: inherit;
          box-sizing: border-box;
        }
        input:focus {
          border-color: #1db954;
          outline: none;
        }
      </style>

      <sso-header></sso-header>

      <main class="main-shell">
        <sso-auth-bar style="margin-bottom: 24px;"></sso-auth-bar>

        <div class="builder-layout">
          <sso-source-search></sso-source-search>

          <div class="split-grid">
            <sso-visual-builder></sso-visual-builder>
            <div id="venn-pipeline-container" class="venn-pipeline-container"></div>
          </div>

          <sso-track-preview></sso-track-preview>
        </div>
      </main>

      <sso-export-modal></sso-export-modal>
      <sso-toast></sso-toast>
      <div id="settings-container"></div>
    `;
  }
}

customElements.define('sso-app', SsoApp);
