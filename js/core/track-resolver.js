/**
 * Cross-Platform Track Resolution & Caching Engine
 * Resolves foreign tracks into destination native IDs (Spotify <-> YouTube Music)
 * using metadata matching, duration validation (±15s tolerance), and persistent caching.
 */

import { Storage } from '../utils/storage.js';
import { Track, MusicPlatform } from './models.js';
import { spotifyApi } from '../providers/spotify/spotify-api.js';
import { ytmusicApi, parseIso8601Duration } from '../providers/ytmusic/ytmusic-api.js';

export const STORAGE_TRACK_CACHE = 'sso_cross_platform_track_cache';
export const DURATION_TOLERANCE_MS = 15000; // ±15 seconds tolerance

export class TrackResolver {
  constructor() {
    this._memoryCache = new Map();
  }

  /**
   * Retrieves the full persistent resolution cache.
   * @returns {Object<string, Object>}
   */
  getPersistentCache() {
    try {
      const raw = Storage.get(STORAGE_TRACK_CACHE);
      if (raw && typeof raw === 'object') return raw;
      if (typeof raw === 'string') return JSON.parse(raw);
    } catch (_) {}
    return {};
  }

  /**
   * Saves a resolution entry into both persistent storage and memory cache.
   * @param {string} identityKey
   * @param {Object} mapping
   */
  saveMapping(identityKey, mapping) {
    if (!identityKey) return;
    const cache = this.getPersistentCache();
    const existing = cache[identityKey] || {};
    const updated = {
      ...existing,
      ...mapping,
      lastVerified: Date.now(),
    };
    cache[identityKey] = updated;
    this._memoryCache.set(identityKey, updated);
    Storage.set(STORAGE_TRACK_CACHE, cache);
  }

  /**
   * Retrieves mapping for an identityKey if cached.
   * @param {string} identityKey
   * @returns {Object|null}
   */
  getMapping(identityKey) {
    if (!identityKey) return null;
    if (this._memoryCache.has(identityKey)) {
      return this._memoryCache.get(identityKey);
    }
    const cache = this.getPersistentCache();
    const entry = cache[identityKey] || null;
    if (entry) {
      this._memoryCache.set(identityKey, entry);
    }
    return entry;
  }

  /**
   * Clears the cross-platform resolution cache.
   */
  clearCache() {
    this._memoryCache.clear();
    Storage.remove(STORAGE_TRACK_CACHE);
  }

  /**
   * Determines if a track is already native to the destination platform.
   * @param {Track} track
   * @param {'spotify'|'ytmusic'} targetPlatform
   * @returns {boolean}
   */
  isNative(track, targetPlatform) {
    if (!track) return false;
    if (targetPlatform === MusicPlatform.SPOTIFY) {
      if (track.platform === MusicPlatform.YTMUSIC) return false;
      return (
        track.platform === MusicPlatform.SPOTIFY ||
        (track.uri && track.uri.startsWith('spotify:track:'))
      );
    }
    if (targetPlatform === MusicPlatform.YTMUSIC) {
      if (track.platform === MusicPlatform.SPOTIFY) return false;
      return (
        track.platform === MusicPlatform.YTMUSIC ||
        (track.uri && (track.uri.includes('music.youtube.com') || track.uri.includes('youtu.be'))) ||
        (/^[a-zA-Z0-9_-]{11}$/.test(track.id) && !track.uri?.startsWith('spotify:'))
      );
    }
    return false;
  }

