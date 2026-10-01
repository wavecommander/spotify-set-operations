import { test } from 'node:test';
import assert from 'node:assert/strict';

test('all core and provider JS modules load without syntax or resolution errors', async () => {
  const models = await import('../js/core/models.js');
  assert.ok(models.Track);
  assert.ok(models.MusicCollection);

  const setEngine = await import('../js/core/set-engine.js');
  assert.ok(setEngine.SetEngine);

  const graphEngine = await import('../js/core/graph-engine.js');
  assert.ok(graphEngine.GraphEngine);

  const trackResolverMod = await import('../js/core/track-resolver.js');
  assert.ok(trackResolverMod.TrackResolver);
  assert.ok(trackResolverMod.trackResolver);

  const providerInterface = await import('../js/providers/provider-interface.js');
  assert.ok(providerInterface.MusicProvider);

  const providerRegistry = await import('../js/providers/provider-registry.js');
  assert.ok(providerRegistry.ProviderRegistry);

  const spotifyAuth = await import('../js/providers/spotify/spotify-auth.js');
  assert.ok(spotifyAuth.SpotifyAuth);

  const spotifyApi = await import('../js/providers/spotify/spotify-api.js');
  assert.ok(spotifyApi.SpotifyApi);

  const spotifyProvider = await import('../js/providers/spotify/spotify-provider.js');
  assert.ok(spotifyProvider.SpotifyProvider);

  const ytmusicProvider = await import('../js/providers/ytmusic/ytmusic-provider.js');
  assert.ok(ytmusicProvider.YTMusicProvider);

  const svgIcons = await import('../js/utils/svg-icons.js');
  assert.ok(svgIcons.SvgIcons);
  assert.ok(svgIcons.SvgIcons.vennUnion);
  assert.ok(svgIcons.SvgIcons.vennIntersection);
  assert.ok(svgIcons.SvgIcons.vennDifference);
  assert.ok(svgIcons.SvgIcons.vennSymmetricDifference);

  const storage = await import('../js/utils/storage.js');
  assert.ok(storage.Storage);

  const pkce = await import('../js/utils/pkce.js');
  assert.ok(pkce.generatePKCE);
});
