/**
 * Core Domain Models for Music Collections, Tracks, and Profiles.
 * Decoupled from any single streaming platform.
 */

export const MusicPlatform = Object.freeze({
  SPOTIFY: 'spotify',
  YTMUSIC: 'ytmusic',
  LOCAL: 'local',
});

export const CollectionType = Object.freeze({
  PLAYLIST: 'playlist',
  ALBUM: 'album',
});

export class Track {
  /**
   * @param {Object} options
   * @param {string} options.id - Native platform track ID
   * @param {string} options.name - Track title
   * @param {string[]} [options.artists] - Array of contributing artist names
   * @param {string} [options.albumName] - Name of parent album
   * @param {string} [options.albumArtUrl] - Cover art image URL
   * @param {number} [options.durationMs] - Duration in milliseconds
   * @param {string} [options.isrc] - International Standard Recording Code
   * @param {string} [options.platform] - Source music platform ('spotify', 'ytmusic')
   * @param {string} [options.uri] - Platform specific URI if applicable
   */
  constructor({
    id,
    name,
    artists = [],
    albumName = '',
    albumArtUrl = '',
    durationMs = 0,
    isrc = '',
    platform = MusicPlatform.SPOTIFY,
    uri = '',
  }) {
    this.id = id;
    this.name = name || 'Unknown Track';
    this.artists = Array.isArray(artists) ? artists : [artists].filter(Boolean);
    this.albumName = albumName;
    this.albumArtUrl = albumArtUrl;
    this.durationMs = durationMs;
    this.isrc = (isrc || '').trim().toUpperCase();
    this.platform = platform;
    this.uri = uri || (platform === MusicPlatform.SPOTIFY && id ? `spotify:track:${id}` : '');
  }

  get artistString() {
    return this.artists.length > 0 ? this.artists.join(', ') : 'Unknown Artist';
  }

