import 'dart:async';
import 'package:flutter/material.dart';
import '../models/album.dart';
import '../models/music_set.dart';
import '../models/playlist.dart';
import '../models/track.dart';
import '../services/spotify_service.dart';
import '../services/ytmusic_service.dart';

class SearchAutocomplete extends StatefulWidget {
  final SpotifyService spotifyService;
  final YTMusicService ytMusicService;
  final Function(MusicSet) onSetSelected;

  const SearchAutocomplete({
    super.key,
    required this.spotifyService,
    required this.ytMusicService,
    required this.onSetSelected,
  });

  @override
  State<SearchAutocomplete> createState() => _SearchAutocompleteState();
}

class _SearchAutocompleteState extends State<SearchAutocomplete> {
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounce;
  bool _isLoading = false;
  List<dynamic> _searchResults = [];
  String _selectedSearchType = 'playlist'; // 'playlist' or 'album'

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String query) {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      _performSearch(query);
    });
  }

  Future<void> _performSearch(String query) async {
    if (query.trim().isEmpty) {
      setState(() {
        _searchResults = [];
        _isLoading = false;
      });
      return;
    }

    setState(() => _isLoading = true);

    try {
      final spotifyResults = await widget.spotifyService.search(query, type: _selectedSearchType);
      final ytResults = await widget.ytMusicService.search(query, type: _selectedSearchType);

      setState(() {
        _searchResults = [...spotifyResults, ...ytResults];
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _selectItem(dynamic item) async {
    setState(() => _isLoading = true);
    try {
      if (item is Playlist) {
        List<Track> tracks = [];
        if (item.platform == MusicPlatform.spotify) {
          tracks = await widget.spotifyService.getPlaylistTracks(item.id);
        } else {
          tracks = await widget.ytMusicService.getPlaylistTracks(item.id);
        }

        final musicSet = MusicSet(
          symbol: '', // Assigned by parent
          id: item.id,
          name: item.name,
          type: SetType.playlist,
          imageUrl: item.imageUrl,
          subtitle: 'Playlist by ${item.ownerName} (${tracks.length} tracks)',
          tracks: tracks.toSet(),
          platform: item.platform,
        );
        widget.onSetSelected(musicSet);
      } else if (item is Album) {
        List<Track> tracks = [];
        if (item.platform == MusicPlatform.spotify) {
          tracks = await widget.spotifyService.getAlbumTracks(item.id);
        }

        final musicSet = MusicSet(
          symbol: '',
          id: item.id,
          name: item.name,
          type: SetType.album,
          imageUrl: item.imageUrl,
          subtitle: 'Album by ${item.artistString} (${tracks.length} tracks)',
          tracks: tracks.toSet(),
          platform: item.platform,
        );
        widget.onSetSelected(musicSet);
      }

      _searchController.clear();
      setState(() {
        _searchResults = [];
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _searchController,
                onChanged: _onSearchChanged,
                decoration: InputDecoration(
                  labelText: 'Search playlists or albums across Spotify & YouTube Music...',
                  prefixIcon: const Icon(Icons.search),
                  suffixIcon: _isLoading
                      ? const Padding(
                          padding: EdgeInsets.all(10),
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : (_searchController.text.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear),
                              onPressed: () {
                                _searchController.clear();
                                _performSearch('');
                              },
                            )
                          : null),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'playlist', label: Text('Playlists'), icon: Icon(Icons.queue_music)),
                ButtonSegment(value: 'album', label: Text('Albums'), icon: Icon(Icons.album)),
              ],
              selected: {_selectedSearchType},
              onSelectionChanged: (set) {
                setState(() {
                  _selectedSearchType = set.first;
                });
                if (_searchController.text.isNotEmpty) {
                  _performSearch(_searchController.text);
                }
              },
            ),
          ],
        ),
        if (_searchResults.isNotEmpty) ...[
          const SizedBox(height: 8),
          Container(
            height: 280,
            decoration: BoxDecoration(
              color: Theme.of(context).cardColor,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.1),
                  blurRadius: 8,
                  offset: const Offset(0, 4),
                )
              ],
            ),
            child: ListView.separated(
              shrinkWrap: true,
              itemCount: _searchResults.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (ctx, index) {
                final item = _searchResults[index];
                final String name = item.name;
                final String? imgUrl = item.imageUrl;
                final String subtitle = item is Playlist
                    ? 'Playlist • ${item.ownerName}'
                    : 'Album • ${(item as Album).artistString}';
                final isSpotify = item.platform == MusicPlatform.spotify;

                return ListTile(
                  leading: ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: imgUrl != null && imgUrl.isNotEmpty
                        ? Image.network(imgUrl, width: 44, height: 44, fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(
                              width: 44, height: 44, color: Colors.grey.shade300,
                              child: const Icon(Icons.music_note),
                            ))
                        : Container(
                            width: 44, height: 44, color: Colors.indigo.shade100,
                            child: const Icon(Icons.music_note, color: Colors.indigo),
                          ),
                  ),
                  title: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis),
                  subtitle: Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis),
                  trailing: Chip(
                    label: Text(
                      isSpotify ? 'Spotify' : 'YouTube',
                      style: const TextStyle(fontSize: 11, color: Colors.white),
                    ),
                    backgroundColor: isSpotify ? Colors.green.shade700 : Colors.red.shade700,
                    visualDensity: VisualDensity.compact,
                  ),
                  onTap: () => _selectItem(item),
                );
              },
            ),
          ),
        ]
      ],
    );
  }
}
