/**
 * Track Preview Table Component (<sso-track-preview>)
 * Displays resulting tracks with cover art, duration, metadata, and origin provenance badges.
 */

import { SvgIcons } from '../utils/svg-icons.js';

export class SsoTrackPreview extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.tracks = [];
    this.trackSources = new Map();
    this.collectionNameMap = new Map(); // id -> friendly name
    this.filterQuery = '';
    this.pageSize = 50;
    this.currentPage = 1;
  }

  connectedCallback() {
    this.render();
    this.setupListeners();
  }

  /**
   * Sets preview data.
   * @param {Object} options
   * @param {import('../core/models.js').Track[]} options.tracks
   * @param {Map<string, Set<string>>} [options.trackSources]
   * @param {Map<string, string>} [options.collectionNameMap]
   */
  setData({ tracks, trackSources = new Map(), collectionNameMap = new Map() }) {
    this.tracks = tracks || [];
    this.trackSources = trackSources;
    this.collectionNameMap = collectionNameMap;
    this.currentPage = 1;
    this.render();
    this.setupListeners();
  }

  setupListeners() {
    const filterInput = this.shadowRoot.querySelector('#filter-input');
    if (filterInput) {
      filterInput.addEventListener('input', (e) => {
        this.filterQuery = e.target.value.toLowerCase().trim();
        this.currentPage = 1;
        this.renderTableBody();
      });
    }

    const exportBtn = this.shadowRoot.querySelector('#export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.dispatchEvent(
          new CustomEvent('request-export', {
            bubbles: true,
            detail: { tracks: this.getFilteredTracks() },
          })
        );
      });
    }

    const loadMoreBtn = this.shadowRoot.querySelector('#load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        this.currentPage++;
        this.renderTableBody();
      });
    }
  }

  getFilteredTracks() {
    if (!this.filterQuery) return this.tracks;
    return this.tracks.filter((t) => {
      const titleMatch = (t.name || '').toLowerCase().includes(this.filterQuery);
      const artistMatch = t.artistString.toLowerCase().includes(this.filterQuery);
      const albumMatch = (t.albumName || '').toLowerCase().includes(this.filterQuery);
      return titleMatch || artistMatch || albumMatch;
    });
  }

  renderTableBody() {
    const tableBody = this.shadowRoot.querySelector('#tracks-body');
    const countLabel = this.shadowRoot.querySelector('#result-count-label');
    const loadMoreContainer = this.shadowRoot.querySelector('#load-more-container');
    if (!tableBody) return;

    const filtered = this.getFilteredTracks();
    const visibleCount = this.currentPage * this.pageSize;
    const paginated = filtered.slice(0, visibleCount);

    if (countLabel) {
      countLabel.textContent = `${filtered.length} track${filtered.length === 1 ? '' : 's'}${
        this.filterQuery ? ` (filtered from ${this.tracks.length})` : ''
      }`;
    }

    if (paginated.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-cell">
            ${this.tracks.length === 0 ? 'No tracks in current operation result.' : 'No tracks match your filter.'}
          </td>
        </tr>
      `;
      if (loadMoreContainer) loadMoreContainer.style.display = 'none';
      return;
    }

    tableBody.innerHTML = paginated
      .map((track, i) => {
        const sources = this.trackSources.get(track.identityKey);
        const sourceBadges = sources
          ? Array.from(sources)
              .map((id) => {
                const name = this.collectionNameMap.get(id) || id.split(':').pop();
                return `<span class="source-tag" title="${name}">${name}</span>`;
              })
              .join('')
          : '';

        const isYT =
          track.platform === 'ytmusic' ||
          (track.uri && (track.uri.includes('music.youtube.com') || track.uri.includes('youtu.be')));
        const platformBadge = isYT
          ? `<span class="platform-badge yt-badge" title="YouTube Music">${SvgIcons.ytmusic(11)}</span>`
          : `<span class="platform-badge sp-badge" title="Spotify">${SvgIcons.spotify(11)}</span>`;

        const trackTitleHtml = track.uri
          ? `<a href="${track.uri}" target="_blank" rel="noopener noreferrer" class="track-link" title="${track.name}">${track.name}</a>`
          : `<span class="track-name" title="${track.name}">${track.name}</span>`;

        return `
          <tr class="track-row">
            <td class="col-num">${i + 1}</td>
            <td class="col-title">
              <div class="track-identity">
                <img class="track-art" src="${track.albumArtUrl || ''}" alt="" onerror="this.style.opacity='0.2'" />
                <div class="track-details">
                  <div class="track-name-row">
                    ${trackTitleHtml}
                    ${platformBadge}
                  </div>
                  <div class="track-artists" title="${track.artistString}">${track.artistString}</div>
                </div>
              </div>
            </td>
            <td class="col-album">${track.albumName || '—'}</td>
            <td class="col-sources">${sourceBadges}</td>
            <td class="col-duration">${track.durationFormatted}</td>
          </tr>
        `;
      })
      .join('');

    if (loadMoreContainer) {
      loadMoreContainer.style.display = visibleCount < filtered.length ? 'block' : 'none';
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .preview-card {
          background: #181818;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .preview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }
        .title-section {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .title-text {
          font-size: 1.1rem;
          font-weight: 700;
          color: #ffffff;
        }
        .count-badge {
          background: #242424;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 2px 10px;
          font-size: 0.8rem;
          color: #b3b3b3;
          font-weight: 600;
        }
        .actions-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .filter-field {
          background: #242424;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 6px 14px;
          color: #ffffff;
          font-size: 0.85rem;
          width: 220px;
        }
        .btn-export {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 18px;
          background: #1db954;
          color: #000000;
          font-weight: 700;
          border-radius: 20px;
          border: none;
          cursor: pointer;
          font-size: 0.85rem;
          transition: all 0.15s ease;
        }
        .btn-export:hover:not(:disabled) {
          background: #1ed760;
          transform: scale(1.02);
        }
        .btn-export:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* Table */
        .table-wrapper {
          overflow-x: auto;
          max-height: 480px;
          overflow-y: auto;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
        }
        th {
          text-align: left;
          padding: 8px 12px;
          color: #727272;
          font-weight: 600;
          text-transform: uppercase;
          font-size: 0.72rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          position: sticky;
          top: 0;
          background: #181818;
          z-index: 2;
        }
        td {
          padding: 10px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          color: #b3b3b3;
        }
        .track-row:hover td {
          background: #222222;
          color: #ffffff;
        }
        .col-num {
          width: 40px;
          color: #727272;
          text-align: center;
        }
        .col-title {
          min-width: 240px;
        }
        .track-identity {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .track-art {
          width: 40px;
          height: 40px;
          border-radius: 4px;
          object-fit: cover;
          background: #242424;
          flex-shrink: 0;
        }
        .track-details {
          min-width: 0;
        }
        .track-name-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .track-name, .track-link {
          font-weight: 600;
          color: #ffffff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-decoration: none;
        }
        .track-link:hover {
          text-decoration: underline;
          color: #1ed760;
        }
        .platform-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 2px 4px;
          border-radius: 4px;
          flex-shrink: 0;
        }
        .platform-badge.sp-badge {
          background: rgba(29, 185, 84, 0.18);
          color: #1db954;
        }
        .platform-badge.yt-badge {
          background: rgba(255, 0, 0, 0.18);
          color: #ff4d4d;
        }
        .track-artists {
          font-size: 0.78rem;
          color: #b3b3b3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .col-album {
          max-width: 200px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .col-sources {
          min-width: 140px;
        }
        .source-tag {
          display: inline-block;
          background: #2a2a2a;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 0.7rem;
          color: #b3b3b3;
          margin-right: 4px;
          margin-bottom: 2px;
          max-width: 120px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .col-duration {
          width: 70px;
          text-align: right;
          font-family: monospace;
        }
        .empty-cell {
          text-align: center;
          padding: 40px 20px;
          color: #727272;
        }
        .load-more-btn {
          margin: 16px auto 0;
          display: block;
          padding: 6px 18px;
          border-radius: 20px;
          background: #242424;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #b3b3b3;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
        }
        .load-more-btn:hover {
          background: #2c2c2c;
          color: #ffffff;
        }
      </style>

      <div class="preview-card">
        <div class="preview-header">
          <div class="title-section">
            <span class="title-text">Resulting Track Set</span>
            <span id="result-count-label" class="count-badge">${this.tracks.length} tracks</span>
          </div>

          <div class="actions-section">
            <input id="filter-input" class="filter-field" type="text" placeholder="Filter by title or artist..." />
            <button id="export-btn" class="btn-export" ${this.tracks.length === 0 ? 'disabled' : ''}>
              ${SvgIcons.exportIcon(16)} Export Playlist
            </button>
          </div>
        </div>

        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th class="col-num">#</th>
                <th class="col-title">Title</th>
                <th class="col-album">Album</th>
                <th class="col-sources">From Collection</th>
                <th class="col-duration">Time</th>
              </tr>
            </thead>
            <tbody id="tracks-body"></tbody>
          </table>
        </div>

        <div id="load-more-container" style="display: none;">
          <button id="load-more-btn" class="load-more-btn">Load More Tracks</button>
        </div>
      </div>
    `;
    this.renderTableBody();
  }
}

customElements.define('sso-track-preview', SsoTrackPreview);
