import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { Track, MusicCollection, MusicPlatform, CollectionType } from '../js/core/models.js';
import { SetEngine, SetOperationType } from '../js/core/set-engine.js';
import { GraphEngine } from '../js/core/graph-engine.js';

describe('Track & MusicCollection Models', () => {
  test('Track generates consistent identityKey using ISRC', () => {
    const track1 = new Track({
      id: 'sp-1',
      name: 'Come Together',
      artists: ['The Beatles'],
      isrc: 'GBAYE0601477',
    });
    const track2 = new Track({
      id: 'sp-2',
      name: 'Come Together - 2019 Mix',
      artists: ['The Beatles'],
      isrc: 'gbaye0601477', // lowercase
    });

    assert.equal(track1.identityKey, 'isrc:GBAYE0601477');
    assert.equal(track2.identityKey, 'isrc:GBAYE0601477');
    assert.equal(track1.identityKey, track2.identityKey);
  });

  test('Track generates fallback identityKey using normalized title and artist', () => {
    const track1 = new Track({
      id: 'sp-3',
      name: 'Yesterday (Remastered 2009)',
      artists: ['The Beatles'],
    });
    const track2 = new Track({
      id: 'sp-4',
      name: 'Yesterday [Deluxe Version]',
      artists: ['The Beatles'],
    });

    assert.equal(track1.identityKey, track2.identityKey);
    assert.equal(track1.identityKey, 'meta:yesterday::the beatles');
  });

  test('Track parses Spotify track payload', () => {
    const spotifyJson = {
      track: {
        id: '4cOdK2wGLETKBW3PvgPWqT',
        name: 'Never Gonna Give You Up',
        artists: [{ name: 'Rick Astley' }],
        album: {
          name: 'Whenever You Need Somebody',
          images: [{ url: 'https://i.scdn.co/image/abc' }],
        },
        duration_ms: 213573,
        external_ids: { isrc: 'GBARL8700010' },
      },
    };
    const track = Track.fromSpotify(spotifyJson);
    assert.equal(track.id, '4cOdK2wGLETKBW3PvgPWqT');
    assert.equal(track.name, 'Never Gonna Give You Up');
    assert.equal(track.artistString, 'Rick Astley');
    assert.equal(track.albumArtUrl, 'https://i.scdn.co/image/abc');
    assert.equal(track.identityKey, 'isrc:GBARL8700010');
    assert.equal(track.durationFormatted, '3:33');
  });

  test('MusicCollection stores and retrieves tracks by identityKey', () => {
    const col = new MusicCollection({
      id: 'spotify:playlist:test1',
      name: 'Rock Classics',
    });
    const t1 = new Track({ id: '1', name: 'Song 1', artists: ['Band A'] });
    const t2 = new Track({ id: '2', name: 'Song 2', artists: ['Band B'] });

    col.addTrack(t1);
    col.addTrack(t2);

    assert.equal(col.trackCount, 2);
    assert.equal(col.hasTrack(t1), true);
    assert.equal(col.getTrack(t1.identityKey), t1);
  });
});

describe('SetEngine Math', () => {
  const tA = new Track({ id: '1', name: 'Track A', artists: ['Artist 1'] });
  const tB = new Track({ id: '2', name: 'Track B', artists: ['Artist 2'] });
  const tC = new Track({ id: '3', name: 'Track C', artists: ['Artist 3'] });
  const tD = new Track({ id: '4', name: 'Track D', artists: ['Artist 4'] });

  const set1 = new MusicCollection({
    id: 'spotify:playlist:1',
    name: 'Set 1',
    tracks: [tA, tB, tC],
  });

  const set2 = new MusicCollection({
    id: 'spotify:playlist:2',
    name: 'Set 2',
    tracks: [tB, tC, tD],
  });

  test('Union includes all unique tracks from both sets', () => {
    const result = SetEngine.union(set1, set2);
    assert.equal(result.size, 4);
    assert.ok(result.has(tA.identityKey));
    assert.ok(result.has(tB.identityKey));
    assert.ok(result.has(tC.identityKey));
    assert.ok(result.has(tD.identityKey));
  });

  test('Intersection returns only shared tracks', () => {
    const result = SetEngine.intersection(set1, set2);
    assert.equal(result.size, 2);
    assert.ok(!result.has(tA.identityKey));
    assert.ok(result.has(tB.identityKey));
    assert.ok(result.has(tC.identityKey));
    assert.ok(!result.has(tD.identityKey));
  });

  test('Difference (A - B) returns tracks only in set1', () => {
    const result = SetEngine.difference(set1, set2);
    assert.equal(result.size, 1);
    assert.ok(result.has(tA.identityKey));
    assert.ok(!result.has(tB.identityKey));
  });

  test('Symmetric Difference returns tracks in either set, but not both', () => {
    const result = SetEngine.symmetricDifference(set1, set2);
    assert.equal(result.size, 2);
    assert.ok(result.has(tA.identityKey));
    assert.ok(result.has(tD.identityKey));
    assert.ok(!result.has(tB.identityKey));
    assert.ok(!result.has(tC.identityKey));
  });

  test('Venn partition analysis accurately calculates counts and subsets', () => {
    const partition = SetEngine.getVennPartition(set1, set2);
    assert.equal(partition.countA, 1); // tA
    assert.equal(partition.countOverlap, 2); // tB, tC
    assert.equal(partition.countB, 1); // tD
    assert.equal(partition.totalUnique, 4);
  });

  test('SetEngine returns expected symbols and operation names', () => {
    assert.equal(SetEngine.getSymbol(SetOperationType.UNION), '∪');
    assert.equal(SetEngine.getSymbol(SetOperationType.INTERSECTION), '∩');
    assert.equal(SetEngine.getSymbol(SetOperationType.DIFFERENCE), '∖');
    assert.equal(SetEngine.getSymbol(SetOperationType.SYMMETRIC_DIFFERENCE), '∆');

    assert.equal(SetEngine.getOperationName(SetOperationType.UNION), 'Union');
    assert.equal(SetEngine.getOperationName(SetOperationType.INTERSECTION), 'Intersection');
    assert.equal(SetEngine.getOperationName(SetOperationType.DIFFERENCE), 'Difference');
    assert.equal(SetEngine.getOperationName(SetOperationType.SYMMETRIC_DIFFERENCE), 'Symmetric Difference');
  });
});

