/**
 * YouTube Music / YouTube Data API v3 Client
 * Handles authenticated API queries, playlist pagination, video detail batching,
 * and track metadata normalization.
 */

import { ytmusicAuth } from './ytmusic-auth.js';
import { Track, MusicCollection, CollectionType, UserProfile, MusicPlatform } from '../../core/models.js';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

/**
 * Decodes standard HTML entities commonly returned by YouTube API.
 * @param {string} str
 * @returns {string}
 */
export function unescapeHtml(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/**
 * Parses an ISO 8601 duration string (e.g. PT4M13S, PT1H2M30S) into milliseconds.
 * @param {string} isoDuration
 * @returns {number} duration in milliseconds
 */
export function parseIso8601Duration(isoDuration) {
  if (!isoDuration || typeof isoDuration !== 'string') return 0;
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}

/**
 * Normalizes YouTube video title, artist, and uploader into canonical song metadata.
 * Strips promotional noise like (Official Video), (Lyric Video), [Remastered], etc.
 * @param {Object} snippet - YouTube snippet object
 * @returns {{ title: string, artist: string }}
 */
export function normalizeYouTubeMetadata(snippet) {
  const rawTitle = unescapeHtml(snippet?.title || '');
  const channelTitle = unescapeHtml(
    snippet?.videoOwnerChannelTitle || snippet?.channelTitle || ''
  );

  let cleanTitle = rawTitle;
  let artist = '';

  // 1. Topic channel detection (YouTube Music official art tracks, e.g. "Radiohead - Topic")
  const isTopicChannel = /-\s*Topic$/i.test(channelTitle);
  if (isTopicChannel) {
    artist = channelTitle.replace(/\s*-\s*Topic$/i, '').trim();
  }

  // 2. Check if title is in "Artist - Song Name" format
  const delimiterMatch = cleanTitle.match(/^(.+?)\s+[-–—:]\s+(.+)$/);
  if (delimiterMatch) {
    if (!artist) {
      artist = delimiterMatch[1].trim();
    }
    cleanTitle = delimiterMatch[2].trim();
  } else if (!artist) {
    // Strip common channel suffixes like "VEVO", "Official"
    artist = channelTitle
      .replace(/\s*(VEVO|Official|Music)\s*$/i, '')
      .trim();
  }

  // 3. Strip promotional noise terms from title
  cleanTitle = cleanTitle
    .replace(/\s*(\(|\[).*?(official\s*(music\s*)?video|official\s*audio|lyric\s*video|audio|lyrics|visualizer|remaster|hd|4k|live|high\s*quality).*?(\)|\])/gi, '')
    .replace(/\s*["'“”]/g, '')
    .trim();

  // If title was reduced to empty, fallback to rawTitle
  if (!cleanTitle) {
    cleanTitle = rawTitle;
  }

  return {
    title: cleanTitle,
    artist: artist || 'Unknown Artist',
  };
}

export class YTMusicApi {
  /**
   * Helper for authenticated fetch with automatic token retrieval and error handling.
   * @param {string} endpoint - API path or full URL
   * @param {RequestInit} [options]
   * @returns {Promise<any>}
   */
  async request(endpoint, options = {}) {
    const token = await ytmusicAuth.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated with Google / YouTube Music');
    }

    const url = endpoint.startsWith('http') ? endpoint : `${YOUTUBE_API_BASE}${endpoint}`;
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    const response = await fetch(url, { ...options, headers });

    // Handle Rate Limiting / 429
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '2', 10);
      await new Promise((resolve) => setTimeout(resolve, (retryAfter + 0.5) * 1000));
      return this.request(endpoint, options);
    }

    if (response.status === 204) {
      return null;
    }

    if (!response.ok) {
      let errorMsg = `YouTube Data API error (${response.status} ${response.statusText})`;
      let errorData = null;
      try {
        errorData = await response.json();
        const reason = errorData.error?.errors?.[0]?.reason || errorData.error?.message;
        if (reason) {
          if (reason === 'quotaExceeded') {
            errorMsg = 'YouTube Data API daily quota exceeded. Quota resets at midnight PST.';
          } else {
            errorMsg = `YouTube API: ${errorData.error.message}`;
          }
        }
      } catch (_) {}

      const err = new Error(errorMsg);
      err.status = response.status;
      err.data = errorData;
      throw err;
    }

    return response.json();
  }

  /**
   * Extracts clean ID and collection type from URL or raw ID string.
   * Examples:
   *  - https://music.youtube.com/playlist?list=PLxxx -> { type: 'playlist', id: 'PLxxx' }
   *  - https://music.youtube.com/playlist?list=OLAK5uy_xxx -> { type: 'album', id: 'OLAK5uy_xxx' }
   *  - https://www.youtube.com/playlist?list=PLxxx -> { type: 'playlist', id: 'PLxxx' }
   *  - https://music.youtube.com/watch?v=yyy&list=PLxxx -> { type: 'playlist', id: 'PLxxx' }
   *  - OLAK5uy_xxx -> { type: 'album', id: 'OLAK5uy_xxx' }
   *  - PLxxx -> { type: 'playlist', id: 'PLxxx' }
   * @param {string} input
   * @param {'playlist'|'album'} [defaultType]
   * @returns {{ id: string, type: 'playlist'|'album' }}
   */
  static parseYouTubeId(input, defaultType = 'playlist') {
    if (!input || typeof input !== 'string') {
      return { id: '', type: defaultType };
    }
    const trimmed = input.trim();

    // Strip internal backend URI prefixes: ytmusic:playlist:xxx, ytmusic:album:xxx
    const uriMatch = trimmed.match(/^ytmusic:(playlist|album):([a-zA-Z0-9_-]+)/);
    if (uriMatch) {
      const type = uriMatch[1] === 'album' ? CollectionType.ALBUM : CollectionType.PLAYLIST;
      return { id: uriMatch[2], type };
    }

    // Check if input is a URL
    if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
      try {
        const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
        const listParam = url.searchParams.get('list');
        if (listParam) {
          const type = listParam.startsWith('OLAK5uy_') ? CollectionType.ALBUM : CollectionType.PLAYLIST;
          return { id: listParam, type };
        }

        // Check for album browse path /browse/MPREb_...
        const browseMatch = url.pathname.match(/\/browse\/(MPREb_[a-zA-Z0-9_-]+)/);
        if (browseMatch) {
          return { id: browseMatch[1], type: CollectionType.ALBUM };
        }
      } catch (_) {}
    }

    // Check raw ID prefixes
    if (trimmed.startsWith('OLAK5uy_') || trimmed.startsWith('MPREb_')) {
      return { id: trimmed.split('&')[0], type: CollectionType.ALBUM };
    }

    return { id: trimmed.split('&')[0], type: defaultType };
  }

  /**
   * Retrieves Google / YouTube authenticated user profile.
   * @returns {Promise<UserProfile>}
   */
  async getCurrentUserProfile() {
    return ytmusicAuth.getUserProfile();
  }

  /**
   * Searches YouTube Music for playlists and albums.
   * @param {string} query
   * @param {Array<'playlist'|'album'>} [types]
   * @param {number} [limit]
   * @returns {Promise<{ playlists: Object[], albums: Object[] }>}
   */
  async search(query, types = ['playlist', 'album'], limit = 10) {
    if (!query || !query.trim()) {
      return { playlists: [], albums: [] };
    }

    const encodedQuery = encodeURIComponent(query.trim());
    const validLimit = Math.min(Math.max(1, limit), 15);

    // Query YouTube Data API search for playlists
    const data = await this.request(
      `/search?part=snippet&type=playlist&q=${encodedQuery}&maxResults=${validLimit}`
    );

    const items = data.items || [];
    const playlists = [];
    const albums = [];

    for (const item of items) {
      const playlistId = item.id?.playlistId;
      if (!playlistId) continue;

      const title = unescapeHtml(item.snippet?.title || '');
      const owner = unescapeHtml(item.snippet?.channelTitle || 'YouTube Music');
      const imageUrl =
        item.snippet?.thumbnails?.high?.url ||
        item.snippet?.thumbnails?.medium?.url ||
        item.snippet?.thumbnails?.default?.url ||
        '';

      const isAlbum =
        playlistId.startsWith('OLAK5uy_') ||
        /-\s*Topic$/i.test(owner) ||
        /\b(album|full album|ep|lp|soundtrack|ost)\b/i.test(title);

      const entry = {
        id: `ytmusic:${isAlbum ? 'album' : 'playlist'}:${playlistId}`,
        rawId: playlistId,
        name: title,
        owner,
        imageUrl,
        totalTracks: 0, // Search response does not include count; populated when loaded
        type: isAlbum ? CollectionType.ALBUM : CollectionType.PLAYLIST,
        platform: MusicPlatform.YTMUSIC,
      };

      if (isAlbum) {
        albums.push(entry);
      } else {
        playlists.push(entry);
      }
    }

    return { playlists, albums };
  }

  /**
   * Fetches full playlist contents with pagination and batches video detail requests for durations.
   * @param {string} rawIdOrInput
   * @param {Function} [onProgress] - callback(loadedTracks, totalTracks)
   * @returns {Promise<MusicCollection>}
   */
  async getPlaylist(rawIdOrInput, onProgress) {
    const { id: playlistId, type } = YTMusicApi.parseYouTubeId(rawIdOrInput, 'playlist');
    if (!playlistId) throw new Error('Invalid YouTube Music playlist ID or URL');

    if (playlistId.startsWith('MPREb_')) {
      throw new Error(
        'YouTube Music album URLs containing "/browse/MPREb_..." are internal web pages. ' +
        'In YouTube Music, click the 3-dots menu (⋮) on the album → "Share" → "Copy link" ' +
        '(which generates a link starting with "playlist?list=OLAK5uy_..."), or search for the album title in the Search tab.'
      );
    }

    // 1. Fetch playlist metadata
    let playlistTitle = 'Untitled Playlist';
    let playlistOwner = 'YouTube Music';
    let playlistThumb = '';
    let reportedTotal = 0;

    try {
      const metaRes = await this.request(`/playlists?part=snippet,contentDetails&id=${playlistId}`);
      const metaItem = metaRes?.items?.[0];
      if (metaItem) {
        playlistTitle = unescapeHtml(metaItem.snippet?.title || 'Untitled Playlist');
        playlistOwner = unescapeHtml(metaItem.snippet?.channelTitle || 'YouTube Music');
        playlistThumb =
          metaItem.snippet?.thumbnails?.maxres?.url ||
          metaItem.snippet?.thumbnails?.high?.url ||
          metaItem.snippet?.thumbnails?.medium?.url ||
          metaItem.snippet?.thumbnails?.default?.url ||
          '';
        reportedTotal = metaItem.contentDetails?.itemCount || 0;
      }
    } catch (err) {
      console.warn(`Playlist metadata fetch note for ${playlistId}:`, err.message);
    }

    const backendId = `ytmusic:${type === CollectionType.ALBUM ? 'album' : 'playlist'}:${playlistId}`;
    const collection = new MusicCollection({
      id: backendId,
      name: playlistTitle,
      type: type || CollectionType.PLAYLIST,
      owner: playlistOwner,
      imageUrl: playlistThumb,
      platform: MusicPlatform.YTMUSIC,
      totalCount: reportedTotal,
    });

    // 2. Paginate through playlistItems
    const rawVideoEntries = [];
    let nextPageToken = null;

    do {
      const pageParam = nextPageToken ? `&pageToken=${nextPageToken}` : '';
      const itemsRes = await this.request(
        `/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50${pageParam}`
      );

      const items = itemsRes?.items || [];
      for (const item of items) {
        const videoId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
        const title = item.snippet?.title || '';
        // Skip private or deleted videos
        if (!videoId || title === 'Private video' || title === 'Deleted video') {
          continue;
        }

        rawVideoEntries.push({
          videoId,
          snippet: item.snippet,
        });
      }

      nextPageToken = itemsRes?.nextPageToken || null;
      if (onProgress && reportedTotal > 0) {
        onProgress(rawVideoEntries.length, reportedTotal);
      }
    } while (nextPageToken);

    // 3. Batch video queries (up to 50 at a time) to extract ISO 8601 durations and best thumbnails
    const videoDetailsMap = new Map();
    const batchSize = 50;
    for (let i = 0; i < rawVideoEntries.length; i += batchSize) {
      const chunk = rawVideoEntries.slice(i, i + batchSize);
      const ids = chunk.map((c) => c.videoId).join(',');
      try {
        const detailsRes = await this.request(`/videos?part=contentDetails,snippet&id=${ids}`);
        for (const v of detailsRes?.items || []) {
          videoDetailsMap.set(v.id, {
            durationMs: parseIso8601Duration(v.contentDetails?.duration),
            thumbnailUrl:
              v.snippet?.thumbnails?.maxres?.url ||
              v.snippet?.thumbnails?.high?.url ||
              v.snippet?.thumbnails?.medium?.url ||
              '',
            videoSnippet: v.snippet,
          });
        }
      } catch (err) {
        console.warn('Batch video details query warning:', err.message);
      }
    }

    // 4. Construct Track domain objects with normalized metadata
    for (const entry of rawVideoEntries) {
      const vid = entry.videoId;
      const details = videoDetailsMap.get(vid);
      const effectiveSnippet = {
        ...entry.snippet,
        ...(details?.videoSnippet || {}),
        title: entry.snippet?.title || details?.videoSnippet?.title,
        channelTitle: entry.snippet?.channelTitle || details?.videoSnippet?.channelTitle,
        videoOwnerChannelTitle:
          entry.snippet?.videoOwnerChannelTitle || details?.videoSnippet?.videoOwnerChannelTitle,
      };
      const { title, artist } = normalizeYouTubeMetadata(effectiveSnippet);

      const trackThumb =
        details?.thumbnailUrl ||
        entry.snippet?.thumbnails?.high?.url ||
        entry.snippet?.thumbnails?.medium?.url ||
        playlistThumb ||
        '';

      const durationMs = details?.durationMs || 0;

      const track = new Track({
        id: vid,
        name: title,
        artists: [artist],
        albumName: playlistTitle,
        albumArtUrl: trackThumb,
        durationMs,
        platform: MusicPlatform.YTMUSIC,
        uri: `https://music.youtube.com/watch?v=${vid}`,
      });

      collection.addTrack(track);
    }

    collection.totalCount = collection.trackCount;
    if (onProgress) {
      onProgress(collection.trackCount, collection.trackCount);
    }

    return collection;
  }

  /**
   * Fetches album contents. Delegates to getPlaylist with ALBUM type.
   * @param {string} rawIdOrInput
   * @param {Function} [onProgress]
   * @returns {Promise<MusicCollection>}
   */
  async getAlbum(rawIdOrInput, onProgress) {
    const parsed = YTMusicApi.parseYouTubeId(rawIdOrInput, 'album');
    if (parsed.id.startsWith('MPREb_')) {
      throw new Error(
        'YouTube Music album URLs containing "/browse/MPREb_..." are internal web pages. ' +
        'In YouTube Music, click the 3-dots menu (⋮) on the album → "Share" → "Copy link" ' +
        '(which generates a link starting with "playlist?list=OLAK5uy_..."), or search for the album title in the Search tab.'
      );
    }
    const collection = await this.getPlaylist(parsed.id, onProgress);
    collection.type = CollectionType.ALBUM;
    return collection;
  }

  /**
   * Creates a new YouTube Music playlist and inserts tracks.
   * @param {Object} options
   * @param {string} options.name
   * @param {string} [options.description]
   * @param {boolean} [options.isPublic]
   * @param {Track[]} [options.tracks]
   * @param {Function} [options.onProgress] - callback(current, total)
   * @returns {Promise<{ id: string, name: string, externalUrl: string }>}
   */
  async createPlaylist({ name, description = '', isPublic = false, tracks = [], onProgress }) {
    const playlistTitle = name || 'Set Operations Playlist';
    const playlistDesc = description || 'Generated with Music Set Operations, by Tactile Software';
    const privacyStatus = isPublic ? 'public' : 'private';

    const body = JSON.stringify({
      snippet: {
        title: playlistTitle,
        description: playlistDesc,
        defaultLanguage: 'en',
      },
      status: {
        privacyStatus,
      },
    });

    const created = await this.request('/playlists?part=snippet,status', {
      method: 'POST',
      body,
    });

    const playlistId = created.id;

    if (tracks && tracks.length > 0) {
      await this.addTracksToPlaylist(playlistId, tracks, onProgress);
    }

    return {
      id: playlistId,
      name: created.snippet?.title || playlistTitle,
      externalUrl: `https://music.youtube.com/playlist?list=${playlistId}`,
    };
  }

  /**
   * Adds tracks to an existing YouTube Music playlist with progress and error resilience.
   * Resolves YouTube video IDs directly or via search fallback for cross-platform tracks.
   * @param {string} playlistId
   * @param {Track[]} [tracks]
   * @param {Function} [onProgress] - callback(current, total)
   */
  async addTracksToPlaylist(playlistId, tracks = [], onProgress) {
    const cleanId = YTMusicApi.parseYouTubeId(playlistId, 'playlist').id;
    let added = 0;
    const total = tracks.length;

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      let videoId = null;

      // 1. Direct YouTube video ID
      if (track.platform === MusicPlatform.YTMUSIC || /^[a-zA-Z0-9_-]{11}$/.test(track.id)) {
        videoId = track.id;
      } else if (track.uri) {
        const vMatch = track.uri.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (vMatch) videoId = vMatch[1];
      }

      // 2. Cross-platform fallback: Search for track title + artist on YouTube Data API
      if (!videoId && track.name) {
        try {
          const query = `${track.name} ${(track.artists || [])[0] || ''}`.trim();
          const searchRes = await this.request(
            `/search?part=snippet&type=video&q=${encodeURIComponent(query)}&maxResults=1`
          );
          videoId = searchRes?.items?.[0]?.id?.videoId || null;
        } catch (searchErr) {
          console.warn(`Search fallback failed for track "${track.name}":`, searchErr.message);
        }
      }

      // 3. Insert playlistItem if videoId was found
      if (videoId) {
        try {
          await this.request('/playlistItems?part=snippet', {
            method: 'POST',
            body: JSON.stringify({
              snippet: {
                playlistId: cleanId,
                resourceId: {
                  kind: 'youtube#video',
                  videoId,
                },
              },
            }),
          });
          added++;
        } catch (insertErr) {
          console.warn(`Failed to insert video "${videoId}" for track "${track.name}":`, insertErr.message);
        }
      } else {
        console.warn(`Could not resolve YouTube video ID for track: "${track.name}"`);
      }

      if (typeof onProgress === 'function') {
        onProgress(i + 1, total);
      }

      // Brief throttle to be respectful of rate limits
      if (i < tracks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
    }
  }

  /**
   * Replaces all tracks on an existing YouTube playlist.
   * Fetches existing playlistItems, deletes them, and adds the new tracks.
   * @param {Object} options
   * @param {string} options.playlistId
   * @param {Track[]} [options.tracks]
   * @param {Function} [options.onProgress]
   */
  async replacePlaylistTracks({ playlistId, tracks = [], onProgress }) {
    const cleanId = YTMusicApi.parseYouTubeId(playlistId, 'playlist').id;

    // 1. Fetch all existing playlist items
    const existingItemIds = [];
    let nextPageToken = null;

    do {
      const pageParam = nextPageToken ? `&pageToken=${nextPageToken}` : '';
      const res = await this.request(
        `/playlistItems?part=id&playlistId=${cleanId}&maxResults=50${pageParam}`
      );
      for (const item of res?.items || []) {
        if (item.id) existingItemIds.push(item.id);
      }
      nextPageToken = res?.nextPageToken || null;
    } while (nextPageToken);

    // 2. Delete existing items
    for (const itemId of existingItemIds) {
      try {
        await this.request(`/playlistItems?id=${itemId}`, {
          method: 'DELETE',
        });
        await new Promise((resolve) => setTimeout(resolve, 40));
      } catch (delErr) {
        console.warn(`Failed to delete playlistItem "${itemId}":`, delErr.message);
      }
    }

    // 3. Add new tracks
    if (tracks && tracks.length > 0) {
      await this.addTracksToPlaylist(cleanId, tracks, onProgress);
    }
  }
}

export const ytmusicApi = new YTMusicApi();
