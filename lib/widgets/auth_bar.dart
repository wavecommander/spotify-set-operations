import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';

class AuthBar extends StatelessWidget {
  const AuthBar({super.key});

  @override
  Widget build(BuildContext context) {
    final authService = Provider.of<AuthService>(context);

    return Card(
      margin: const EdgeInsets.all(12),
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Wrap(
          spacing: 12,
          runSpacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          alignment: WrapAlignment.spaceBetween,
          children: [
            const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.sync_alt, color: Colors.indigo),
                SizedBox(width: 8),
                Text(
                  'Streaming Accounts',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
              ],
            ),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                // Spotify Auth
                _ServiceChip(
                  name: 'Spotify',
                  isConnected: authService.isSpotifyConnected,
                  activeColor: Colors.green,
                  onConnect: () => _showTokenDialog(context, 'Spotify', (token) {
                    authService.setSpotifyAccessToken(token);
                  }),
                  onDisconnect: () => authService.disconnectSpotify(),
                ),
                // YouTube Music Auth
                _ServiceChip(
                  name: 'YouTube Music',
                  isConnected: authService.isYTMusicConnected,
                  activeColor: Colors.red,
                  onConnect: () => _showTokenDialog(context, 'YouTube Music', (token) {
                    authService.setYTMusicAccessToken(token);
                  }),
                  onDisconnect: () => authService.disconnectYTMusic(),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showTokenDialog(BuildContext context, String serviceName, Function(String) onSave) {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Connect $serviceName'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Authenticate via OAuth or paste your $serviceName API Access Token / OAuth token below:',
              style: const TextStyle(fontSize: 13),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              decoration: InputDecoration(
                labelText: '$serviceName Access Token',
                border: const OutlineInputBorder(),
                hintText: 'e.g. BQ... or ya29...',
              ),
              maxLines: 2,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              final auth = Provider.of<AuthService>(context, listen: false);
              if (serviceName == 'Spotify') {
                auth.authenticateSpotify();
              } else {
                auth.authenticateYTMusic();
              }
              Navigator.pop(ctx);
            },
            child: const Text('Launch Browser Auth'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              if (controller.text.trim().isNotEmpty) {
                onSave(controller.text.trim());
              }
              Navigator.pop(ctx);
            },
            child: const Text('Save Token'),
          ),
        ],
      ),
    );
  }
}

class _ServiceChip extends StatelessWidget {
  final String name;
  final bool isConnected;
  final Color activeColor;
  final VoidCallback onConnect;
  final VoidCallback onDisconnect;

  const _ServiceChip({
    required this.name,
    required this.isConnected,
    required this.activeColor,
    required this.onConnect,
    required this.onDisconnect,
  });

  @override
  Widget build(BuildContext context) {
    return FilterChip(
      avatar: CircleAvatar(
        backgroundColor: isConnected ? activeColor : Colors.grey,
        radius: 6,
      ),
      label: Text(
        '$name ${isConnected ? "(Connected)" : "(Disconnected)"}',
        style: TextStyle(
          color: isConnected ? activeColor : Colors.grey.shade700,
          fontWeight: isConnected ? FontWeight.bold : FontWeight.normal,
        ),
      ),
      selected: isConnected,
      selectedColor: activeColor.withValues(alpha: 0.15),
      onSelected: (_) {
        if (isConnected) {
          onDisconnect();
        } else {
          onConnect();
        }
      },
    );
  }
}