  /**
   * Resolves a single track to the target platform.
   * If already native, returns it as-is.
   * If in cache, returns a new Track with target credentials.
   * Otherwise, queries the target platform's search API, validates duration, and caches the match.
   * @param {Track} track
   * @param {'spotify'|'ytmusic'} targetPlatform
   * @returns {Promise<Track|null>}
   */
  async resolveTrack(track, targetPlatform) {
    if (!track) return null;

    // 1. Already native
    if (this.isNative(track, targetPlatform)) {
      return track;
    }

    const idKey = track.identityKey;

    // 2. Check cache
    const cached = this.getMapping(idKey);
    if (cached) {
      if (targetPlatform === MusicPlatform.SPOTIFY && cached.spotifyId) {
        return new Track({
          id: cached.spotifyId,
          name: track.name,
          artists: track.artists,
          albumName: track.albumName,
          albumArtUrl: cached.albumArtUrl || track.albumArtUrl,
          durationMs: cached.durationMs || track.durationMs,
          isrc: track.isrc || cached.isrc,
          platform: MusicPlatform.SPOTIFY,
          uri: cached.spotifyUri || `spotify:track:${cached.spotifyId}`,
        });
      }
      if (targetPlatform === MusicPlatform.YTMUSIC && cached.ytVideoId) {
        return new Track({
          id: cached.ytVideoId,
          name: track.name,
          artists: track.artists,
          albumName: track.albumName,
          albumArtUrl: cached.albumArtUrl || track.albumArtUrl,
          durationMs: cached.durationMs || track.durationMs,
          isrc: track.isrc || cached.isrc,
          platform: MusicPlatform.YTMUSIC,
          uri: cached.ytUri || `https://music.youtube.com/watch?v=${cached.ytVideoId}`,
        });
      }
    }

    // 3. Resolve to Spotify
    if (targetPlatform === MusicPlatform.SPOTIFY) {
      return this._resolveToSpotify(track);
    }

    // 4. Resolve to YouTube Music
    if (targetPlatform === MusicPlatform.YTMUSIC) {
      return this._resolveToYouTube(track);
    }

    return null;
  }

  /**
   * Searches and matches a track on Spotify.
   * @private
   * @param {Track} track
   * @returns {Promise<Track|null>}
   */
  async _resolveToSpotify(track) {
    try {
      const artist = (track.artists || [])[0] || '';
      let candidates = [];

      // Query strategy 1: ISRC lookup if available
      if (track.isrc) {
        try {
          candidates = await spotifyApi.searchTracks(`isrc:${track.isrc}`, 3);
        } catch (_) {}
      }

      // Query strategy 2: field-specific track & artist
      if (candidates.length === 0 && track.name) {
        try {
          const fieldQuery = artist ? `track:${track.name} artist:${artist}` : `track:${track.name}`;
          candidates = await spotifyApi.searchTracks(fieldQuery, 5);
        } catch (_) {}
      }

      // Query strategy 3: plain text search
      if (candidates.length === 0 && track.name) {
        try {
          const plainQuery = `${track.name} ${artist}`.trim();
          candidates = await spotifyApi.searchTracks(plainQuery, 5);
        } catch (_) {}
      }

      if (candidates.length === 0) {
        return null;
      }

      // Find candidate matching duration tolerance (±15s)
      let bestMatch = candidates[0];
      if (track.durationMs > 0) {
        const durationMatch = candidates.find(
          (c) => Math.abs(c.durationMs - track.durationMs) <= DURATION_TOLERANCE_MS
        );
        if (durationMatch) {
          bestMatch = durationMatch;
        }
      }

      this.saveMapping(track.identityKey, {
        spotifyId: bestMatch.id,
        spotifyUri: bestMatch.uri || `spotify:track:${bestMatch.id}`,
        durationMs: bestMatch.durationMs,
        albumArtUrl: bestMatch.albumArtUrl,
      });

      return new Track({
        id: bestMatch.id,
        name: track.name,
        artists: track.artists.length > 0 ? track.artists : bestMatch.artists,
        albumName: track.albumName || bestMatch.albumName,
        albumArtUrl: bestMatch.albumArtUrl || track.albumArtUrl,
        durationMs: bestMatch.durationMs || track.durationMs,
        isrc: track.isrc || bestMatch.isrc,
        platform: MusicPlatform.SPOTIFY,
        uri: bestMatch.uri || `spotify:track:${bestMatch.id}`,
      });
    } catch (err) {
      console.warn(`TrackResolver: Failed to resolve "${track.name}" to Spotify:`, err.message);
      return null;
    }
  }

