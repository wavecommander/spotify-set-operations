import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  YTMusicApi,
  ytmusicApi,
  unescapeHtml,
  parseIso8601Duration,
  normalizeYouTubeMetadata,
} from '../js/providers/ytmusic/ytmusic-api.js';
import { Track, MusicCollection, CollectionType, MusicPlatform } from '../js/core/models.js';

describe('YouTube Music API Client & Normalization Engine', () => {
  describe('Helper Functions & Parsers', () => {
    test('unescapeHtml correctly decodes standard HTML entities', () => {
      assert.equal(unescapeHtml('Rock &amp; Roll'), 'Rock & Roll');
      assert.equal(unescapeHtml('Don&#39;t Stop Me Now'), "Don't Stop Me Now");
      assert.equal(unescapeHtml('&quot;Greatest Hits&quot;'), '"Greatest Hits"');
      assert.equal(unescapeHtml('&lt;Live&gt;'), '<Live>');
      assert.equal(unescapeHtml(null), '');
    });

    test('parseIso8601Duration converts ISO 8601 strings into milliseconds', () => {
      assert.equal(parseIso8601Duration('PT4M13S'), 253000);
      assert.equal(parseIso8601Duration('PT1H2M30S'), 3750000);
      assert.equal(parseIso8601Duration('PT45S'), 45000);
      assert.equal(parseIso8601Duration('PT10M'), 600000);
      assert.equal(parseIso8601Duration('PT2H'), 7200000);
      assert.equal(parseIso8601Duration(''), 0);
      assert.equal(parseIso8601Duration('invalid'), 0);
    });

    test('YTMusicApi.parseYouTubeId correctly parses URLs and IDs', () => {
      // YouTube Music playlist
      const ytMusicPlay = YTMusicApi.parseYouTubeId('https://music.youtube.com/playlist?list=PLrAl5_kG1K2s_test123');
      assert.equal(ytMusicPlay.id, 'PLrAl5_kG1K2s_test123');
      assert.equal(ytMusicPlay.type, 'playlist');

      // YouTube Music album (starts with OLAK5uy_)
      const ytMusicAlbum = YTMusicApi.parseYouTubeId('https://music.youtube.com/playlist?list=OLAK5uy_albumpres123');
      assert.equal(ytMusicAlbum.id, 'OLAK5uy_albumpres123');
      assert.equal(ytMusicAlbum.type, 'album');

      // YouTube browse album
      const browseAlbum = YTMusicApi.parseYouTubeId('https://music.youtube.com/browse/MPREb_releaseXYZ');
      assert.equal(browseAlbum.id, 'MPREb_releaseXYZ');
      assert.equal(browseAlbum.type, 'album');

      // Standard YouTube playlist URL
      const ytStandard = YTMusicApi.parseYouTubeId('https://www.youtube.com/playlist?list=PLclassic456');
      assert.equal(ytStandard.id, 'PLclassic456');
      assert.equal(ytStandard.type, 'playlist');

      // Video in playlist URL
      const ytWatchList = YTMusicApi.parseYouTubeId('https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=PLwatchList789');
      assert.equal(ytWatchList.id, 'PLwatchList789');
      assert.equal(ytWatchList.type, 'playlist');

      // Raw IDs
      const rawAlbum = YTMusicApi.parseYouTubeId('OLAK5uy_direct123');
      assert.equal(rawAlbum.id, 'OLAK5uy_direct123');
      assert.equal(rawAlbum.type, 'album');

      const rawPlaylist = YTMusicApi.parseYouTubeId('PLdirect456');
      assert.equal(rawPlaylist.id, 'PLdirect456');
      assert.equal(rawPlaylist.type, 'playlist');

      // Internal backend URI prefixes
      const uriAlbum = YTMusicApi.parseYouTubeId('ytmusic:album:OLAK5uy_prefix789');
      assert.equal(uriAlbum.id, 'OLAK5uy_prefix789');
      assert.equal(uriAlbum.type, 'album');

      const uriPlaylist = YTMusicApi.parseYouTubeId('ytmusic:playlist:PLprefix012');
      assert.equal(uriPlaylist.id, 'PLprefix012');
      assert.equal(uriPlaylist.type, 'playlist');
    });

    test('normalizeYouTubeMetadata sanitizes title and extracts artist accurately', () => {
      // 1. Topic channel (YouTube Music official track release)
      const topicMeta = normalizeYouTubeMetadata({
        title: 'Creep',
        videoOwnerChannelTitle: 'Radiohead - Topic',
      });
      assert.equal(topicMeta.title, 'Creep');
      assert.equal(topicMeta.artist, 'Radiohead');

      // Verify that this produces identical identityKey to Spotify
      const ytTrack = new Track({
        id: 'vid1',
        name: topicMeta.title,
        artists: [topicMeta.artist],
        platform: MusicPlatform.YTMUSIC,
      });
      const spotifyTrack = new Track({
        id: 'sp1',
        name: 'Creep',
        artists: ['Radiohead'],
        platform: MusicPlatform.SPOTIFY,
      });
      assert.equal(ytTrack.identityKey, spotifyTrack.identityKey);
      assert.equal(ytTrack.identityKey, 'meta:creep::radiohead');

      // 2. Video title with "Artist - Song Name" and promotional noise
      const promoMeta = normalizeYouTubeMetadata({
        title: 'Queen - Bohemian Rhapsody (Official Music Video)',
        channelTitle: 'Queen Official',
      });
      assert.equal(promoMeta.title, 'Bohemian Rhapsody');
      assert.equal(promoMeta.artist, 'Queen');

      // 3. Remaster noise and dash variations
      const remasterMeta = normalizeYouTubeMetadata({
        title: 'Pink Floyd – Time [2011 Remastered]',
        channelTitle: 'Pink Floyd VEVO',
      });
      assert.equal(remasterMeta.title, 'Time');
      assert.equal(remasterMeta.artist, 'Pink Floyd');

      // 4. Lyric video noise
      const lyricMeta = normalizeYouTubeMetadata({
        title: 'Coldplay - Yellow (Official Lyric Video)',
        channelTitle: 'Coldplay',
      });
      assert.equal(lyricMeta.title, 'Yellow');
      assert.equal(lyricMeta.artist, 'Coldplay');
    });
  });

  describe('API Requests & Methods', () => {
    test('search parses YouTube Data API response into playlists and albums', async () => {
      const api = new YTMusicApi();
      api.request = async (endpoint) => {
        if (endpoint.includes('/search')) {
          return {
            items: [
              {
                id: { playlistId: 'PLrock_hits' },
                snippet: {
                  title: 'Classic Rock Hits &amp; Anthems',
                  channelTitle: 'Rock Music Channel',
                  thumbnails: {
                    high: { url: 'https://example.com/rock.jpg' },
                  },
                },
              },
              {
                id: { playlistId: 'OLAK5uy_album_ab' },
                snippet: {
                  title: 'Abbey Road (Remastered)',
                  channelTitle: 'The Beatles - Topic',
                  thumbnails: {
                    high: { url: 'https://example.com/abbey.jpg' },
                  },
                },
              },
            ],
          };
        }
        return { items: [] };
      };

      const result = await api.search('rock', ['playlist', 'album']);
      assert.equal(result.playlists.length, 1);
      assert.equal(result.albums.length, 1);

      const playlist = result.playlists[0];
      assert.equal(playlist.id, 'ytmusic:playlist:PLrock_hits');
      assert.equal(playlist.name, 'Classic Rock Hits & Anthems');
      assert.equal(playlist.owner, 'Rock Music Channel');
      assert.equal(playlist.type, CollectionType.PLAYLIST);
      assert.equal(playlist.platform, MusicPlatform.YTMUSIC);

      const album = result.albums[0];
      assert.equal(album.id, 'ytmusic:album:OLAK5uy_album_ab');
      assert.equal(album.name, 'Abbey Road (Remastered)');
      assert.equal(album.type, CollectionType.ALBUM);
      assert.equal(album.platform, MusicPlatform.YTMUSIC);
    });

    test('getPlaylist fetches metadata, paginates items, and batches video duration queries', async () => {
      const api = new YTMusicApi();
      let videoBatchQueried = false;

      api.request = async (endpoint) => {
        if (endpoint.startsWith('/playlists')) {
          return {
            items: [
              {
                snippet: {
                  title: 'Awesome Mix Vol. 1',
                  channelTitle: 'Star Lord',
                  thumbnails: { high: { url: 'https://example.com/cover.jpg' } },
                },
                contentDetails: { itemCount: 2 },
              },
            ],
          };
        }
        if (endpoint.startsWith('/playlistItems')) {
          return {
            items: [
              {
                contentDetails: { videoId: 'vid_hooked' },
                snippet: {
                  title: 'Blue Swede - Hooked on a Feeling (Official Audio)',
                  channelTitle: 'Blue Swede - Topic',
                },
              },
              {
                contentDetails: { videoId: 'vid_cherry' },
                snippet: {
                  title: 'The Runaways - Cherry Bomb',
                  videoOwnerChannelTitle: 'The Runaways - Topic',
                },
              },
            ],
            nextPageToken: null,
          };
        }
        if (endpoint.startsWith('/videos')) {
          videoBatchQueried = true;
          return {
            items: [
              {
                id: 'vid_hooked',
                contentDetails: { duration: 'PT2M52S' },
                snippet: {
                  thumbnails: { maxres: { url: 'https://example.com/hooked.jpg' } },
                },
              },
              {
                id: 'vid_cherry',
                contentDetails: { duration: 'PT2M18S' },
                snippet: {
                  thumbnails: { maxres: { url: 'https://example.com/cherry.jpg' } },
                },
              },
            ],
          };
        }
        return { items: [] };
      };

      let progressReports = 0;
      const collection = await api.getPlaylist('https://music.youtube.com/playlist?list=PLguardians_mix', () => {
        progressReports++;
      });

      assert.equal(collection.id, 'ytmusic:playlist:PLguardians_mix');
      assert.equal(collection.name, 'Awesome Mix Vol. 1');
      assert.equal(collection.owner, 'Star Lord');
      assert.equal(collection.trackCount, 2);
      assert.equal(collection.platform, MusicPlatform.YTMUSIC);
      assert.equal(videoBatchQueried, true);
      assert.ok(progressReports > 0);

      const tracks = collection.trackList;
      assert.equal(tracks[0].id, 'vid_hooked');
      assert.equal(tracks[0].name, 'Hooked on a Feeling');
      assert.equal(tracks[0].artistString, 'Blue Swede');
      assert.equal(tracks[0].durationMs, 172000); // 2m52s = 172s = 172000ms

      assert.equal(tracks[1].id, 'vid_cherry');
      assert.equal(tracks[1].name, 'Cherry Bomb');
      assert.equal(tracks[1].artistString, 'The Runaways');
      assert.equal(tracks[1].durationMs, 138000); // 2m18s = 138s = 138000ms
    });

    test('getAlbum delegates to getPlaylist and sets collection type to ALBUM', async () => {
      const api = new YTMusicApi();
      api.request = async (endpoint) => {
        if (endpoint.startsWith('/playlists')) {
          return {
            items: [{ snippet: { title: 'Parachutes', channelTitle: 'Coldplay - Topic' }, contentDetails: { itemCount: 1 } }],
          };
        }
        if (endpoint.startsWith('/playlistItems')) {
          return {
            items: [
              {
                contentDetails: { videoId: 'vid_yellow' },
                snippet: { title: 'Coldplay - Yellow', videoOwnerChannelTitle: 'Coldplay - Topic' },
              },
            ],
          };
        }
        if (endpoint.startsWith('/videos')) {
          return {
            items: [{ id: 'vid_yellow', contentDetails: { duration: 'PT4M29S' } }],
          };
        }
        return { items: [] };
      };

      const album = await api.getAlbum('OLAK5uy_parachutes');
      assert.equal(album.type, CollectionType.ALBUM);
      assert.equal(album.name, 'Parachutes');
      assert.equal(album.trackCount, 1);

      // Verify that backend ID from search results also works cleanly
      const albumFromSearchId = await api.getAlbum('ytmusic:album:OLAK5uy_parachutes');
      assert.equal(albumFromSearchId.type, CollectionType.ALBUM);
      assert.equal(albumFromSearchId.name, 'Parachutes');
    });

    test('getAlbum and getPlaylist reject MPREb browse IDs with clear guidance', async () => {
      const api = new YTMusicApi();
      await assert.rejects(
        () => api.getAlbum('https://music.youtube.com/browse/MPREb_abc123'),
        (err) => {
          assert.match(err.message, /Share.*Copy link.*OLAK5uy_/i);
          return true;
        }
      );
      await assert.rejects(
        () => api.getPlaylist('MPREb_abc123'),
        (err) => {
          assert.match(err.message, /Share.*Copy link.*OLAK5uy_/i);
          return true;
        }
      );
    });

    test('createPlaylist creates playlist and adds tracks with cross-platform fallback resolution', async () => {
      const api = new YTMusicApi();
      const calls = [];
      const insertedVideos = [];

      api.request = async (endpoint, options = {}) => {
        calls.push({ endpoint, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });

        if (endpoint.startsWith('/playlists') && options.method === 'POST') {
          return {
            id: 'PLnew_export_mix',
            snippet: { title: 'My Exported Set' },
          };
        }
        if (endpoint.startsWith('/search')) {
          return {
            items: [{ id: { videoId: 'vid_resolved_cross' } }],
          };
        }
        if (endpoint.startsWith('/playlistItems') && options.method === 'POST') {
          const body = JSON.parse(options.body);
          insertedVideos.push(body.snippet.resourceId.videoId);
          return { id: `item_${insertedVideos.length}` };
        }
        return {};
      };

      const nativeYTTrack = new Track({
        id: 'vid_yt_direct',
        name: 'Direct Video Song',
        artists: ['Artist A'],
        platform: MusicPlatform.YTMUSIC,
      });

      const spotifyCrossTrack = new Track({
        id: 'sp_track_22char_id12345',
        name: 'Spotify Song',
        artists: ['Artist B'],
        platform: MusicPlatform.SPOTIFY,
      });

      let progressCalls = 0;
      const result = await api.createPlaylist({
        name: 'My Exported Set',
        description: 'Exported from Set Operations',
        isPublic: true,
        tracks: [nativeYTTrack, spotifyCrossTrack],
        onProgress: (current, total) => {
          progressCalls++;
        },
      });

      assert.equal(result.id, 'PLnew_export_mix');
      assert.equal(result.name, 'My Exported Set');
      assert.equal(result.externalUrl, 'https://music.youtube.com/playlist?list=PLnew_export_mix');

      assert.equal(insertedVideos.length, 2);
      assert.equal(insertedVideos[0], 'vid_yt_direct');
      assert.equal(insertedVideos[1], 'vid_resolved_cross');
      assert.ok(progressCalls >= 2);

      // Verify playlist creation payload
      const createCall = calls.find((c) => c.endpoint.startsWith('/playlists') && c.method === 'POST');
      assert.equal(createCall.body.snippet.title, 'My Exported Set');
      assert.equal(createCall.body.status.privacyStatus, 'public');
    });

    test('addTracksToPlaylist continues smoothly when an individual video fails to insert', async () => {
      const api = new YTMusicApi();
      const inserted = [];

      api.request = async (endpoint, options = {}) => {
        if (endpoint.startsWith('/playlistItems') && options.method === 'POST') {
          const body = JSON.parse(options.body);
          if (body.snippet.resourceId.videoId === 'vid_bad_blocked') {
            throw new Error('Video unplayable in user region');
          }
          inserted.push(body.snippet.resourceId.videoId);
          return { id: 'ok' };
        }
        return {};
      };

      const t1 = new Track({ id: 'vid_good_1', name: 'Song 1', platform: MusicPlatform.YTMUSIC });
      const t2 = new Track({ id: 'vid_bad_blocked', name: 'Blocked Song', platform: MusicPlatform.YTMUSIC });
      const t3 = new Track({ id: 'vid_good_2', name: 'Song 2', platform: MusicPlatform.YTMUSIC });

      let lastProgress = null;
      await api.addTracksToPlaylist('PLtest', [t1, t2, t3], (cur, tot) => {
        lastProgress = { cur, tot };
      });

      assert.deepEqual(inserted, ['vid_good_1', 'vid_good_2']);
      assert.deepEqual(lastProgress, { cur: 3, tot: 3 });
    });

    test('replacePlaylistTracks fetches existing items, deletes them, and adds new tracks', async () => {
      const api = new YTMusicApi();
      const deletedItemIds = [];
      const insertedVideoIds = [];

      api.request = async (endpoint, options = {}) => {
        if (endpoint.startsWith('/playlistItems') && (!options.method || options.method === 'GET')) {
          return {
            items: [{ id: 'old_item_1' }, { id: 'old_item_2' }],
            nextPageToken: null,
          };
        }
        if (endpoint.startsWith('/playlistItems?id=') && options.method === 'DELETE') {
          const id = endpoint.split('id=')[1];
          deletedItemIds.push(id);
          return null;
        }
        if (endpoint.startsWith('/playlistItems') && options.method === 'POST') {
          const body = JSON.parse(options.body);
          insertedVideoIds.push(body.snippet.resourceId.videoId);
          return { id: 'new_item' };
        }
        return {};
      };

      const newTrack = new Track({ id: 'vid_new_track', name: 'New Track', platform: MusicPlatform.YTMUSIC });
      await api.replacePlaylistTracks({
        playlistId: 'PLmy_playlist',
        tracks: [newTrack],
      });

      assert.deepEqual(deletedItemIds, ['old_item_1', 'old_item_2']);
      assert.deepEqual(insertedVideoIds, ['vid_new_track']);
    });
  });
});
