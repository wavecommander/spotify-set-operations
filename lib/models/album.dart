import 'track.dart';

class Album {
  final String id;
  final String name;
  final List<String> artists;
  final String? imageUrl;
  final String? releaseDate;
  final int totalTracks;
  final List<Track> tracks;
  final MusicPlatform platform;

  const Album({
    required this.id,
    required this.name,
    required this.artists,
    this.imageUrl,
    this.releaseDate,
    this.totalTracks = 0,
    this.tracks = const [],
    this.platform = MusicPlatform.spotify,
  });

  String get artistString => artists.isEmpty ? 'Unknown Artist' : artists.join(', ');

  factory Album.fromSpotifyJson(Map<String, dynamic> json, {List<Track> tracks = const []}) {
    final images = json['images'] as List?;
    final imageUrl = images != null && images.isNotEmpty ? images[0]['url'] as String? : null;
    final artistsList = (json['artists'] as List?)
            ?.map((a) => a['name'] as String)
            .toList() ??
        [];

    return Album(
      id: json['id'] ?? '',
      name: json['name'] ?? 'Untitled Album',
      artists: artistsList,
      imageUrl: imageUrl,
      releaseDate: json['release_date'] as String?,
      totalTracks: (json['total_tracks'] as int?) ?? tracks.length,
      tracks: tracks,
      platform: MusicPlatform.spotify,
    );
  }

  factory Album.fromYTMusicJson(Map<String, dynamic> json, {List<Track> tracks = const []}) {
    final artistsList = (json['artists'] as List?)
            ?.map((a) => a['name'] as String)
            .toList() ??
        [];

    return Album(
      id: json['browseId'] ?? json['id'] ?? '',
      name: json['title'] ?? json['name'] ?? 'Untitled Album',
      artists: artistsList,
      imageUrl: json['thumbnail'] as String? ?? json['imageUrl'] as String?,
      releaseDate: json['year'] as String?,
      totalTracks: json['trackCount'] as int? ?? tracks.length,
      tracks: tracks,
      platform: MusicPlatform.ytmusic,
    );
  }
}