  /**
   * Searches and matches a track on YouTube Music.
   * @private
   * @param {Track} track
   * @returns {Promise<Track|null>}
   */
  async _resolveToYouTube(track) {
    try {
      const artist = (track.artists || [])[0] || '';
      const query = `${track.name} ${artist}`.trim();
      if (!query) return null;

      const data = await ytmusicApi.request(
        `/search?part=snippet&type=video&q=${encodeURIComponent(query)}&maxResults=5`
      );

      const items = (data?.items || []).filter((item) => item.id?.videoId);
      if (items.length === 0) return null;

      // Extract candidate video IDs and batch duration query
      const videoIds = items.map((i) => i.id.videoId);
      let durationMap = new Map();

      try {
        const detailsRes = await ytmusicApi.request(
          `/videos?part=contentDetails,snippet&id=${videoIds.join(',')}`
        );
        for (const v of detailsRes?.items || []) {
          durationMap.set(v.id, {
            durationMs: parseIso8601Duration(v.contentDetails?.duration),
            thumbnailUrl:
              v.snippet?.thumbnails?.high?.url ||
              v.snippet?.thumbnails?.medium?.url ||
              '',
          });
        }
      } catch (_) {}

      // Select candidate matching duration within ±15s
      let chosenId = videoIds[0];
      let bestThumb = '';
      let chosenDuration = 0;

      if (track.durationMs > 0) {
        for (const vid of videoIds) {
          const details = durationMap.get(vid);
          if (details && Math.abs(details.durationMs - track.durationMs) <= DURATION_TOLERANCE_MS) {
            chosenId = vid;
            bestThumb = details.thumbnailUrl;
            chosenDuration = details.durationMs;
            break;
          }
        }
      }

      if (!bestThumb && durationMap.has(chosenId)) {
        bestThumb = durationMap.get(chosenId).thumbnailUrl;
        chosenDuration = durationMap.get(chosenId).durationMs;
      }

      this.saveMapping(track.identityKey, {
        ytVideoId: chosenId,
        ytUri: `https://music.youtube.com/watch?v=${chosenId}`,
        durationMs: chosenDuration || track.durationMs,
        albumArtUrl: bestThumb || track.albumArtUrl,
      });

      return new Track({
        id: chosenId,
        name: track.name,
        artists: track.artists,
        albumName: track.albumName,
        albumArtUrl: bestThumb || track.albumArtUrl,
        durationMs: chosenDuration || track.durationMs,
        isrc: track.isrc,
        platform: MusicPlatform.YTMUSIC,
        uri: `https://music.youtube.com/watch?v=${chosenId}`,
      });
    } catch (err) {
      console.warn(`TrackResolver: Failed to resolve "${track.name}" to YouTube:`, err.message);
      return null;
    }
  }

  /**
   * Resolves a full list of tracks for export to a target platform.
   * Reports progress via callback: onProgress(resolvedCount, totalCount, currentTrack).
   * @param {Track[]} tracks
   * @param {'spotify'|'ytmusic'} targetPlatform
   * @param {Function} [onProgress]
   * @returns {Promise<{ resolvedTracks: Track[], failedTracks: Track[], stats: Object }>}
   */
  async resolveTracks(tracks = [], targetPlatform, onProgress) {
    const resolvedTracks = [];
    const failedTracks = [];
    let nativeCount = 0;
    let resolvedCount = 0;

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (typeof onProgress === 'function') {
        onProgress(i + 1, tracks.length, track);
      }

      if (this.isNative(track, targetPlatform)) {
        resolvedTracks.push(track);
        nativeCount++;
        continue;
      }

      const resolved = await this.resolveTrack(track, targetPlatform);
      if (resolved) {
        resolvedTracks.push(resolved);
        resolvedCount++;
      } else {
        failedTracks.push(track);
      }

      // Small throttle between search calls if foreign
      await new Promise((r) => setTimeout(r, 40));
    }

    return {
      resolvedTracks,
      failedTracks,
      stats: {
        total: tracks.length,
        native: nativeCount,
        resolved: resolvedCount,
        failed: failedTracks.length,
      },
    };
  }
}

export const trackResolver = new TrackResolver();
