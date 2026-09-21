import 'track.dart';

class Playlist {
  final String id;
  final String name;
  final String? description;
  final String? imageUrl;
  final String ownerName;
  final int totalTracks;
  final List<Track> tracks;
  final MusicPlatform platform;

  const Playlist({
    required this.id,
    required this.name,
    this.description,
    this.imageUrl,
    this.ownerName = '',
    this.totalTracks = 0,
    this.tracks = const [],
    this.platform = MusicPlatform.spotify,
  });

  Playlist copyWith({
    String? id,
    String? name,
    String? description,
    String? imageUrl,
    String? ownerName,
    int? totalTracks,
    List<Track>? tracks,
    MusicPlatform? platform,
  }) {
    return Playlist(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      imageUrl: imageUrl ?? this.imageUrl,
      ownerName: ownerName ?? this.ownerName,
      totalTracks: totalTracks ?? this.totalTracks,
      tracks: tracks ?? this.tracks,
      platform: platform ?? this.platform,
    );
  }

  factory Playlist.fromSpotifyJson(Map<String, dynamic> json, {List<Track> tracks = const []}) {
    final images = json['images'] as List?;
    final imageUrl = images != null && images.isNotEmpty ? images[0]['url'] as String? : null;
    final owner = json['owner'] as Map<String, dynamic>?;

    return Playlist(
      id: json['id'] ?? '',
      name: json['name'] ?? 'Untitled Playlist',
      description: json['description'] as String?,
      imageUrl: imageUrl,
      ownerName: owner?['display_name'] ?? owner?['id'] ?? '',
      totalTracks: (json['tracks']?['total'] as int?) ?? tracks.length,
      tracks: tracks,
      platform: MusicPlatform.spotify,
    );
  }

  factory Playlist.fromYTMusicJson(Map<String, dynamic> json, {List<Track> tracks = const []}) {
    return Playlist(
      id: json['playlistId'] ?? json['id'] ?? '',
      name: json['title'] ?? json['name'] ?? 'Untitled Playlist',
      description: json['description'] as String?,
      imageUrl: json['thumbnail'] as String? ?? json['imageUrl'] as String?,
      ownerName: json['author'] as String? ?? 'YouTube Music',
      totalTracks: json['trackCount'] as int? ?? tracks.length,
      tracks: tracks,
      platform: MusicPlatform.ytmusic,
    );
  }
}
