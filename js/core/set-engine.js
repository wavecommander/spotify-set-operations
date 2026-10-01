/**
 * Set Operations Engine
 * Performs mathematical set operations on track maps/collections keyed by Track.identityKey.
 */

import { MusicCollection, Track } from './models.js';

export const SetOperationType = Object.freeze({
  UNION: 'union',
  INTERSECTION: 'intersection',
  DIFFERENCE: 'difference',
  SYMMETRIC_DIFFERENCE: 'symmetric_difference',
});

/**
 * Extracts a Map<identityKey, Track> from either a MusicCollection or Map or Array.
 * @param {MusicCollection|Map<string, Track>|Track[]} source
 * @returns {Map<string, Track>}
 */
export function toTrackMap(source) {
  if (!source) return new Map();
  if (source instanceof MusicCollection) {
    return source.tracks;
  }
  if (source instanceof Map) {
    return source;
  }
  if (Array.isArray(source)) {
    const map = new Map();
    for (const track of source) {
      if (track) map.set(track.identityKey, track);
    }
    return map;
  }
  return new Map();
}

export class SetEngine {
  /**
   * Union: Returns all tracks that exist in set A, set B, or both.
   * @param {MusicCollection|Map<string, Track>} a
   * @param {MusicCollection|Map<string, Track>} b
   * @returns {Map<string, Track>}
   */
  static union(a, b) {
    const mapA = toTrackMap(a);
    const mapB = toTrackMap(b);
    const result = new Map(mapA);

    for (const [key, track] of mapB.entries()) {
      if (!result.has(key)) {
        result.set(key, track);
      }
    }
    return result;
  }

  /**
   * Intersection: Returns only tracks that exist in BOTH set A and set B.
   * @param {MusicCollection|Map<string, Track>} a
   * @param {MusicCollection|Map<string, Track>} b
   * @returns {Map<string, Track>}
   */
  static intersection(a, b) {
    const mapA = toTrackMap(a);
    const mapB = toTrackMap(b);
    const result = new Map();

    // Iterate through the smaller set for performance
    const [smaller, larger] = mapA.size <= mapB.size ? [mapA, mapB] : [mapB, mapA];

    for (const [key, track] of smaller.entries()) {
      if (larger.has(key)) {
        result.set(key, track);
      }
    }
    return result;
  }

  /**
   * Difference (A - B): Returns tracks in set A that are NOT in set B.
   * @param {MusicCollection|Map<string, Track>} a
   * @param {MusicCollection|Map<string, Track>} b
   * @returns {Map<string, Track>}
   */
  static difference(a, b) {
    const mapA = toTrackMap(a);
    const mapB = toTrackMap(b);
    const result = new Map();

    for (const [key, track] of mapA.entries()) {
      if (!mapB.has(key)) {
        result.set(key, track);
      }
    }
    return result;
  }

  /**
   * Symmetric Difference (A ^ B): Returns tracks in set A or set B, but NOT both.
   * (A \ B) U (B \ A)
   * @param {MusicCollection|Map<string, Track>} a
   * @param {MusicCollection|Map<string, Track>} b
   * @returns {Map<string, Track>}
   */
  static symmetricDifference(a, b) {
    const mapA = toTrackMap(a);
    const mapB = toTrackMap(b);
    const result = new Map();

    for (const [key, track] of mapA.entries()) {
      if (!mapB.has(key)) {
        result.set(key, track);
      }
    }
    for (const [key, track] of mapB.entries()) {
      if (!mapA.has(key)) {
        result.set(key, track);
      }
    }
    return result;
  }

  /**
   * Executes an operation by operation type string.
   * @param {string} opType - 'union' | 'intersection' | 'difference' | 'symmetric_difference'
   * @param {MusicCollection|Map<string, Track>} a
   * @param {MusicCollection|Map<string, Track>} b
   * @returns {Map<string, Track>}
   */
  static execute(opType, a, b) {
    switch (opType) {
      case SetOperationType.UNION:
        return SetEngine.union(a, b);
      case SetOperationType.INTERSECTION:
        return SetEngine.intersection(a, b);
      case SetOperationType.DIFFERENCE:
        return SetEngine.difference(a, b);
      case SetOperationType.SYMMETRIC_DIFFERENCE:
        return SetEngine.symmetricDifference(a, b);
      default:
        throw new Error(`Unsupported set operation: ${opType}`);
    }
  }

  /**
   * Returns human-readable math symbol for a set operation.
   * @param {string} op
   * @returns {string}
   */
  static getSymbol(op) {
    switch (op) {
      case SetOperationType.UNION:
        return '∪';
      case SetOperationType.INTERSECTION:
        return '∩';
      case SetOperationType.DIFFERENCE:
        return '∖';
      case SetOperationType.SYMMETRIC_DIFFERENCE:
        return '∆';
      default:
        return '∪';
    }
  }

  /**
   * Returns display name for a set operation.
   * @param {string} op
   * @returns {string}
   */
  static getOperationName(op) {
    switch (op) {
      case SetOperationType.UNION:
        return 'Union';
      case SetOperationType.INTERSECTION:
        return 'Intersection';
      case SetOperationType.DIFFERENCE:
        return 'Difference';
      case SetOperationType.SYMMETRIC_DIFFERENCE:
        return 'Symmetric Difference';
      default:
        return 'Operation';
    }
  }

  /**
   * Computes partition metrics between two sets (used by the Venn diagram visualizer).
   * @param {MusicCollection|Map<string, Track>} a
   * @param {MusicCollection|Map<string, Track>} b
   * @returns {{
   *   onlyA: Map<string, Track>,
   *   onlyB: Map<string, Track>,
   *   overlap: Map<string, Track>,
   *   countA: number,
   *   countB: number,
   *   countOverlap: number,
   *   totalUnique: number
   * }}
   */
  static getVennPartition(a, b) {
    const mapA = toTrackMap(a);
    const mapB = toTrackMap(b);

    const onlyA = new Map();
    const overlap = new Map();
    const onlyB = new Map();

    for (const [key, track] of mapA.entries()) {
      if (mapB.has(key)) {
        overlap.set(key, track);
      } else {
        onlyA.set(key, track);
      }
    }

    for (const [key, track] of mapB.entries()) {
      if (!mapA.has(key)) {
        onlyB.set(key, track);
      }
    }

    return {
      onlyA,
      onlyB,
      overlap,
      countA: onlyA.size,
      countB: onlyB.size,
      countOverlap: overlap.size,
      totalUnique: onlyA.size + overlap.size + onlyB.size,
    };
  }

  /**
   * Performs union across multiple sets.
   * @param {Array<MusicCollection|Map<string, Track>>} collections
   * @returns {Map<string, Track>}
   */
  static unionAll(collections) {
    const result = new Map();
    for (const col of collections) {
      const map = toTrackMap(col);
      for (const [key, track] of map.entries()) {
        if (!result.has(key)) {
          result.set(key, track);
        }
      }
    }
    return result;
  }
}
