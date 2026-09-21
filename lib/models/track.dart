enum MusicPlatform { spotify, ytmusic, local }

class Track {
  final String id;
  final String name;
  final List<String> artists;
  final String? albumName;
  final String? albumArtUrl;
  final int durationMs;
  final String? isrc;
  final MusicPlatform platform;

  const Track({
    required this.id,
    required this.name,
    required this.artists,
    this.albumName,
    this.albumArtUrl,
    this.durationMs = 0,
    this.isrc,
    this.platform = MusicPlatform.spotify,
  });

  String get artistString => artists.isEmpty ? 'Unknown Artist' : artists.join(', ');

  /// Unique identifier key for deduplication across or within platforms.
  /// Uses ISRC if available, otherwise fallback to lowercase "title - artist".
  String get identityKey {
    if (isrc != null && isrc!.isNotEmpty) {
      return 'isrc:${isrc!.toLowerCase()}';
    }
    final normalizedTitle = name.trim().toLowerCase();
    final normalizedArtist = artistString.trim().toLowerCase();
    return 'meta:$normalizedTitle::$normalizedArtist';
  }

  factory Track.fromSpotifyJson(Map<String, dynamic> json) {
    final trackData = json['track'] ?? json;
    final album = trackData['album'];
    final albumImages = album != null ? (album['images'] as List?) : null;
    final imageUrl = albumImages != null && albumImages.isNotEmpty ? albumImages[0]['url'] as String? : null;

    final artistsList = (trackData['artists'] as List?)
            ?.map((a) => a['name'] as String)
            .toList() ??
        [];

    final externalIds = trackData['external_ids'] as Map<String, dynamic>?;
    final isrcCode = externalIds?['isrc'] as String?;

    return Track(
      id: trackData['id'] ?? '',
      name: trackData['name'] ?? 'Unknown Track',
      artists: artistsList,
      albumName: album?['name'] as String?,
      albumArtUrl: imageUrl,
      durationMs: trackData['duration_ms'] ?? 0,
      isrc: isrcCode,
      platform: MusicPlatform.spotify,
    );
  }

  factory Track.fromYTMusicJson(Map<String, dynamic> json) {
    final artistsList = (json['artists'] as List?)
            ?.map((a) => a['name'] as String)
            .toList() ??
        [];

    return Track(
      id: json['videoId'] ?? json['id'] ?? '',
      name: json['title'] ?? json['name'] ?? 'Unknown Track',
      artists: artistsList,
      albumName: json['album']?['name'] as String?,
      albumArtUrl: json['thumbnail'] as String? ?? json['albumArtUrl'] as String?,
      durationMs: (json['durationSeconds'] as int? ?? 0) * 1000,
      isrc: json['isrc'] as String?,
      platform: MusicPlatform.ytmusic,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'artists': artists,
        'albumName': albumName,
        'albumArtUrl': albumArtUrl,
        'durationMs': durationMs,
        'isrc': isrc,
        'platform': platform.name,
      };

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Track && runtimeType == other.runtimeType && identityKey == other.identityKey;

  @override
  int get hashCode => identityKey.hashCode;
}