describe('GraphEngine Pipeline with Backend IDs', () => {
  test('evaluates pipeline step-by-step using backend IDs', () => {
    const tA = new Track({ id: '1', name: 'A', artists: ['X'] });
    const tB = new Track({ id: '2', name: 'B', artists: ['X'] });
    const tC = new Track({ id: '3', name: 'C', artists: ['X'] });
    const tD = new Track({ id: '4', name: 'D', artists: ['X'] });

    const p1 = new MusicCollection({
      id: 'spotify:playlist:rock',
      name: 'Classic Rock',
      tracks: [tA, tB],
    });
    const p2 = new MusicCollection({
      id: 'spotify:playlist:pop',
      name: 'Pop Hits',
      tracks: [tB, tC],
    });
    const a3 = new MusicCollection({
      id: 'spotify:album:ballad',
      name: 'Love Ballads',
      tracks: [tA, tD],
    });

    const graph = new GraphEngine();
    graph.registerCollection(p1);
    graph.registerCollection(p2);
    graph.registerCollection(a3);

    // Pipeline: Base(Classic Rock) UNION Pop Hits DIFFERENCE Love Ballads
    // Base: [tA, tB]
    // Step 1: UNION Pop Hits -> [tA, tB, tC]
    // Step 2: DIFFERENCE Love Ballads -> [tA, tB, tC] - [tA, tD] -> [tB, tC]
    graph.setBaseCollection('spotify:playlist:rock');
    graph.addStep(SetOperationType.UNION, 'spotify:playlist:pop');
    graph.addStep(SetOperationType.DIFFERENCE, 'spotify:album:ballad');

    const result = graph.evaluate();
    assert.equal(result.count, 2);
    assert.ok(result.tracks.has(tB.identityKey));
    assert.ok(result.tracks.has(tC.identityKey));
    assert.ok(!result.tracks.has(tA.identityKey));
    assert.ok(!result.tracks.has(tD.identityKey));

    // Check track provenance
    const sourcesForB = result.getSourcesForTrack(tB.identityKey);
    assert.ok(sourcesForB.includes('spotify:playlist:rock'));
    assert.ok(sourcesForB.includes('spotify:playlist:pop'));
  });

  test('multi-step Venn pipeline calculates sequential partitions and counts accurately', () => {
    const t1 = new Track({ id: '1', name: 'Song 1', artists: ['A'] });
    const t2 = new Track({ id: '2', name: 'Song 2', artists: ['A'] });
    const t3 = new Track({ id: '3', name: 'Song 3', artists: ['B'] });
    const t4 = new Track({ id: '4', name: 'Song 4', artists: ['C'] });

    const baseCol = new MusicCollection({
      id: 'col-1',
      name: 'Base Playlist',
      tracks: [t1, t2],
    });
    const col2 = new MusicCollection({
      id: 'col-2',
      name: 'Second Playlist',
      tracks: [t2, t3],
    });
    const col3 = new MusicCollection({
      id: 'col-3',
      name: 'Third Playlist',
      tracks: [t1, t4],
    });

    // Step 1: Base UNION col2
    const part1 = SetEngine.getVennPartition(baseCol, col2);
    assert.equal(part1.countA, 1); // t1
    assert.equal(part1.countOverlap, 1); // t2
    assert.equal(part1.countB, 1); // t3
    assert.equal(part1.totalUnique, 3); // t1, t2, t3

    const res1Tracks = SetEngine.execute(SetOperationType.UNION, baseCol.tracks, col2.tracks);
    const step1Col = new MusicCollection({
      id: 'step-0-result',
      name: 'Step 1 Result',
      tracks: res1Tracks,
    });
    assert.equal(step1Col.trackCount, 3);

    // Step 2: step1Col DIFFERENCE col3
    const part2 = SetEngine.getVennPartition(step1Col, col3);
    assert.equal(part2.countA, 2); // t2, t3 in left only
    assert.equal(part2.countOverlap, 1); // t1 in both
    assert.equal(part2.countB, 1); // t4 in right only
    assert.equal(part2.totalUnique, 4);

    const res2Tracks = SetEngine.execute(SetOperationType.DIFFERENCE, step1Col.tracks, col3.tracks);
    assert.equal(res2Tracks.size, 2);
    assert.ok(res2Tracks.has(t2.identityKey));
    assert.ok(res2Tracks.has(t3.identityKey));
    assert.ok(!res2Tracks.has(t1.identityKey));
  });
});
