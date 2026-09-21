import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/playlist.dart';
import '../models/track.dart';

class YTMusicService {
  final String? accessToken;
  final http.Client client;

  YTMusicService({required this.accessToken, http.Client? client})
      : client = client ?? http.Client();

  Map<String, String> get _headers => {
        'Authorization': 'Bearer $accessToken',
        'Content-Type': 'application/json',
      };

  /// Fetches user's YouTube Music playlists
  Future<List<Playlist>> getUserPlaylists() async {
    if (accessToken == null || accessToken!.isEmpty) return [];

    final response = await client.get(
      Uri.parse('https://www.googleapis.com/youtube/v3/playlists?mine=true&part=snippet,contentDetails&maxResults=50'),
      headers: _headers,
    );

    if (response.statusCode != 200) return [];

    final data = jsonDecode(response.body);
    final items = data['items'] as List? ?? [];
    return items.map((item) {
      final snippet = item['snippet'] ?? {};
      final thumbnails = snippet['thumbnails'] ?? {};
      final defaultThumb = thumbnails['high']?['url'] ?? thumbnails['default']?['url'];

      return Playlist(
        id: item['id'] ?? '',
        name: snippet['title'] ?? 'YouTube Playlist',
        description: snippet['description'] as String?,
        imageUrl: defaultThumb,
        ownerName: snippet['channelTitle'] ?? 'YouTube Music',
        totalTracks: item['contentDetails']?['itemCount'] ?? 0,
        platform: MusicPlatform.ytmusic,
      );
    }).toList();
  }

  /// Search playlists or tracks in YouTube API
  Future<List<dynamic>> search(String query, {required String type}) async {
    if (accessToken == null || accessToken!.isEmpty || query.trim().isEmpty) return [];

    final q = Uri.encodeComponent(query);
    final searchType = type == 'playlist' ? 'playlist' : 'video';
    final response = await client.get(
      Uri.parse('https://www.googleapis.com/youtube/v3/search?q=$q&type=$searchType&part=snippet&maxResults=20'),
      headers: _headers,
    );

    if (response.statusCode != 200) return [];

    final data = jsonDecode(response.body);
    final items = data['items'] as List? ?? [];

    if (type == 'playlist') {
      return items.map((item) {
        final snippet = item['snippet'] ?? {};
        final id = item['id']?['playlistId'] ?? item['id'];
        final thumbnails = snippet['thumbnails'] ?? {};
        return Playlist(
          id: id is String ? id : '',
          name: snippet['title'] ?? 'Playlist',
          imageUrl: thumbnails['medium']?['url'] ?? thumbnails['default']?['url'],
          ownerName: snippet['channelTitle'] ?? '',
          platform: MusicPlatform.ytmusic,
        );
      }).toList();
    }
    return [];
  }

  /// Fetches tracks of a playlist via YouTube playlistItems API
  Future<List<Track>> getPlaylistTracks(String playlistId) async {
    if (accessToken == null || accessToken!.isEmpty) return [];

    List<Track> tracks = [];
    String? pageToken;

    do {
      var url = 'https://www.googleapis.com/youtube/v3/playlistItems?playlistId=$playlistId&part=snippet,contentDetails&maxResults=50';
      if (pageToken != null) {
        url += '&pageToken=$pageToken';
      }

      final response = await client.get(Uri.parse(url), headers: _headers);
      if (response.statusCode != 200) break;

      final data = jsonDecode(response.body);
      final items = data['items'] as List? ?? [];

      for (var item in items) {
        final snippet = item['snippet'] ?? {};
        final videoId = item['contentDetails']?['videoId'] ?? snippet['resourceId']?['videoId'];
        if (videoId == null) continue;

        final thumbnails = snippet['thumbnails'] ?? {};
        final imageUrl = thumbnails['high']?['url'] ?? thumbnails['default']?['url'];

        tracks.add(Track(
          id: videoId,
          name: snippet['title'] ?? 'Video Track',
          artists: [snippet['videoOwnerChannelTitle'] ?? snippet['channelTitle'] ?? 'YouTube Music'],
          albumArtUrl: imageUrl,
          platform: MusicPlatform.ytmusic,
        ));
      }

      pageToken = data['nextPageToken'] as String?;
    } while (pageToken != null && pageToken.isNotEmpty);

    return tracks;
  }

  /// Create a YouTube Music / YouTube playlist
  Future<Playlist?> createPlaylist({
    required String name,
    required List<Track> tracks,
    String description = 'Created with Playlist Set Operations',
  }) async {
    if (accessToken == null || accessToken!.isEmpty) return null;

    final createResponse = await client.post(
      Uri.parse('https://www.googleapis.com/youtube/v3/playlists?part=snippet,status'),
      headers: _headers,
      body: jsonEncode({
        'snippet': {
          'title': name,
          'description': description,
        },
        'status': {
          'privacyStatus': 'private',
        },
      }),
    );

    if (createResponse.statusCode != 200 && createResponse.statusCode != 201) return null;

    final playlistData = jsonDecode(createResponse.body);
    final playlistId = playlistData['id'] as String;

    // Add videos to playlist
    for (var track in tracks) {
      if (track.id.isEmpty) continue;
      await client.post(
        Uri.parse('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet'),
        headers: _headers,
        body: jsonEncode({
          'snippet': {
            'playlistId': playlistId,
            'resourceId': {
              'kind': 'youtube#video',
              'videoId': track.id,
            }
          }
        }),
      );
    }

    return Playlist(
      id: playlistId,
      name: name,
      description: description,
      tracks: tracks,
      platform: MusicPlatform.ytmusic,
    );
  }
}
