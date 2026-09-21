import 'package:flutter/material.dart';
import '../models/track.dart';

class TrackPreviewList extends StatelessWidget {
  final Set<Track> tracks;
  final String? errorMessage;
  final VoidCallback onExport;

  const TrackPreviewList({
    super.key,
    required this.tracks,
    this.errorMessage,
    required this.onExport,
  });

  String _formatDuration(int ms) {
    if (ms <= 0) return '';
    final duration = Duration(milliseconds: ms);
    final minutes = duration.inMinutes;
    final seconds = duration.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  @override
  Widget build(BuildContext context) {
    final trackList = tracks.toList();

    return Card(
      elevation: 2,
      margin: const EdgeInsets.symmetric(vertical: 8),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.playlist_add_check, color: Colors.green),
                const SizedBox(width: 8),
                Text(
                  'Resulting Playlist Preview (${trackList.length} tracks)',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
                const Spacer(),
                if (trackList.isNotEmpty)
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green.shade700,
                      foregroundColor: Colors.white,
                    ),
                    icon: const Icon(Icons.playlist_add),
                    label: const Text('Export Playlist'),
                    onPressed: onExport,
                  ),
              ],
            ),
            const SizedBox(height: 12),
            if (errorMessage != null && errorMessage!.isNotEmpty) ...[
              Container(
                padding: const EdgeInsets.all(12),
                width: double.infinity,
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.red.shade300),
                ),
                child: Text(
                  'Expression Error: $errorMessage',
                  style: TextStyle(color: Colors.red.shade900, fontWeight: FontWeight.w500),
                ),
              ),
              const SizedBox(height: 12),
            ],
            if (trackList.isEmpty)
              Container(
                height: 120,
                alignment: Alignment.center,
                child: Text(
                  errorMessage != null ? 'Invalid expression.' : 'No tracks match current set operation expression.',
                  style: const TextStyle(color: Colors.grey),
                ),
              )
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: trackList.length > 50 ? 50 : trackList.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (ctx, index) {
                  final track = trackList[index];
                  return ListTile(
                    dense: true,
                    leading: ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: track.albumArtUrl != null && track.albumArtUrl!.isNotEmpty
                          ? Image.network(
                              track.albumArtUrl!,
                              width: 38,
                              height: 38,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => Container(
                                width: 38, height: 38, color: Colors.grey.shade300,
                                child: const Icon(Icons.music_note, size: 20),
                              ),
                            )
                          : Container(
                              width: 38, height: 38, color: Colors.indigo.shade100,
                              child: const Icon(Icons.music_note, color: Colors.indigo, size: 20),
                            ),
                    ),
                    title: Text(track.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Text(
                      '${track.artistString}${track.albumName != null ? ' • ${track.albumName}' : ''}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    trailing: Text(
                      _formatDuration(track.durationMs),
                      style: const TextStyle(color: Colors.grey, fontSize: 12),
                    ),
                  );
                },
              ),
            if (trackList.length > 50) ...[
              const SizedBox(height: 8),
              Center(
                child: Text(
                  'Showing first 50 of ${trackList.length} tracks',
                  style: const TextStyle(color: Colors.grey, fontSize: 12, fontStyle: FontStyle.italic),
                ),
              ),
            ]
          ],
        ),
      ),
    );
  }
}
