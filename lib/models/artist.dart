import 'track.dart';

class Artist {
  final String id;
  final String name;
  final String? imageUrl;
  final List<String> genres;
  final int popularity;
  final MusicPlatform platform;

  const Artist({
    required this.id,
    required this.name,
    this.imageUrl,
    this.genres = const [],
    this.popularity = 0,
    this.platform = MusicPlatform.spotify,
  });

  factory Artist.fromSpotifyJson(Map<String, dynamic> json) {
    final images = json['images'] as List?;
    final imageUrl = images != null && images.isNotEmpty ? images[0]['url'] as String? : null;
    final genresList = (json['genres'] as List?)?.map((g) => g.toString()).toList() ?? [];

    return Artist(
      id: json['id'] ?? '',
      name: json['name'] ?? 'Unknown Artist',
      imageUrl: imageUrl,
      genres: genresList,
      popularity: json['popularity'] as int? ?? 0,
      platform: MusicPlatform.spotify,
    );
  }
}
