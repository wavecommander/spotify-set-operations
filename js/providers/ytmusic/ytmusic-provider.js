/**
 * YouTube Music Provider
 * Integrates Google OAuth 2.0 PKCE authentication and YouTube Data API v3 into MusicProvider interface.
 */

import { MusicProvider } from '../provider-interface.js';
import { ytmusicAuth } from './ytmusic-auth.js';
import { ytmusicApi } from './ytmusic-api.js';
import { MusicPlatform } from '../../core/models.js';

export class YTMusicProvider extends MusicProvider {
  get id() {
    return MusicPlatform.YTMUSIC;
  }

  get name() {
    return 'YouTube Music';
  }

  get icon() {
    return `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104 0-3.924 3.18-7.104 7.104-7.104 3.924 0 7.104 3.18 7.104 7.104 0 3.924-3.18 7.104-7.104 7.104zm0-11.784c-2.58 0-4.68 2.1-4.68 4.68s2.1 4.68 4.68 4.68 4.68-2.1 4.68-4.68-2.1-4.68-4.68-4.68zm-1.2 6.72V9.864l3.6 2.088-3.6 2.088z"/>
    </svg>`;
  }

  get auth() {
    return ytmusicAuth;
  }

  get api() {
    return ytmusicApi;
  }

  async isAuthenticated() {
    return ytmusicAuth.isAuthenticated();
  }

  async login() {
    return ytmusicAuth.startLogin();
  }

  async logout() {
    return ytmusicAuth.logout();
  }

  async getUserProfile() {
    return ytmusicApi.getCurrentUserProfile();
  }

  async search(query, types = ['playlist', 'album']) {
    return ytmusicApi.search(query, types);
  }

  async getPlaylist(id, onProgress) {
    return ytmusicApi.getPlaylist(id, onProgress);
  }

  async getAlbum(id, onProgress) {
    return ytmusicApi.getAlbum(id, onProgress);
  }

  async createPlaylist(options) {
    return ytmusicApi.createPlaylist(options);
  }

  async replacePlaylistTracks(options) {
    return ytmusicApi.replacePlaylistTracks(options);
  }
}

export const ytMusicProvider = new YTMusicProvider();
