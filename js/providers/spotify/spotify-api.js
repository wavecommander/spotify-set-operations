/**
 * Spotify Web API Client
 * Features paginated ingestion, rate limit handling, batch track writing, and single-track fallback.
 */

import { spotifyAuth } from './spotify-auth.js';
import { Track, MusicCollection, CollectionType, UserProfile, MusicPlatform } from '../../core/models.js';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

export class SpotifyApi {
  /**
   * Helper for authenticated fetch with automatic token retrieval and error handling.
   * @param {string} endpoint - API path or full URL
   * @param {RequestInit} [options]
   * @returns {Promise<any>}
   */
  async request(endpoint, options = {}) {
    const token = await spotifyAuth.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated with Spotify');
    }

    const url = endpoint.startsWith('http') ? endpoint : `${SPOTIFY_API_BASE}${endpoint}`;
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    const response = await fetch(url, { ...options, headers });

    // Handle Rate Limiting (429)
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
      await new Promise((resolve) => setTimeout(resolve, (retryAfter + 0.5) * 1000));
      return this.request(endpoint, options);
    }

    if (response.status === 204) {
      return null;
    }

    if (!response.ok) {
      let errorMsg = `Spotify API error: ${response.status} ${response.statusText}`;
      let errorData = null;
      try {
        errorData = await response.json();
        console.warn('Spotify API Error details:', response.status, url, errorData);
        if (errorData.error?.message) {
          errorMsg = errorData.error.message;
        }
      } catch (_) {}

      if (response.status === 403) {
        console.warn('403 Forbidden received. If in Spotify Developer Mode, ensure your account is in "Users and Access" and scopes include user-read-private.');
      }

      const err = new Error(errorMsg);
      err.status = response.status;
      err.data = errorData;
      throw err;
    }

    return response.json();
  }

  /**
   * Extracts clean ID and type from URL, URI, or plain ID string.
   * Examples:
   *  - https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=... -> { type: 'playlist', id: '37i9dQZF1DXcBWIGoYBM5M' }
   *  - spotify:album:2REb6YDnp5qH9IIkMza580 -> { type: 'album', id: '2REb6YDnp5qH9IIkMza580' }
   *  - 37i9dQZF1DXcBWIGoYBM5M -> { type: defaultType, id: '37i9dQZF1DXcBWIGoYBM5M' }
   * @param {string} input
   * @param {'playlist'|'album'} [defaultType]
   * @returns {{ id: string, type: 'playlist'|'album' }}
   */
  static parseSpotifyId(input, defaultType = 'playlist') {
    if (!input || typeof input !== 'string') {
      return { id: '', type: defaultType };
    }
    const trimmed = input.trim();

    // Check Spotify URL
    const urlMatch = trimmed.match(/open\.spotify\.com\/(playlist|album)\/([a-zA-Z0-9]+)/);
    if (urlMatch) {
      return { type: urlMatch[1], id: urlMatch[2] };
    }

    // Check Spotify URI
    const uriMatch = trimmed.match(/spotify:(playlist|album):([a-zA-Z0-9]+)/);
    if (uriMatch) {
      return { type: uriMatch[1], id: uriMatch[2] };
    }

    // Plain ID string
    return { id: trimmed.split('?')[0], type: defaultType };
  }

  /**
   * Gets current authenticated user profile.
   * @returns {Promise<UserProfile>}
   */
  async getCurrentUserProfile() {
    const data = await this.request('/me');
    return new UserProfile({
      id: data.id,
      displayName: data.display_name || data.id,
      imageUrl: data.images?.[0]?.url || '',
      platform: MusicPlatform.SPOTIFY,
    });
  }

  /**
   * Searches for playlists and albums.
   * @param {string} query
   * @param {Array<'playlist'|'album'>} [types]
   * @returns {Promise<{ playlists: Object[], albums: Object[] }>}
   */
  async search(query, types = ['playlist', 'album'], limit = 10) {
    if (!query || !query.trim()) {
      return { playlists: [], albums: [] };
    }
    const typeStr = types.join(',');
    const encodedQuery = encodeURIComponent(query.trim());
    const validLimit = Math.min(Math.max(1, limit), 10);
    const data = await this.request(`/search?q=${encodedQuery}&type=${typeStr}&limit=${validLimit}`);

    const playlists = (data.playlists?.items || []).filter(Boolean).map((item) => ({
      id: `spotify:playlist:${item.id}`,
      rawId: item.id,
      name: item.name,
      owner: item.owner?.display_name || 'Spotify',
      imageUrl: item.images?.[0]?.url || '',
      totalTracks:
        item.tracks?.total ??
        item.items?.total ??
        item.total_tracks ??
        (Array.isArray(item.tracks) ? item.tracks.length : Array.isArray(item.items) ? item.items.length : 0),
      type: CollectionType.PLAYLIST,
      platform: MusicPlatform.SPOTIFY,
    }));

    const albums = (data.albums?.items || []).filter(Boolean).map((item) => ({
      id: `spotify:album:${item.id}`,
      rawId: item.id,
      name: item.name,
      owner: (item.artists || []).map((a) => (typeof a === 'string' ? a : a.name)).join(', '),
      imageUrl: item.images?.[0]?.url || '',
      totalTracks: item.total_tracks || item.tracks?.total || 0,
      type: CollectionType.ALBUM,
      platform: MusicPlatform.SPOTIFY,
    }));

    return { playlists, albums };
  }

  /**
   * Searches Spotify specifically for individual tracks.
   * @param {string} query
   * @param {number} [limit]
   * @returns {Promise<Track[]>}
   */
  async searchTracks(query, limit = 5) {
    if (!query || !query.trim()) {
      return [];
    }
    const encoded = encodeURIComponent(query.trim());
    const validLimit = Math.min(Math.max(1, limit), 10);
    const data = await this.request(`/search?q=${encoded}&type=track&limit=${validLimit}`);
    const items = data.tracks?.items || [];
    return items.filter(Boolean).map((t) => Track.fromSpotify(t)).filter(Boolean);
  }

  /**
   * Fetches full playlist contents with pagination.
   * Handles all variations of Spotify playlist endpoints and item wrappers.
   * @param {string} rawIdOrInput
   * @param {Function} [onProgress]
   * @returns {Promise<MusicCollection>}
   */
  async getPlaylist(rawIdOrInput, onProgress) {
    const { id: playlistId } = SpotifyApi.parseSpotifyId(rawIdOrInput, 'playlist');
    if (!playlistId) throw new Error('Invalid playlist ID');

    // Fetch playlist metadata
    let playlist = null;
    try {
      playlist = await this.request(`/playlists/${playlistId}`);
    } catch (err) {
      console.warn(`Direct /playlists/${playlistId} metadata fetch warning:`, err);
    }

    const backendId = `spotify:playlist:${playlistId}`;
    const name = playlist?.name || 'Untitled Playlist';
    const owner = playlist?.owner?.display_name || playlist?.owner?.id || '';
    const imageUrl = playlist?.images?.[0]?.url || '';
    const reportedTotal =
      playlist?.items?.total ??
      playlist?.tracks?.total ??
      playlist?.total_tracks ??
      (Array.isArray(playlist?.items) ? playlist.items.length : 0);

    const collection = new MusicCollection({
      id: backendId,
      name,
      type: CollectionType.PLAYLIST,
      owner,
      imageUrl,
      platform: MusicPlatform.SPOTIFY,
      totalCount: reportedTotal,
    });

    // Check where the tracks/items paging object is located:
    // Spotify API variations:
    // 1. playlist.items (as Paging object { items: [], next: ... } in 2025/2026 API)
    // 2. playlist.tracks (as Paging object { items: [], next: ... } in classic API)
    // 3. playlist.items (as direct Array)
    let currentPaging = null;

    if (playlist) {
      if (playlist.items && Array.isArray(playlist.items.items)) {
        currentPaging = playlist.items;
      } else if (playlist.tracks && Array.isArray(playlist.tracks.items)) {
        currentPaging = playlist.tracks;
      } else if (Array.isArray(playlist.items)) {
        currentPaging = { items: playlist.items, next: null };
      } else if (Array.isArray(playlist.tracks)) {
        currentPaging = { items: playlist.tracks, next: null };
      }
    }

    // If playlist response did not embed track items, fetch from playlist items/tracks endpoint directly
    if (!currentPaging || !Array.isArray(currentPaging.items) || currentPaging.items.length === 0) {
      const endpointsToTry = [
        `/playlists/${playlistId}/items?limit=50`,
        `/playlists/${playlistId}/tracks?limit=50`,
      ];
      for (const ep of endpointsToTry) {
        try {
          const res = await this.request(ep);
          if (res && (Array.isArray(res.items) || Array.isArray(res))) {
            currentPaging = Array.isArray(res) ? { items: res, next: null } : res;
            break;
          }
        } catch (e) {
          console.warn(`Playlist endpoint ${ep} failed:`, e.message);
        }
      }
    }

    let loadedCount = 0;
    const totalCount = reportedTotal || currentPaging?.total || 0;

    while (currentPaging) {
      const items = Array.isArray(currentPaging.items)
        ? currentPaging.items
        : Array.isArray(currentPaging)
        ? currentPaging
        : [];

      for (const entry of items) {
        if (!entry) continue;

        // Support all Spotify track packaging variants:
        // - entry.track (standard playlist item)
        // - entry.item (2025/2026 items endpoint)
        // - entry itself (if item is already a Track object, identical to albums)
        const rawTrack = entry.track || entry.item || (entry.id ? entry : null);
        if (!rawTrack || !rawTrack.id) continue;
        if (rawTrack.is_local || entry.is_local) continue;

        const track = Track.fromSpotify(rawTrack);
        if (track) collection.addTrack(track);
      }

      loadedCount += items.length;
      if (typeof onProgress === 'function') {
        onProgress(Math.min(loadedCount, totalCount || loadedCount), totalCount || loadedCount);
      }

      // Handle next page
      if (currentPaging.next) {
        try {
          currentPaging = await this.request(currentPaging.next);
        } catch (err) {
          console.warn('Failed to load next page of playlist tracks:', err);
          currentPaging = null;
        }
      } else {
        currentPaging = null;
      }
    }

    // Update totalCount with actual retrieved tracks if original was 0 or missing
    if (collection.totalCount === 0 || collection.totalCount < collection.trackCount) {
      collection.totalCount = collection.trackCount;
    }

    return collection;
  }

  /**
   * Fetches full album contents with pagination.
   * @param {string} rawIdOrInput
   * @param {Function} [onProgress]
   * @returns {Promise<MusicCollection>}
   */
  async getAlbum(rawIdOrInput, onProgress) {
    const { id: albumId } = SpotifyApi.parseSpotifyId(rawIdOrInput, 'album');
    if (!albumId) throw new Error('Invalid album ID');

    const album = await this.request(`/albums/${albumId}`);
    const backendId = `spotify:album:${albumId}`;

    const collection = new MusicCollection({
      id: backendId,
      name: album.name || 'Untitled Album',
      type: CollectionType.ALBUM,
      owner: (album.artists || []).map((a) => (typeof a === 'string' ? a : a.name)).join(', '),
      imageUrl: album.images?.[0]?.url || '',
      platform: MusicPlatform.SPOTIFY,
      totalCount: album.total_tracks || album.tracks?.total || 0,
    });

    let currentTracks = album.tracks || album.items;
    let loadedCount = 0;
    const totalCount = album.total_tracks || album.tracks?.total || 0;

    while (currentTracks) {
      const items = Array.isArray(currentTracks.items)
        ? currentTracks.items
        : Array.isArray(currentTracks)
        ? currentTracks
        : [];

      for (const item of items) {
        if (!item) continue;
        // Inject album metadata into track item for consistency if missing
        if (!item.album) {
          item.album = { name: album.name, images: album.images };
        }
        const track = Track.fromSpotify(item);
        if (track) collection.addTrack(track);
      }

      loadedCount += items.length;
      if (typeof onProgress === 'function') {
        onProgress(Math.min(loadedCount, totalCount || loadedCount), totalCount || loadedCount);
      }

      if (currentTracks.next) {
        try {
          currentTracks = await this.request(currentTracks.next);
        } catch (_) {
          currentTracks = null;
        }
      } else {
        currentTracks = null;
      }
    }

    if (collection.totalCount === 0 || collection.totalCount < collection.trackCount) {
      collection.totalCount = collection.trackCount;
    }

    return collection;
  }

  /**
   * Creates a new playlist and populates it with tracks using 100-item chunks.
   * If a batch fails, retries tracks individually to avoid loss of playable songs.
   * @param {Object} options
   * @param {string} options.name
   * @param {string} [options.description]
   * @param {boolean} [options.isPublic]
   * @param {Track[]} options.tracks
   * @param {Function} [options.onProgress]
   * @returns {Promise<{ id: string, name: string, externalUrl: string }>}
   */
  async createPlaylist({ name, description = '', isPublic = false, tracks, onProgress }) {
    let created;
    const body = JSON.stringify({
      name: name || 'Music Set Operations Playlist',
      description: description || 'Generated with Music Set Operations, by Tactile Software',
      public: isPublic,
    });

    try {
      created = await this.request('/me/playlists', {
        method: 'POST',
        body,
      });
    } catch (_) {
      const profile = await this.getCurrentUserProfile();
      created = await this.request(`/users/${profile.id}/playlists`, {
        method: 'POST',
        body,
      });
    }

    if (tracks && tracks.length > 0) {
      await this.addTracksToPlaylist(created.id, tracks, onProgress);
    }

    return {
      id: created.id,
      name: created.name,
      externalUrl: created.external_urls?.spotify || `https://open.spotify.com/playlist/${created.id}`,
    };
  }

  /**
   * Adds tracks to an existing playlist in chunks with individual fallback.
   * Supports both 2026 /items and legacy /tracks endpoints.
   * @param {string} playlistId
   * @param {Track[]} tracks
   * @param {Function} [onProgress]
   */
  async addTracksToPlaylist(playlistId, tracks, onProgress) {
    const uris = tracks
      .map((t) => t.uri || `spotify:track:${t.id}`)
      .filter((uri) => uri && uri.startsWith('spotify:track:'));

    const CHUNK_SIZE = 100;
    let added = 0;

    for (let i = 0; i < uris.length; i += CHUNK_SIZE) {
      const chunk = uris.slice(i, i + CHUNK_SIZE);
      const postItems = async (endpoint, payload) => {
        return this.request(endpoint, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      };

      try {
        try {
          await postItems(`/playlists/${playlistId}/items`, { uris: chunk });
        } catch (_) {
          await postItems(`/playlists/${playlistId}/tracks`, { uris: chunk });
        }
        added += chunk.length;
      } catch (err) {
        // Fallback: Add tracks one by one to avoid losing good tracks due to one bad/unplayable ID
        for (const singleUri of chunk) {
          try {
            try {
              await postItems(`/playlists/${playlistId}/items`, { uris: [singleUri] });
            } catch (_) {
              await postItems(`/playlists/${playlistId}/tracks`, { uris: [singleUri] });
            }
            added++;
          } catch (_) {
            // Skip unplayable track
          }
        }
      }

      if (typeof onProgress === 'function') {
        onProgress(added, uris.length);
      }
    }
  }

  /**
   * Replaces all tracks on a playlist.
   * Supports both 2026 /items and legacy /tracks endpoints.
   * @param {Object} options
   * @param {string} options.playlistId
   * @param {Track[]} options.tracks
   * @param {Function} [options.onProgress]
   */
  async replacePlaylistTracks({ playlistId, tracks, onProgress }) {
    const cleanId = SpotifyApi.parseSpotifyId(playlistId, 'playlist').id;
    const uris = tracks
      .map((t) => t.uri || `spotify:track:${t.id}`)
      .filter((uri) => uri && uri.startsWith('spotify:track:'));

    // First replace with up to 100 tracks
    const firstChunk = uris.slice(0, 100);
    try {
      await this.request(`/playlists/${cleanId}/items`, {
        method: 'PUT',
        body: JSON.stringify({ uris: firstChunk }),
      });
    } catch (_) {
      await this.request(`/playlists/${cleanId}/tracks`, {
        method: 'PUT',
        body: JSON.stringify({ uris: firstChunk }),
      });
    }

    if (typeof onProgress === 'function') {
      onProgress(firstChunk.length, uris.length);
    }

    // Append remainder if any
    if (uris.length > 100) {
      const remainingTracks = tracks.slice(100);
      await this.addTracksToPlaylist(cleanId, remainingTracks, (added, total) => {
        if (typeof onProgress === 'function') {
          onProgress(100 + added, uris.length);
        }
      });
    }
  }
}

export const spotifyApi = new SpotifyApi();
