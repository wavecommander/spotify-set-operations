import 'track.dart';

enum SetType { playlist, album }

class MusicSet {
  final String symbol; // e.g., 'A', 'B', '*A'
  final String id;
  final String name;
  final SetType type;
  final String? imageUrl;
  final String? subtitle;
  final Set<Track> tracks;
  final MusicPlatform platform;

  const MusicSet({
    required this.symbol,
    required this.id,
    required this.name,
    required this.type,
    this.imageUrl,
    this.subtitle,
    this.tracks = const {},
    this.platform = MusicPlatform.spotify,
  });

  MusicSet copyWith({
    String? symbol,
    String? id,
    String? name,
    SetType? type,
    String? imageUrl,
    String? subtitle,
    Set<Track>? tracks,
    MusicPlatform? platform,
  }) {
    return MusicSet(
      symbol: symbol ?? this.symbol,
      id: id ?? this.id,
      name: name ?? this.name,
      type: type ?? this.type,
      imageUrl: imageUrl ?? this.imageUrl,
      subtitle: subtitle ?? this.subtitle,
      tracks: tracks ?? this.tracks,
      platform: platform ?? this.platform,
    );
  }
}
