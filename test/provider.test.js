import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { ProviderRegistry } from '../js/providers/provider-registry.js';
import { spotifyProvider } from '../js/providers/spotify/spotify-provider.js';
import { ytMusicProvider } from '../js/providers/ytmusic/ytmusic-provider.js';
import { SpotifyApi } from '../js/providers/spotify/spotify-api.js';

describe('Provider Registry & Multi-Service Decoupling', () => {
  test('registers multiple providers and switches active provider', () => {
    ProviderRegistry.register(spotifyProvider);
    ProviderRegistry.register(ytMusicProvider);

    const all = ProviderRegistry.getAll();
    assert.equal(all.length, 2);

    ProviderRegistry.setActive('spotify');
    assert.equal(ProviderRegistry.getActive().id, 'spotify');
    assert.equal(ProviderRegistry.getActive().name, 'Spotify');

    ProviderRegistry.setActive('ytmusic');
    assert.equal(ProviderRegistry.getActive().id, 'ytmusic');
    assert.equal(ProviderRegistry.getActive().name.includes('YouTube Music'), true);

    // Switch back
    ProviderRegistry.setActive('spotify');
  });

  test('SpotifyApi.parseSpotifyId correctly parses URLs, URIs, and raw IDs', () => {
    const urlTest = SpotifyApi.parseSpotifyId('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=123');
    assert.equal(urlTest.type, 'playlist');
    assert.equal(urlTest.id, '37i9dQZF1DXcBWIGoYBM5M');

    const albumUrlTest = SpotifyApi.parseSpotifyId('https://open.spotify.com/album/2REb6YDnp5qH9IIkMza580');
    assert.equal(albumUrlTest.type, 'album');
    assert.equal(albumUrlTest.id, '2REb6YDnp5qH9IIkMza580');

    const uriTest = SpotifyApi.parseSpotifyId('spotify:album:2REb6YDnp5qH9IIkMza580');
    assert.equal(uriTest.type, 'album');
    assert.equal(uriTest.id, '2REb6YDnp5qH9IIkMza580');

    const rawIdTest = SpotifyApi.parseSpotifyId('37i9dQZF1DXcBWIGoYBM5M', 'playlist');
    assert.equal(rawIdTest.type, 'playlist');
    assert.equal(rawIdTest.id, '37i9dQZF1DXcBWIGoYBM5M');
  });

  test('SpotifyAuth defaults to configured Client ID and callback URI', async () => {
    const { spotifyAuth, DEFAULT_CLIENT_ID, DEFAULT_REDIRECT_URI } = await import(
      '../js/providers/spotify/spotify-auth.js'
    );
    assert.equal(DEFAULT_CLIENT_ID, '88962541e5e34523861008cd3c75a285');
    assert.equal(DEFAULT_REDIRECT_URI, 'http://127.0.0.1:8888/callback');
    assert.equal(spotifyAuth.getClientId(), '88962541e5e34523861008cd3c75a285');
    assert.equal(spotifyAuth.getRedirectUri(), 'http://127.0.0.1:8888/callback');
  });

  test('SpotifyApi.getPlaylist parses classic tracks.items format', async () => {
    const api = new SpotifyApi();
    api.request = async (endpoint) => {
      if (endpoint === '/playlists/classic_123') {
        return {
          id: 'classic_123',
          name: 'Classic Playlist',
          tracks: {
            total: 2,
            items: [
              {
                track: {
                  id: 'tr_1',
                  name: 'Song One',
                  artists: [{ name: 'Band A' }],
                  album: { name: 'Album A', images: [{ url: 'http://art.jpg' }] },
                },
              },
              {
                track: {
                  id: 'tr_2',
                  name: 'Song Two',
                  artists: [{ name: 'Band B' }],
                  album: { name: 'Album B' },
                },
              },
            ],
            next: null,
          },
        };
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`);
    };

    const col = await api.getPlaylist('classic_123');
    assert.equal(col.name, 'Classic Playlist');
    assert.equal(col.trackCount, 2);
    assert.equal(col.totalCount, 2);
  });

  test('SpotifyApi.getPlaylist parses modern items.items with { item: ... } wrapper', async () => {
    const api = new SpotifyApi();
    api.request = async (endpoint) => {
      if (endpoint === '/playlists/modern_456') {
        return {
          id: 'modern_456',
          name: 'Modern Playlist',
          items: {
            total: 2,
            items: [
              {
                item: {
                  id: 'tr_3',
                  name: 'Song Three',
                  artists: [{ name: 'Artist C' }],
                },
              },
              {
                id: 'tr_4',
                name: 'Song Four',
                artists: ['Artist D'],
              },
            ],
            next: null,
          },
        };
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`);
    };

    const col = await api.getPlaylist('modern_456');
    assert.equal(col.name, 'Modern Playlist');
    assert.equal(col.trackCount, 2);
  });

  test('SpotifyApi.getPlaylist fetches separate items endpoint if not embedded in metadata', async () => {
    const api = new SpotifyApi();
    api.request = async (endpoint) => {
      if (endpoint === '/playlists/no_embed_789') {
        return {
          id: 'no_embed_789',
          name: 'Shallow Metadata Playlist',
          tracks: { total: 1, items: [] }, // empty items in main object
        };
      }
      if (endpoint === '/playlists/no_embed_789/items?limit=50') {
        return {
          total: 1,
          items: [
            {
              track: {
                id: 'tr_5',
                name: 'Fetched Track',
                artists: [{ name: 'Solo Artist' }],
              },
            },
          ],
          next: null,
        };
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`);
    };

    const col = await api.getPlaylist('no_embed_789');
    assert.equal(col.name, 'Shallow Metadata Playlist');
    assert.equal(col.trackCount, 1);
  });

  test('ProviderRegistry persists active provider selection in Storage', async () => {
    const { Storage } = await import('../js/utils/storage.js');
    ProviderRegistry.setActive('ytmusic');
    assert.equal(Storage.get('sso_active_provider_id'), 'ytmusic');
    assert.equal(ProviderRegistry.getActive().id, 'ytmusic');

    ProviderRegistry.setActive('spotify');
    assert.equal(Storage.get('sso_active_provider_id'), 'spotify');
    assert.equal(ProviderRegistry.getActive().id, 'spotify');
  });
});