  get durationFormatted() {
    if (!this.durationMs || this.durationMs <= 0) return '0:00';
    const totalSeconds = Math.floor(this.durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Generates a stable unique identity key for cross-platform / cross-release deduplication.
   * Prefers ISRC if present; otherwise normalizes title and primary artist.
   * @returns {string}
   */
  get identityKey() {
    if (this.isrc && this.isrc.length >= 10) {
      return `isrc:${this.isrc}`;
    }
    // Normalize title: strip parenthetical noise like '(Remastered 2011)', '[Deluxe Edition]'
    const cleanTitle = (this.name || '')
      .toLowerCase()
      .replace(/\s*(\(|\[)(feat\.|featuring|remaster|deluxe|live|version|mono|stereo|bonus|radio edit).*?(\)|\])/gi, '')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const cleanArtist = (this.artists[0] || '')
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return `meta:${cleanTitle}::${cleanArtist}`;
  }

  /**
   * Factory method for creating a Track from Spotify Web API track object.
   * Handles playlist item wrappers ({ track: ... } or { item: ... }), direct track objects,
   * and artist string or object structures.
   * @param {Object} rawTrack - Spotify track JSON
   * @returns {Track}
   */
  static fromSpotify(rawTrack) {
    if (!rawTrack) return null;
    const track = rawTrack.track || rawTrack.item || (rawTrack.id ? rawTrack : null);
    if (!track || !track.id) return null;

    const album = track.album || {};
    const images = album.images || track.images || rawTrack.images || [];
    const albumArtUrl = Array.isArray(images) && images.length > 0
      ? (images[0]?.url || images[0] || '')
      : (typeof images === 'string' ? images : '');

    const artists = (track.artists || [])
      .map((a) => (typeof a === 'string' ? a : a.name))
      .filter(Boolean);

    const isrc = track.external_ids?.isrc || '';

    return new Track({
      id: track.id,
      name: track.name || 'Unknown Track',
      artists: artists.length > 0 ? artists : [track.artist].filter(Boolean),
      albumName: album.name || '',
      albumArtUrl,
      durationMs: track.duration_ms || track.durationMs || 0,
      isrc,
      platform: MusicPlatform.SPOTIFY,
      uri: track.uri || `spotify:track:${track.id}`,
    });
  }

  /**
   * Factory method for creating a Track from YouTube Music track object.
   * @param {Object} raw - YT Music track JSON
   * @returns {Track}
   */
  static fromYTMusic(raw) {
    if (!raw) return null;
    const id = raw.videoId || raw.id || '';
    if (!id) return null;

    const artists = Array.isArray(raw.artists)
      ? raw.artists.map((a) => (typeof a === 'string' ? a : a.name)).filter(Boolean)
      : raw.artist ? [raw.artist] : [];

    return new Track({
      id,
      name: raw.title || raw.name || 'Unknown Track',
      artists,
      albumName: raw.album?.name || raw.album || '',
      albumArtUrl: raw.thumbnails?.[0]?.url || raw.thumbnail || '',
      durationMs: (raw.durationSeconds || 0) * 1000,
      isrc: raw.isrc || '',
      platform: MusicPlatform.YTMUSIC,
      uri: `https://music.youtube.com/watch?v=${id}`,
    });
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      artists: this.artists,
      albumName: this.albumName,
      albumArtUrl: this.albumArtUrl,
      durationMs: this.durationMs,
      isrc: this.isrc,
      platform: this.platform,
      uri: this.uri,
    };
  }

  static fromJSON(data) {
    return new Track(data);
  }
}

export class MusicCollection {
  /**
   * @param {Object} options
   * @param {string} options.id - Immutable backend ID (e.g. 'spotify:playlist:123', 'spotify:album:456')
   * @param {string} options.name - Real display name for presentation layer
   * @param {string} [options.type] - 'playlist' or 'album'
   * @param {string} [options.owner] - Creator or owner name
   * @param {string} [options.imageUrl] - Artwork image URL
   * @param {string} [options.platform] - Source platform ('spotify', 'ytmusic')
   * @param {number} [options.totalCount] - Reported total track count
   * @param {Map<string, Track>|Track[]} [options.tracks] - Map or array of Track objects
   */
  constructor({
    id,
    name,
    type = CollectionType.PLAYLIST,
    owner = '',
    imageUrl = '',
    platform = MusicPlatform.SPOTIFY,
    totalCount = 0,
    tracks = new Map(),
  }) {
    if (!id) throw new Error('Collection must have a unique backend ID');
    this.id = id;
    this.name = name || 'Untitled Collection';
    this.type = type;
    this.owner = owner;
    this.imageUrl = imageUrl;
    this.platform = platform;
    this.totalCount = totalCount;

    // Track storage keyed by Track.identityKey for fast set operations
    this.tracks = new Map();
    if (tracks instanceof Map) {
      for (const [key, track] of tracks.entries()) {
        this.addTrack(track, key);
      }
    } else if (Array.isArray(tracks)) {
      for (const track of tracks) {
        this.addTrack(track);
      }
    }
  }

  /**
   * Adds a track to the collection.
   * @param {Track} track
   * @param {string} [key]
   */
  addTrack(track, key) {
    if (!track) return;
    const identity = key || track.identityKey;
    this.tracks.set(identity, track);
  }

  get trackList() {
    return Array.from(this.tracks.values());
  }

  get trackCount() {
    return this.tracks.size;
  }

  hasTrack(trackOrKey) {
    const key = typeof trackOrKey === 'string' ? trackOrKey : trackOrKey?.identityKey;
    return this.tracks.has(key);
  }

  getTrack(key) {
    return this.tracks.get(key);
  }

  /**
   * Creates a clone with a new subset of tracks.
   * @param {string} newId
   * @param {string} newName
   * @param {Map<string, Track>} newTracksMap
   * @returns {MusicCollection}
   */
  cloneWithTracks(newId, newName, newTracksMap) {
    return new MusicCollection({
      id: newId,
      name: newName,
      type: this.type,
      owner: this.owner,
      imageUrl: this.imageUrl,
      platform: this.platform,
      totalCount: newTracksMap.size,
      tracks: newTracksMap,
    });
  }
}

export class UserProfile {
  constructor({ id, displayName, imageUrl = '', platform = MusicPlatform.SPOTIFY, email = '' }) {
    this.id = id;
    this.displayName = displayName || 'User';
    this.imageUrl = imageUrl;
    this.platform = platform;
    this.email = email;
  }
}
