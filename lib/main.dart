import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'models/music_set.dart';
import 'models/playlist.dart';
import 'models/track.dart';
import 'services/auth_service.dart';
import 'services/expression_parser.dart';
import 'services/set_engine.dart';
import 'services/spotify_service.dart';
import 'services/ytmusic_service.dart';
import 'widgets/auth_bar.dart';
import 'widgets/search_autocomplete.dart';
import 'widgets/track_preview_list.dart';
import 'widgets/visual_set_builder.dart';

void main() {
  runApp(
    ChangeNotifierProvider(
      create: (_) => AuthService(),
      child: const PlaylistSetOperationsApp(),
    ),
  );
}

class PlaylistSetOperationsApp extends StatelessWidget {
  const PlaylistSetOperationsApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Spotify & YT Music Sets',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.indigo,
          brightness: Brightness.light,
        ),
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.indigo,
          brightness: Brightness.dark,
        ),
      ),
      home: const MainHomeScreen(),
    );
  }
}

class MainHomeScreen extends StatefulWidget {
  const MainHomeScreen({super.key});

  @override
  State<MainHomeScreen> createState() => _MainHomeScreenState();
}

class _MainHomeScreenState extends State<MainHomeScreen> {
  final List<MusicSet> _loadedSets = [];
  String _expression = '';
  Set<Track> _evaluatedTracks = {};
  String? _expressionError;

  List<Playlist> _userPlaylists = [];
  bool _isLoadingUserPlaylists = false;

  late SpotifyService _spotifyService;
  late YTMusicService _ytMusicService;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final authService = Provider.of<AuthService>(context);
    _spotifyService = SpotifyService(accessToken: authService.spotifyAccessToken);
    _ytMusicService = YTMusicService(accessToken: authService.ytmusicAccessToken);

