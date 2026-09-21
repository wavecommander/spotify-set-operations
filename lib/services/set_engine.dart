import '../models/track.dart';

class SetEngine {
  /// Performs Union (A | B): tracks in A or B or both
  static Set<Track> union(Set<Track> setA, Set<Track> setB) {
    final result = Set<Track>.from(setA);
    result.addAll(setB);
    return result;
  }

  /// Performs Intersection (A & B): tracks in both A and B
  static Set<Track> intersection(Set<Track> setA, Set<Track> setB) {
    final bKeys = setB.map((t) => t.identityKey).toSet();
    return setA.where((t) => bKeys.contains(t.identityKey)).toSet();
  }

  /// Performs Difference (A - B): tracks in A but not in B
  static Set<Track> difference(Set<Track> setA, Set<Track> setB) {
    final bKeys = setB.map((t) => t.identityKey).toSet();
    return setA.where((t) => !bKeys.contains(t.identityKey)).toSet();
  }

  /// Performs Symmetric Difference (A ^ B): tracks in A or B but NOT both
  static Set<Track> symmetricDifference(Set<Track> setA, Set<Track> setB) {
    final diffAB = difference(setA, setB);
    final diffBA = difference(setB, setA);
    return union(diffAB, diffBA);
  }

  /// Helper to convert index to set symbol ('A', 'B', ... 'Z', '*A', '*B', etc.)
  static String getSymbolForIndex(int index) {
    final stars = '*' * (index ~/ 26);
    final letter = String.fromCharCode(65 + (index % 26));
    return '$stars$letter';
  }
}
