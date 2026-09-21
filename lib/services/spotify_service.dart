import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/album.dart';
import '../models/playlist.dart';
import '../models/track.dart';

class SpotifyService {
  final String? accessToken;
  final http.Client client;

  SpotifyService({required this.accessToken, http.Client? client})
      : client = client ?? http.Client();

  Map<String, String> get _headers => {
        'Authorization': 'Bearer $accessToken',
        'Content-Type': 'application/json',
      };

  /// Fetches current user's saved playlists
  Future<List<Playlist>> getUserPlaylists() async {
    if (accessToken == null || accessToken!.isEmpty) return [];

    final response = await client.get(
      Uri.parse('https://api.spotify.com/v1/me/playlists?limit=50'),
      headers: _headers,
    );

    if (response.statusCode != 200) return [];

    final data = jsonDecode(response.body);
    final items = data['items'] as List? ?? [];
    return items.map((item) => Playlist.fromSpotifyJson(item)).toList();
  }

  /// Fetches current user's saved albums
  Future<List<Album>> getUserSavedAlbums() async {
    if (accessToken == null || accessToken!.isEmpty) return [];

    final response = await client.get(
      Uri.parse('https://api.spotify.com/v1/me/albums?limit=50'),
      headers: _headers,
    );

    if (response.statusCode != 200) return [];

    final data = jsonDecode(response.body);
    final items = data['items'] as List? ?? [];
    return items
        .map((item) => Album.fromSpotifyJson(item['album'] as Map<String, dynamic>))
        .toList();
  }

  /// Search playlists or albums with fast autocomplete queries
  Future<List<dynamic>> search(String query, {required String type}) async {
    if (accessToken == null || accessToken!.isEmpty || query.trim().isEmpty) return [];

    final encoded = Uri.encodeComponent(query);
    final response = await client.get(
      Uri.parse('https://api.spotify.com/v1/search?q=$encoded&type=$type&limit=20'),
      headers: _headers,
    );

    if (response.statusCode != 200) return [];

    final data = jsonDecode(response.body);
    if (type == 'playlist') {
      final items = data['playlists']?['items'] as List? ?? [];
      return items.map((item) => Playlist.fromSpotifyJson(item)).toList();
    } else if (type == 'album') {
      final items = data['albums']?['items'] as List? ?? [];
      return items.map((item) => Album.fromSpotifyJson(item)).toList();
    }
    return [];
  }

  /// Fetches all tracks of a playlist with pagination support
  Future<List<Track>> getPlaylistTracks(String playlistId) async {
    if (accessToken == null || accessToken!.isEmpty) return [];

    List<Track> tracks = [];
    String? nextUrl = 'https://api.spotify.com/v1/playlists/$playlistId/tracks?limit=100';

    while (nextUrl != null) {
      final response = await client.get(Uri.parse(nextUrl), headers: _headers);
      if (response.statusCode != 200) break;

      final data = jsonDecode(response.body);
      final items = data['items'] as List? ?? [];
      for (var item in items) {
        if (item['track'] != null) {
          tracks.add(Track.fromSpotifyJson(item));
        }
      }
      nextUrl = data['next'] as String?;
    }

    return tracks;
  }

  /// Fetches tracks from an album
  Future<List<Track>> getAlbumTracks(String albumId) async {
    if (accessToken == null || accessToken!.isEmpty) return [];

    final response = await client.get(
      Uri.parse('https://api.spotify.com/v1/albums/$albumId'),
      headers: _headers,
    );

    if (response.statusCode != 200) return [];

    final albumJson = jsonDecode(response.body);
    final items = albumJson['tracks']?['items'] as List? ?? [];
    return items.map((item) {
      // Inject album metadata into track item
      item['album'] = albumJson;
      return Track.fromSpotifyJson(item);
    }).toList();
  }

  /// Gets current user Spotify profile ID
  Future<String?> getCurrentUserId() async {
    if (accessToken == null || accessToken!.isEmpty) return null;

    final response = await client.get(
      Uri.parse('https://api.spotify.com/v1/me'),
      headers: _headers,
    );

    if (response.statusCode != 200) return null;
    final data = jsonDecode(response.body);
    return data['id'] as String?;
  }

  /// Resolves track to a Spotify track ID if it belongs to another platform (e.g. YouTube Music)
  Future<String?> resolveSpotifyTrackId(Track track) async {
    if (track.platform == MusicPlatform.spotify) {
      return track.id;
    }
    if (track.isrc != null && track.isrc!.isNotEmpty) {
      final res = await client.get(
        Uri.parse('https://api.spotify.com/v1/search?q=isrc:${track.isrc}&type=track&limit=1'),
        headers: _headers,
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final items = data['tracks']?['items'] as List? ?? [];
        if (items.isNotEmpty) {
          return items[0]['id'] as String?;
        }
      }
    }
    final q = Uri.encodeComponent('${track.name} ${track.artistString}');
    final res = await client.get(
      Uri.parse('https://api.spotify.com/v1/search?q=$q&type=track&limit=1'),
      headers: _headers,
    );
    if (res.statusCode == 200) {
      final data = jsonDecode(res.body);
      final items = data['tracks']?['items'] as List? ?? [];
      if (items.isNotEmpty) {
        return items[0]['id'] as String?;
      }
    }
    return null;
  }

  /// Creates a new playlist and populates it with tracks in batches of 100
  Future<Playlist?> createPlaylist({
    required String name,
    required List<Track> tracks,
    String description = 'Created with Playlist Set Operations',
    bool isPublic = true,
  }) async {
    final userId = await getCurrentUserId();
    if (userId == null) return null;

    final createResponse = await client.post(
      Uri.parse('https://api.spotify.com/v1/users/$userId/playlists'),
      headers: _headers,
      body: jsonEncode({
        'name': name,
        'description': description,
        'public': isPublic,
      }),
    );

    if (createResponse.statusCode != 201 && createResponse.statusCode != 200) {
      return null;
    }

    final newPlaylistData = jsonDecode(createResponse.body);
    final playlistId = newPlaylistData['id'] as String;

    final List<String> spotifyTrackIds = [];
    for (var track in tracks) {
      final id = await resolveSpotifyTrackId(track);
      if (id != null && id.isNotEmpty) {
        spotifyTrackIds.add(id);
      }
    }

    final uris = spotifyTrackIds.map((id) => 'spotify:track:$id').toList();
    const stepSize = 100;
    for (int i = 0; i < uris.length; i += stepSize) {
      final end = (i + stepSize < uris.length) ? i + stepSize : uris.length;
      final chunk = uris.sublist(i, end);

      await client.post(
        Uri.parse('https://api.spotify.com/v1/playlists/$playlistId/tracks'),
        headers: _headers,
        body: jsonEncode({'uris': chunk}),
      );
    }

    return Playlist.fromSpotifyJson(newPlaylistData, tracks: tracks);
  }
}