    if (authService.isSpotifyConnected || authService.isYTMusicConnected) {
      _fetchUserPlaylists();
    }
  }

  Future<void> _fetchUserPlaylists() async {
    if (_isLoadingUserPlaylists) return;
    setState(() => _isLoadingUserPlaylists = true);

    try {
      final List<Playlist> combined = [];
      final spotifyPlaylists = await _spotifyService.getUserPlaylists();
      combined.addAll(spotifyPlaylists);

      final ytPlaylists = await _ytMusicService.getUserPlaylists();
      combined.addAll(ytPlaylists);

      setState(() {
        _userPlaylists = combined;
        _isLoadingUserPlaylists = false;
      });
    } catch (e) {
      setState(() => _isLoadingUserPlaylists = false);
    }
  }

  void _addSet(MusicSet newSet) {
    setState(() {
      final symbol = SetEngine.getSymbolForIndex(_loadedSets.length);
      _loadedSets.add(newSet.copyWith(symbol: symbol));
      _reevaluateExpression();
    });
  }

  void _removeSetAt(int index) {
    setState(() {
      _loadedSets.removeAt(index);
      // Reassign symbols
      for (int i = 0; i < _loadedSets.length; i++) {
        _loadedSets[i] = _loadedSets[i].copyWith(symbol: SetEngine.getSymbolForIndex(i));
      }
      _reevaluateExpression();
    });
  }

  void _clearAllSets() {
    setState(() {
      _loadedSets.clear();
      _expression = '';
      _evaluatedTracks = {};
      _expressionError = null;
    });
  }

  void _onExpressionChanged(String newExpr) {
    setState(() {
      _expression = newExpr;
      _reevaluateExpression();
    });
  }

  void _reevaluateExpression() {
    if (_expression.trim().isEmpty) {
      _evaluatedTracks = {};
      _expressionError = null;
      return;
    }

    final Map<String, Set<Track>> symbolMap = {};
    for (var musicSet in _loadedSets) {
      symbolMap[musicSet.symbol] = musicSet.tracks;
    }

    try {
      _evaluatedTracks = ExpressionParser.evaluate(_expression, symbolMap);
      _expressionError = null;
    } catch (e) {
      _evaluatedTracks = {};
      _expressionError = e.toString().replaceAll('FormatException: ', '');
    }
  }

  Future<void> _loadUserPlaylistAsSet(Playlist playlist) async {
    List<Track> tracks = [];
    if (playlist.platform == MusicPlatform.spotify) {
      tracks = await _spotifyService.getPlaylistTracks(playlist.id);
    } else {
      tracks = await _ytMusicService.getPlaylistTracks(playlist.id);
    }

    final musicSet = MusicSet(
      symbol: '',
      id: playlist.id,
      name: playlist.name,
      type: SetType.playlist,
      imageUrl: playlist.imageUrl,
      subtitle: '${playlist.ownerName} (${tracks.length} tracks)',
      tracks: tracks.toSet(),
      platform: playlist.platform,
    );

    _addSet(musicSet);
  }

  void _exportPlaylist() {
    final nameController = TextEditingController(text: 'Set Result Playlist');
    MusicPlatform targetPlatform = MusicPlatform.spotify;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Export Created Playlist'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: const InputDecoration(
                  labelText: 'Playlist Name',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              SegmentedButton<MusicPlatform>(
                segments: const [
                  ButtonSegment(
                    value: MusicPlatform.spotify,
                    label: Text('Spotify'),
                    icon: Icon(Icons.music_note, color: Colors.green),
                  ),
                  ButtonSegment(
                    value: MusicPlatform.ytmusic,
                    label: Text('YouTube Music'),
                    icon: Icon(Icons.video_library, color: Colors.red),
                  ),
                ],
                selected: {targetPlatform},
                onSelectionChanged: (selected) {
                  setDialogState(() => targetPlatform = selected.first);
                },
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                final messenger = ScaffoldMessenger.of(context);
                final name = nameController.text.trim();
                if (name.isEmpty) return;

                Navigator.pop(ctx);
                messenger.showSnackBar(
                  const SnackBar(content: Text('Creating playlist on streaming service...')),
                );

                Playlist? created;
                if (targetPlatform == MusicPlatform.spotify) {
                  created = await _spotifyService.createPlaylist(
                    name: name,
                    tracks: _evaluatedTracks.toList(),
                  );
                } else {
                  created = await _ytMusicService.createPlaylist(
                    name: name,
                    tracks: _evaluatedTracks.toList(),
                  );
                }

                if (created != null) {
                  messenger.showSnackBar(
                    SnackBar(content: Text('Successfully created playlist "${created.name}"!')),
                  );
                  _fetchUserPlaylists();
                } else {
                  messenger.showSnackBar(
                    const SnackBar(content: Text('Failed to create playlist. Check service authentication.')),
                  );
                }
              },
              child: const Text('Create Playlist'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authService = Provider.of<AuthService>(context);

    return Scaffold(
      appBar: AppBar(
        title: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.hub_outlined),
            SizedBox(width: 8),
            Flexible(
              child: Text(
                'Spotify & YT Music Sets',
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh Playlists',
            onPressed: (authService.isSpotifyConnected || authService.isYTMusicConnected)
                ? _fetchUserPlaylists
                : null,
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const AuthBar(),
            const SizedBox(height: 12),
            SearchAutocomplete(
              spotifyService: _spotifyService,
              ytMusicService: _ytMusicService,
              onSetSelected: _addSet,
            ),
            const SizedBox(height: 12),
            if (authService.isSpotifyConnected || authService.isYTMusicConnected) ...[
              ExpansionTile(
                leading: const Icon(Icons.library_music, color: Colors.indigo),
                title: Text('Your User Playlists (${_userPlaylists.length})'),
                subtitle: const Text('Click any playlist to quickly add it as a set'),
                children: [
                  if (_isLoadingUserPlaylists)
                    const Padding(
                      padding: EdgeInsets.all(16.0),
                      child: CircularProgressIndicator(),
                    )
                  else if (_userPlaylists.isEmpty)
                    const Padding(
                      padding: EdgeInsets.all(16.0),
                      child: Text('No playlists found on connected accounts.'),
                    )
                  else
                    SizedBox(
                      height: 220,
                      child: ListView.separated(
                        shrinkWrap: true,
                        itemCount: _userPlaylists.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (ctx, index) {
                          final pl = _userPlaylists[index];
                          final isSpotify = pl.platform == MusicPlatform.spotify;
                          return ListTile(
                            dense: true,
                            leading: ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: pl.imageUrl != null
                                  ? Image.network(pl.imageUrl!, width: 32, height: 32, fit: BoxFit.cover,
                                      errorBuilder: (_, __, ___) => Container(
                                        width: 32, height: 32, color: Colors.grey.shade300,
                                        child: const Icon(Icons.music_note, size: 16),
                                      ))
                                  : Container(
                                      width: 32, height: 32, color: Colors.indigo.shade100,
                                      child: const Icon(Icons.music_note, size: 16, color: Colors.indigo),
                                    ),
                            ),
                            title: Text(pl.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                            subtitle: Text('${pl.totalTracks} tracks • ${pl.ownerName}'),
                            trailing: Chip(
                              label: Text(
                                isSpotify ? 'Spotify' : 'YouTube',
                                style: const TextStyle(fontSize: 10, color: Colors.white),
                              ),
                              backgroundColor: isSpotify ? Colors.green.shade700 : Colors.red.shade700,
                              visualDensity: VisualDensity.compact,
                            ),
                            onTap: () => _loadUserPlaylistAsSet(pl),
                          );
                        },
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
            ],
            VisualSetBuilder(
              loadedSets: _loadedSets,
              currentExpression: _expression,
              onExpressionChanged: _onExpressionChanged,
              onRemoveSet: _clearAllSets,
              onSetRemoved: _removeSetAt,
            ),
            const SizedBox(height: 12),
            TrackPreviewList(
              tracks: _evaluatedTracks,
              errorMessage: _expressionError,
              onExport: _exportPlaylist,
            ),
          ],
        ),
      ),
    );
  }
}
