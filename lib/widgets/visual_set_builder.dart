import 'package:flutter/material.dart';
import '../models/music_set.dart';

class VisualSetBuilder extends StatefulWidget {
  final List<MusicSet> loadedSets;
  final String currentExpression;
  final ValueChanged<String> onExpressionChanged;
  final VoidCallback onRemoveSet;
  final Function(int) onSetRemoved;

  const VisualSetBuilder({
    super.key,
    required this.loadedSets,
    required this.currentExpression,
    required this.onExpressionChanged,
    required this.onRemoveSet,
    required this.onSetRemoved,
  });

  @override
  State<VisualSetBuilder> createState() => _VisualSetBuilderState();
}

class _VisualSetBuilderState extends State<VisualSetBuilder> {
  late TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.currentExpression);
  }

  @override
  void didUpdateWidget(covariant VisualSetBuilder oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.currentExpression != _controller.text) {
      _controller.text = widget.currentExpression;
      _controller.selection = TextSelection.fromPosition(
        TextPosition(offset: _controller.text.length),
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _appendToken(String token) {
    if (widget.currentExpression.isEmpty) {
      widget.onExpressionChanged(token);
    } else {
      widget.onExpressionChanged('${widget.currentExpression} $token');
    }
  }

  @override
  Widget build(BuildContext context) {
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
                const Icon(Icons.calculate, color: Colors.indigo),
                const SizedBox(width: 8),
                const Text(
                  'Graphical Set Operation Builder',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
                const Spacer(),
                if (widget.loadedSets.isNotEmpty)
                  TextButton.icon(
                    icon: const Icon(Icons.clear_all, size: 18),
                    label: const Text('Clear All Sets'),
                    onPressed: widget.onRemoveSet,
                  ),
              ],
            ),
            const SizedBox(height: 12),

            // Loaded Sets Legend Chips
            if (widget.loadedSets.isEmpty)
              Container(
                padding: const EdgeInsets.all(16),
                width: double.infinity,
                decoration: BoxDecoration(
                  color: Colors.indigo.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.indigo.withValues(alpha: 0.2)),
                ),
                child: const Text(
                  'No playlists or albums added yet. Use the search bar above or pick your saved playlists to start set operations.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.indigo),
                ),
              )
            else
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: List.generate(widget.loadedSets.length, (index) {
                  final setItem = widget.loadedSets[index];
                  return Chip(
                    avatar: CircleAvatar(
                      backgroundColor: Colors.indigo,
                      child: Text(
                        setItem.symbol,
                        style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                      ),
                    ),
                    label: Text('${setItem.name} (${setItem.tracks.length})'),
                    deleteIcon: const Icon(Icons.close, size: 16),
                    onDeleted: () => widget.onSetRemoved(index),
                  );
                }),
              ),

            const SizedBox(height: 16),
            const Text(
              'Set Expression Workspace:',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
            ),
            const SizedBox(height: 8),

            // Expression Input Field
            TextField(
              controller: _controller,
              onChanged: widget.onExpressionChanged,
              decoration: InputDecoration(
                hintText: 'e.g. (A | B) - C',
                border: const OutlineInputBorder(),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.backspace_outlined),
                  onPressed: () {
                    if (widget.currentExpression.isNotEmpty) {
                      final parts = widget.currentExpression.trim().split(' ');
                      if (parts.isNotEmpty) {
                        parts.removeLast();
                        widget.onExpressionChanged(parts.join(' '));
                      }
                    }
                  },
                ),
              ),
            ),

            const SizedBox(height: 12),
            // Quick Operation Buttons
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _OpButton(
                  label: 'Union ( | )',
                  color: Colors.blue,
                  onTap: () => _appendToken('|'),
                ),
                _OpButton(
                  label: 'Intersection ( & )',
                  color: Colors.teal,
                  onTap: () => _appendToken('&'),
                ),
                _OpButton(
                  label: 'Difference ( - )',
                  color: Colors.orange.shade800,
                  onTap: () => _appendToken('-'),
                ),
                _OpButton(
                  label: 'Symmetric Diff ( ^ )',
                  color: Colors.purple,
                  onTap: () => _appendToken('^'),
                ),
                _OpButton(
                  label: '( ',
                  color: Colors.grey.shade700,
                  onTap: () => _appendToken('('),
                ),
                _OpButton(
                  label: ' )',
                  color: Colors.grey.shade700,
                  onTap: () => _appendToken(')'),
                ),
                ...widget.loadedSets.map(
                  (s) => OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.indigo,
                      side: const BorderSide(color: Colors.indigo, width: 1.5),
                    ),
                    onPressed: () => _appendToken(s.symbol),
                    child: Text('Add ${s.symbol}', style: const TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _OpButton extends StatelessWidget {
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _OpButton({required this.label, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      style: ElevatedButton.styleFrom(
        backgroundColor: color,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      ),
      onPressed: onTap,
      child: Text(label, style: const TextStyle(fontWeight: FontWeight.bold)),
    );
  }
}
