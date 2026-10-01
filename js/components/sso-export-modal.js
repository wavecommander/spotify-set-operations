/**
 * Export Modal Web Component (<sso-export-modal>)
 * Handles exporting the resulting track set back to Spotify or YouTube Music
 * with chunking, progress reporting, and dynamic provider branding.
 */

import { ProviderRegistry } from '../providers/provider-registry.js';
import { trackResolver } from '../core/track-resolver.js';
import { SvgIcons } from '../utils/svg-icons.js';
import { notify } from './sso-toast.js';

export class SsoExportModal extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.isOpen = false;
    this.tracks = [];
    this.isExporting = false;
    this.progress = { current: 0, total: 0 };
    this.createdPlaylist = null;
    this.selectedProviderId = 'spotify';
    this.currentDefaultName = 'Set Operations Mix';
    this.exportedCount = 0;
    this.failedCount = 0;
  }

  connectedCallback() {
    this.render();
    this.setupListeners();
  }

  open(tracks = [], defaultName = 'Set Operations Playlist') {
    this.tracks = tracks;
    this.isOpen = true;
    this.isExporting = false;
    this.createdPlaylist = null;
    this.exportedCount = 0;
    this.failedCount = 0;
    this.progress = { current: 0, total: tracks.length };
    this.currentDefaultName = defaultName;
    const active = ProviderRegistry.getActive();
    this.selectedProviderId = active ? active.id : 'spotify';
    this.render(defaultName);
    this.setupListeners();
  }

  close() {
    this.isOpen = false;
    this.render();
  }

  setupListeners() {
    if (!this.isOpen) return;

    const closeBtn = this.shadowRoot.querySelector('#close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    const cancelBtn = this.shadowRoot.querySelector('#cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.close());

    const backdrop = this.shadowRoot.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) this.close();
      });
    }

    const platformTabs = this.shadowRoot.querySelectorAll('.platform-tab');
    platformTabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        if (this.isExporting) return;
        this.selectedProviderId = e.currentTarget.dataset.provider;
        const nameVal = this.shadowRoot.querySelector('#playlist-name')?.value;
        const descVal = this.shadowRoot.querySelector('#playlist-desc')?.value;
        const pubVal = this.shadowRoot.querySelector('#playlist-public')?.checked;
        this.render(nameVal || this.currentDefaultName);
        this.setupListeners();
        if (descVal) {
          const descEl = this.shadowRoot.querySelector('#playlist-desc');
          if (descEl) descEl.value = descVal;
        }
        if (pubVal !== undefined) {
          const pubEl = this.shadowRoot.querySelector('#playlist-public');
          if (pubEl) pubEl.checked = pubVal;
        }
      });
    });

    const form = this.shadowRoot.querySelector('#export-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleExport();
      });
    }
  }

  async handleExport() {
    const provider = ProviderRegistry.get(this.selectedProviderId) || ProviderRegistry.getActive();
    if (!provider) {
      notify('No provider found for export', 'error');
      return;
    }

    const isAuthed = await provider.isAuthenticated();
    if (!isAuthed) {
      notify(`Please connect your ${provider.name} account before exporting.`, 'error', 6000);
      return;
    }

    const nameInput = this.shadowRoot.querySelector('#playlist-name');
    const descInput = this.shadowRoot.querySelector('#playlist-desc');
    const isPublicCheckbox = this.shadowRoot.querySelector('#playlist-public');

    const name = nameInput ? nameInput.value.trim() : 'Set Operations Playlist';
    const description = descInput ? descInput.value.trim() : '';
    const isPublic = isPublicCheckbox ? isPublicCheckbox.checked : false;

    this.isExporting = true;
    this.updateExportProgress(0, this.tracks.length);

    try {
      // 1. Two-stage resolution: resolve foreign cross-platform tracks if any exist
      const foreignCount = this.tracks.filter(
        (t) => !trackResolver.isNative(t, this.selectedProviderId)
      ).length;
      let tracksToExport = this.tracks;

      if (foreignCount > 0) {
        this.updateExportProgress(
          0,
          this.tracks.length,
          `Matching ${foreignCount} cross-platform tracks (0 / ${this.tracks.length})...`
        );

        const { resolvedTracks, failedTracks } = await trackResolver.resolveTracks(
          this.tracks,
          this.selectedProviderId,
          (cur, tot, t) => {
            this.updateExportProgress(
              cur,
              tot,
              `Matching cross-platform tracks: ${cur} / ${tot} (${t?.name || ''})`
            );
          }
        );
        tracksToExport = resolvedTracks;
        this.failedCount = failedTracks ? failedTracks.length : 0;
      } else {
        this.failedCount = 0;
      }

      if (tracksToExport.length === 0) {
        throw new Error(`None of the selected tracks could be resolved for export to ${provider.name}.`);
      }
      this.exportedCount = tracksToExport.length;

      // 2. Upload tracks to newly created destination playlist
      this.updateExportProgress(0, tracksToExport.length, `Creating playlist and uploading tracks...`);

      const result = await provider.createPlaylist({
        name,
        description,
        isPublic,
        tracks: tracksToExport,
        onProgress: (current, total) => {
          this.updateExportProgress(current, total, `Uploading tracks: ${current} / ${total}`);
        },
      });

      this.createdPlaylist = result;
      this.isExporting = false;
      this.renderSuccess();
      notify(`Successfully exported "${result.name}" to ${provider.name}!`, 'success');
    } catch (err) {
      this.isExporting = false;
      this.render(name);
      this.setupListeners();
      notify(`Export failed: ${err.message}`, 'error', 8000);
    }
  }

  updateExportProgress(current, total, customLabel = '') {
    this.progress = { current, total };
    const progressBar = this.shadowRoot.querySelector('#progress-bar');
    const progressLabel = this.shadowRoot.querySelector('#progress-label');
    if (progressBar && progressLabel) {
      const pct = total > 0 ? Math.round((current / total) * 100) : 0;
      progressBar.style.width = `${pct}%`;
      progressLabel.textContent = customLabel || `Uploading tracks: ${current} / ${total} (${pct}%)`;
    }
  }

  renderSuccess() {
    const body = this.shadowRoot.querySelector('.modal-card');
    if (!body || !this.createdPlaylist) return;

    const isYT = this.selectedProviderId === 'ytmusic';
    const providerName = isYT ? 'YouTube Music' : 'Spotify';
    const brandColor = isYT ? '#ff0000' : '#1db954';
    const brandTextColor = isYT ? '#ffffff' : '#000000';

    const countDisplay = this.exportedCount || this.tracks.length;
    const failedNotice =
      this.failedCount > 0
        ? `<div style="margin-top: 8px; font-size: 0.82rem; color: #f59e0b;">(${this.failedCount} tracks could not be matched on ${providerName} and were skipped)</div>`
        : '';

    body.innerHTML = `
      <div style="text-align: center; padding: 24px 10px;">
        <div style="color: ${brandColor}; margin-bottom: 12px;">
          ${SvgIcons.vennUnion(52, brandColor)}
        </div>
        <h2 style="color: #ffffff; font-size: 1.3rem; margin-bottom: 8px;">Playlist Created!</h2>
        <p style="color: #b3b3b3; font-size: 0.9rem; margin-bottom: 24px;">
          "${this.createdPlaylist.name}" with ${countDisplay} tracks has been created on your ${providerName} account.
          ${failedNotice}
        </p>

        <div style="display: flex; gap: 12px; justify-content: center;">
          <a
            href="${this.createdPlaylist.externalUrl}"
            target="_blank"
            rel="noopener noreferrer"
            style="display: inline-flex; align-items: center; gap: 6px; padding: 10px 22px; border-radius: 20px; background: ${brandColor}; color: ${brandTextColor}; font-weight: 700; text-decoration: none; font-size: 0.9rem;"
          >
            Open in ${providerName} ↗
          </a>
          <button id="done-btn" style="padding: 10px 20px; border-radius: 20px; background: #282828; color: #ffffff; border: 1px solid rgba(255,255,255,0.1); font-weight: 600; cursor: pointer;">
            Close
          </button>
        </div>
      </div>
    `;

    const doneBtn = this.shadowRoot.querySelector('#done-btn');
    if (doneBtn) doneBtn.addEventListener('click', () => this.close());
  }

  render(defaultName = 'Set Operations Mix') {
    if (!this.isOpen) {
      this.shadowRoot.innerHTML = '';
      return;
    }

    const isYT = this.selectedProviderId === 'ytmusic';
    const providerName = isYT ? 'YouTube Music' : 'Spotify';
    const brandColor = isYT ? '#ff0000' : '#1db954';
    const brandColorHover = isYT ? '#ff3333' : '#1ed760';
    const brandTextColor = isYT ? '#ffffff' : '#000000';

    this.shadowRoot.innerHTML = `
      <style>
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 16px;
        }
        .modal-card {
          background: #181818;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          width: 100%;
          max-width: 480px;
          padding: 24px;
          color: #ffffff;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
          position: relative;
        }
        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
        }
        .modal-title {
          font-size: 1.15rem;
          font-weight: 700;
        }
        .close-btn {
          color: #727272;
          background: transparent;
          border: none;
          cursor: pointer;
        }
        .close-btn:hover {
          color: #ffffff;
        }
        .form-group {
          margin-bottom: 16px;
        }
        .platform-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }
        .platform-tab {
          flex: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 8px 14px;
          border-radius: 8px;
          background: #242424;
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #b3b3b3;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .platform-tab.active[data-provider="spotify"] {
          background: rgba(29, 185, 84, 0.15);
          border-color: #1db954;
          color: #1db954;
        }
        .platform-tab.active[data-provider="ytmusic"] {
          background: rgba(255, 0, 0, 0.15);
          border-color: #ff0000;
          color: #ff4d4d;
        }
        label {
          display: block;
          font-size: 0.82rem;
          font-weight: 600;
          color: #b3b3b3;
          margin-bottom: 6px;
        }
        input[type="text"], textarea {
          width: 100%;
          box-sizing: border-box;
          background: #242424;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          padding: 10px 12px;
          color: #ffffff;
          font-size: 0.9rem;
          font-family: inherit;
        }
        input[type="text"]:focus, textarea:focus {
          border-color: ${brandColor};
          outline: none;
        }
        .checkbox-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.85rem;
          color: #b3b3b3;
          cursor: pointer;
        }
        .progress-track {
          width: 100%;
          height: 8px;
          background: #242424;
          border-radius: 4px;
          overflow: hidden;
          margin-top: 12px;
        }
        .progress-fill {
          height: 100%;
          background: ${brandColor};
          width: 0%;
          transition: width 0.2s ease;
        }
        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
        }
        .btn-cancel {
          padding: 8px 18px;
          background: transparent;
          color: #b3b3b3;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-submit {
          padding: 8px 22px;
          background: ${brandColor};
          color: ${brandTextColor};
          border: none;
          border-radius: 20px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .btn-submit:hover:not(:disabled) {
          background: ${brandColorHover};
        }
        .btn-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      </style>

      <div class="modal-backdrop">
        <div class="modal-card">
          <div class="modal-header">
            <div class="modal-title">Export to ${providerName}</div>
            <button id="close-btn" class="close-btn">${SvgIcons.close(20)}</button>
          </div>

          <form id="export-form">
            <div class="form-group">
              <label>Destination Service</label>
              <div class="platform-tabs">
                <button type="button" class="platform-tab ${this.selectedProviderId === 'spotify' ? 'active' : ''}" data-provider="spotify" ${this.isExporting ? 'disabled' : ''}>
                  ${SvgIcons.spotify(16)} Spotify
                </button>
                <button type="button" class="platform-tab ${this.selectedProviderId === 'ytmusic' ? 'active' : ''}" data-provider="ytmusic" ${this.isExporting ? 'disabled' : ''}>
                  ${SvgIcons.ytmusic(16)} YouTube Music
                </button>
              </div>
            </div>

            <div class="form-group">
              <label for="playlist-name">Playlist Name</label>
              <input id="playlist-name" type="text" value="${defaultName}" required ${this.isExporting ? 'disabled' : ''} />
            </div>

            <div class="form-group">
              <label for="playlist-desc">Description</label>
              <textarea id="playlist-desc" rows="2" placeholder="Generated with Music Sets, by Tactile Software" ${this.isExporting ? 'disabled' : ''}></textarea>
            </div>

            <div class="form-group">
              <label class="checkbox-row">
                <input id="playlist-public" type="checkbox" ${this.isExporting ? 'disabled' : ''} />
                <span>Make playlist public</span>
              </label>
            </div>

            <div style="font-size: 0.8rem; color: #727272; margin-top: 10px;">
              Will export <strong>${this.tracks.length}</strong> unique tracks to your <strong>${providerName}</strong> account.
            </div>

            ${
              this.isExporting
                ? `
              <div style="margin-top: 16px;">
                <div id="progress-label" style="font-size: 0.82rem; color: ${brandColor}; font-weight: 600;">
                  Uploading tracks...
                </div>
                <div class="progress-track">
                  <div id="progress-bar" class="progress-fill"></div>
                </div>
              </div>
            `
                : ''
            }

            <div class="modal-actions">
              <button type="button" class="btn-cancel" id="cancel-btn" ${this.isExporting ? 'disabled' : ''}>Cancel</button>
              <button type="submit" class="btn-submit" ${this.isExporting ? 'disabled' : ''}>
                ${this.isExporting ? 'Exporting...' : 'Create Playlist'}
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }
}

customElements.define('sso-export-modal', SsoExportModal);
