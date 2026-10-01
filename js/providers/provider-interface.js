/**
 * Abstract MusicProvider Interface.
 * Any music service (Spotify, YouTube Music, Apple Music, etc.) must implement this interface.
 */

export class MusicProvider {
  /**
   * Unique identifier of the provider (e.g. 'spotify', 'ytmusic').
   * @returns {string}
   */
  get id() {
    throw new Error('MusicProvider: id must be implemented');
  }

  /**
   * Human-readable display name.
   * @returns {string}
   */
  get name() {
    throw new Error('MusicProvider: name must be implemented');
  }

  /**
   * SVG or image icon string.
   * @returns {string}
   */
  get icon() {
    return '';
  }

  /**
   * Whether the user is currently authenticated with this provider.
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    throw new Error('MusicProvider: isAuthenticated must be implemented');
  }

  /**
   * Initiates provider authentication flow (e.g. OAuth PKCE redirect or popup).
   * @returns {Promise<void>}
   */
  async login() {
    throw new Error('MusicProvider: login must be implemented');
  }

  /**
   * Clears authentication credentials for this provider.
   * @returns {Promise<void>}
   */
  async logout() {
    throw new Error('MusicProvider: logout must be implemented');
  }

  /**
   * Returns current user's profile.
   * @returns {Promise<import('../core/models.js').UserProfile>}
   */
  async getUserProfile() {
    throw new Error('MusicProvider: getUserProfile must be implemented');
  }

  /**
   * Searches for playlists and albums.
   * @param {string} query
   * @param {Array<'playlist'|'album'>} [types]
   * @returns {Promise<{ playlists: Array<Object>, albums: Array<Object> }>}
   */
  async search(query, types = ['playlist', 'album']) {
    throw new Error('MusicProvider: search must be implemented');
  }

  /**
   * Fetches full playlist contents with all tracks (paginated).
   * @param {string} id - Native provider playlist ID or URI
   * @param {Function} [onProgress] - Optional callback(loadedTracks, totalTracks)
   * @returns {Promise<import('../core/models.js').MusicCollection>}
   */
  async getPlaylist(id, onProgress) {
    throw new Error('MusicProvider: getPlaylist must be implemented');
  }

  /**
   * Fetches full album contents with all tracks.
   * @param {string} id - Native provider album ID or URI
   * @param {Function} [onProgress] - Optional callback(loadedTracks, totalTracks)
   * @returns {Promise<import('../core/models.js').MusicCollection>}
   */
  async getAlbum(id, onProgress) {
    throw new Error('MusicProvider: getAlbum must be implemented');
  }

  /**
   * Creates a new playlist containing the specified tracks.
   * @param {Object} options
   * @param {string} options.name
   * @param {string} [options.description]
   * @param {boolean} [options.isPublic]
   * @param {import('../core/models.js').Track[]} options.tracks
   * @param {Function} [options.onProgress] - Callback(addedCount, totalCount)
   * @returns {Promise<{ id: string, name: string, externalUrl: string }>}
   */
  async createPlaylist({ name, description = '', isPublic = false, tracks, onProgress }) {
    throw new Error('MusicProvider: createPlaylist must be implemented');
  }

  /**
   * Replaces tracks on an existing playlist.
   * @param {Object} options
   * @param {string} options.playlistId
   * @param {import('../core/models.js').Track[]} options.tracks
   * @param {Function} [options.onProgress]
   * @returns {Promise<void>}
   */
  async replacePlaylistTracks({ playlistId, tracks, onProgress }) {
    throw new Error('MusicProvider: replacePlaylistTracks must be implemented');
  }
}
