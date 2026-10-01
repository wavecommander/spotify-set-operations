import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { TrackResolver, trackResolver, STORAGE_TRACK_CACHE } from '../js/core/track-resolver.js';
import { Track, MusicPlatform, CollectionType } from '../js/core/models.js';
import { Storage } from '../js/utils/storage.js';
import { SetEngine } from '../js/core/set-engine.js';
import { spotifyApi } from '../js/providers/spotify/spotify-api.js';
import { ytmusicApi } from '../js/providers/ytmusic/ytmusic-api.js';

describe('Cross-Platform Track Resolution & Caching Engine', () => {
  beforeEach(() => {
    Storage.clear();
    trackResolver.clearCache();
  });

  test('isNative correctly distinguishes Spotify and YouTube Music tracks', () => {
    const resolver = new TrackResolver();

    const spotifyTrack = new Track({
      id: 'sp_track_123',
      name: 'Song A',
      artists: ['Artist A'],
      platform: MusicPlatform.SPOTIFY,
      uri: 'spotify:track:sp_track_123',
    });

    const ytTrack = new Track({
      id: 'dQw4w9WgXcQ', // 11-char YouTube ID
      name: 'Song B',
      artists: ['Artist B'],
      platform: MusicPlatform.YTMUSIC,
      uri: 'https://music.youtube.com/watch?v=dQw4w9WgXcQ',
    });

    assert.equal(resolver.isNative(spotifyTrack, MusicPlatform.SPOTIFY), true);
    assert.equal(resolver.isNative(spotifyTrack, MusicPlatform.YTMUSIC), false);

    assert.equal(resolver.isNative(ytTrack, MusicPlatform.YTMUSIC), true);
    assert.equal(resolver.isNative(ytTrack, MusicPlatform.SPOTIFY), false);
  });

  test('saveMapping and getMapping persist and retrieve entries from cache', () => {
    const resolver = new TrackResolver();
    const idKey = 'meta:creep::radiohead';

    assert.equal(resolver.getMapping(idKey), null);

    resolver.saveMapping(idKey, {
      spotifyId: 'sp_creep_id',
      ytVideoId: 'yt_creep_id',
      durationMs: 238000,
    });

    const cached = resolver.getMapping(idKey);
    assert.ok(cached);
    assert.equal(cached.spotifyId, 'sp_creep_id');
    assert.equal(cached.ytVideoId, 'yt_creep_id');
    assert.ok(cached.lastVerified > 0);

    // Verify stored in Storage
    const storageRaw = Storage.get(STORAGE_TRACK_CACHE);
    assert.ok(storageRaw);
    assert.equal(storageRaw[idKey]?.spotifyId, 'sp_creep_id');
  });

  test('resolveTrack returns native tracks immediately without API queries', async () => {
    const resolver = new TrackResolver();
    let apiCalled = false;

    // Spy on APIs
    const origSp = spotifyApi.searchTracks;
    const origYt = ytmusicApi.request;
    spotifyApi.searchTracks = async () => {
      apiCalled = true;
      return [];
    };
    ytmusicApi.request = async () => {
      apiCalled = true;
      return {};
    };

    try {
      const spTrack = new Track({ id: 'sp1', platform: MusicPlatform.SPOTIFY, uri: 'spotify:track:sp1' });
      const res = await resolver.resolveTrack(spTrack, MusicPlatform.SPOTIFY);
      assert.equal(res, spTrack);
      assert.equal(apiCalled, false);
    } finally {
      spotifyApi.searchTracks = origSp;
      ytmusicApi.request = origYt;
    }
  });

  test('resolveTrack retrieves cached cross-platform match without hitting search APIs', async () => {
    const resolver = new TrackResolver();
    let apiCalled = false;

    const origSp = spotifyApi.searchTracks;
    spotifyApi.searchTracks = async () => {
      apiCalled = true;
      return [];
    };

    try {
      const ytTrack = new Track({
        id: 'dQw4w9WgXcQ',
        name: 'Never Gonna Give You Up',
        artists: ['Rick Astley'],
        platform: MusicPlatform.YTMUSIC,
      });

      // Pre-seed cache
      resolver.saveMapping(ytTrack.identityKey, {
        spotifyId: 'sp_rick_456',
        spotifyUri: 'spotify:track:sp_rick_456',
      });

      const resolved = await resolver.resolveTrack(ytTrack, MusicPlatform.SPOTIFY);
      assert.ok(resolved);
      assert.equal(resolved.platform, MusicPlatform.SPOTIFY);
      assert.equal(resolved.id, 'sp_rick_456');
      assert.equal(resolved.uri, 'spotify:track:sp_rick_456');
      assert.equal(apiCalled, false);
    } finally {
      spotifyApi.searchTracks = origSp;
    }
  });

  test('resolves foreign Spotify track to YouTube Music matching duration tolerance', async () => {
    const resolver = new TrackResolver();
    const origRequest = ytmusicApi.request;

    ytmusicApi.request = async (endpoint) => {
      if (endpoint.startsWith('/search')) {
        return {
          items: [
            { id: { videoId: 'yt_bad_version' } }, // Live version
            { id: { videoId: 'yt_album_ver' } },   // Studio album version
          ],
        };
      }
      if (endpoint.startsWith('/videos')) {
        return {
          items: [
            { id: 'yt_bad_version', contentDetails: { duration: 'PT5M30S' }, snippet: { thumbnails: {} } }, // 330s
            { id: 'yt_album_ver', contentDetails: { duration: 'PT3M50S' }, snippet: { thumbnails: {} } },   // 230s
          ],
        };
      }
      return {};
    };

    try {
      const spotifyTrack = new Track({
        id: 'sp_karma_police',
        name: 'Karma Police',
        artists: ['Radiohead'],
        durationMs: 232000, // 232s -> matches 230s within 15s tolerance
        platform: MusicPlatform.SPOTIFY,
      });

      const resolved = await resolver.resolveTrack(spotifyTrack, MusicPlatform.YTMUSIC);
      assert.ok(resolved);
      assert.equal(resolved.platform, MusicPlatform.YTMUSIC);
      assert.equal(resolved.id, 'yt_album_ver');
      assert.equal(resolved.uri, 'https://music.youtube.com/watch?v=yt_album_ver');

      // Verify cached
      const cached = resolver.getMapping(spotifyTrack.identityKey);
      assert.equal(cached.ytVideoId, 'yt_album_ver');
    } finally {
      ytmusicApi.request = origRequest;
    }
  });

  test('resolves foreign YouTube Music track to Spotify with duration check', async () => {
    const resolver = new TrackResolver();
    const origSearch = spotifyApi.searchTracks;

    spotifyApi.searchTracks = async (query) => {
      return [
        new Track({
          id: 'sp_studio_yellow',
          name: 'Yellow',
          artists: ['Coldplay'],
          durationMs: 269000, // 4m29s
          platform: MusicPlatform.SPOTIFY,
        }),
      ];
    };

    try {
      const ytTrack = new Track({
        id: 'yt_vid_yellow',
        name: 'Yellow',
        artists: ['Coldplay'],
        durationMs: 271000, // 4m31s -> within 15s of 269s
        platform: MusicPlatform.YTMUSIC,
      });

      const resolved = await resolver.resolveTrack(ytTrack, MusicPlatform.SPOTIFY);
      assert.ok(resolved);
      assert.equal(resolved.platform, MusicPlatform.SPOTIFY);
      assert.equal(resolved.id, 'sp_studio_yellow');
      assert.equal(resolved.uri, 'spotify:track:sp_studio_yellow');

      // Verify cached
      const cached = resolver.getMapping(ytTrack.identityKey);
      assert.equal(cached.spotifyId, 'sp_studio_yellow');
    } finally {
      spotifyApi.searchTracks = origSearch;
    }
  });

  test('resolveTracks batches multiple tracks with progress reporting', async () => {
    const resolver = new TrackResolver();
    const origRequest = ytmusicApi.request;

    ytmusicApi.request = async (endpoint) => {
      if (endpoint.startsWith('/search')) {
        return { items: [{ id: { videoId: 'yt_auto_resolved' } }] };
      }
      return { items: [] };
    };

    try {
      const nativeYT = new Track({ id: 'vid11111111', name: 'Native', platform: MusicPlatform.YTMUSIC });
      const foreignSP = new Track({ id: 'sp1234567890', name: 'Foreign', artists: ['Artist'], platform: MusicPlatform.SPOTIFY });

      const progressSteps = [];
      const result = await resolver.resolveTracks([nativeYT, foreignSP], MusicPlatform.YTMUSIC, (cur, tot, t) => {
        progressSteps.push({ cur, tot, name: t.name });
      });

      assert.equal(result.stats.total, 2);
      assert.equal(result.stats.native, 1);
      assert.equal(result.stats.resolved, 1);
      assert.equal(result.resolvedTracks.length, 2);
      assert.equal(progressSteps.length, 2);
      assert.equal(progressSteps[0].cur, 1);
      assert.equal(progressSteps[1].cur, 2);
    } finally {
      ytmusicApi.request = origRequest;
    }
  });

  test('cross-platform set operations: Spotify Track ∩ YouTube Track generates identical identityKey and resolves cleanly', async () => {
    const resolver = new TrackResolver();

    // Track 1 from Spotify
    const spotifyTrack = new Track({
      id: 'sp_creep_01',
      name: 'Creep',
      artists: ['Radiohead'],
      durationMs: 238000,
      platform: MusicPlatform.SPOTIFY,
      uri: 'spotify:track:sp_creep_01',
    });

    // Track 2 from YouTube Music (normalized from "Radiohead - Topic")
    const ytTrack = new Track({
      id: 'XFkzRNyygfk',
      name: 'Creep',
      artists: ['Radiohead'],
      durationMs: 239000,
      platform: MusicPlatform.YTMUSIC,
      uri: 'https://music.youtube.com/watch?v=XFkzRNyygfk',
    });

    // Both tracks produce identical identity keys
    assert.equal(spotifyTrack.identityKey, ytTrack.identityKey);
    assert.equal(spotifyTrack.identityKey, 'meta:creep::radiohead');

    // Set Engine Intersection
    const setA = new Map([[spotifyTrack.identityKey, spotifyTrack]]);
    const setB = new Map([[ytTrack.identityKey, ytTrack]]);
    const intersection = SetEngine.intersection(setA, setB);

    assert.equal(intersection.size, 1);
    const commonTrack = Array.from(intersection.values())[0];
    assert.equal(commonTrack.identityKey, 'meta:creep::radiohead');

    // Pre-seed resolution for bidirectional test
    resolver.saveMapping(commonTrack.identityKey, {
      spotifyId: 'sp_creep_01',
      ytVideoId: 'XFkzRNyygfk',
    });

    // Resolve for Spotify destination
    const resolvedSpotify = await resolver.resolveTrack(commonTrack, MusicPlatform.SPOTIFY);
    assert.equal(resolvedSpotify.platform, MusicPlatform.SPOTIFY);
    assert.equal(resolvedSpotify.id, 'sp_creep_01');

    // Resolve for YouTube Music destination
    const resolvedYT = await resolver.resolveTrack(commonTrack, MusicPlatform.YTMUSIC);
    assert.equal(resolvedYT.platform, MusicPlatform.YTMUSIC);
    assert.equal(resolvedYT.id, 'XFkzRNyygfk');
  });
});
