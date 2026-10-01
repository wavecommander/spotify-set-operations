/**
 * Graphical Pipeline / Graph Engine
 * Operates strictly on backend collection IDs to evaluate operations sequentially or as a DAG.
 * Tracks track provenance (which collection IDs contributed each track).
 */

import { SetEngine, SetOperationType } from './set-engine.js';
import { MusicCollection, Track } from './models.js';

export class PipelineStep {
  /**
   * @param {Object} options
   * @param {string} options.id - Step identifier
   * @param {string} options.operation - 'union' | 'intersection' | 'difference' | 'symmetric_difference'
   * @param {string} options.rightCollectionId - Backend collection ID for right operand
   * @param {string} [options.leftStepOrCollectionId] - Explicit left ID or defaults to previous step
   */
  constructor({ id, operation, rightCollectionId, leftStepOrCollectionId = null }) {
    this.id = id;
    this.operation = operation;
    this.rightCollectionId = rightCollectionId;
    this.leftStepOrCollectionId = leftStepOrCollectionId;
  }
}

export class PipelineResult {
  /**
   * @param {Object} options
   * @param {Map<string, Track>} options.tracks - Resulting track map
   * @param {Map<string, Set<string>>} options.trackSources - identityKey -> Set<collectionId>
   * @param {Array<Object>} options.stepSnapshots - Snapshots after each step
   */
  constructor({ tracks, trackSources, stepSnapshots }) {
    this.tracks = tracks;
    this.trackSources = trackSources;
    this.stepSnapshots = stepSnapshots;
  }

  get trackList() {
    return Array.from(this.tracks.values());
  }

  get count() {
    return this.tracks.size;
  }

  /**
   * Returns array of collection IDs that contributed a specific track.
   * @param {string} identityKey
   * @returns {string[]}
   */
  getSourcesForTrack(identityKey) {
    const sources = this.trackSources.get(identityKey);
    return sources ? Array.from(sources) : [];
  }
}

export class GraphEngine {
  constructor() {
    /** @type {Map<string, MusicCollection>} Map of backendId -> MusicCollection */
    this.collections = new Map();
    /** @type {string|null} Backend ID of initial base collection */
    this.baseCollectionId = null;
    /** @type {PipelineStep[]} Ordered pipeline steps */
    this.steps = [];
  }

  /**
   * Registers a collection by its backend ID.
   * @param {MusicCollection} collection
   */
  registerCollection(collection) {
    if (!collection || !collection.id) {
      throw new Error('Valid MusicCollection with ID required');
    }
    this.collections.set(collection.id, collection);
  }

  /**
   * Unregisters a collection and removes any dependent steps.
   * @param {string} collectionId
   */
  unregisterCollection(collectionId) {
    this.collections.delete(collectionId);
    if (this.baseCollectionId === collectionId) {
      this.baseCollectionId = null;
    }
    this.steps = this.steps.filter((step) => step.rightCollectionId !== collectionId);
  }

  /**
   * Retrieves a collection by backend ID.
   * @param {string} collectionId
   * @returns {MusicCollection|undefined}
   */
  getCollection(collectionId) {
    return this.collections.get(collectionId);
  }

  /**
   * Sets the initial collection in the pipeline.
   * @param {string} collectionId - Backend ID
   */
  setBaseCollection(collectionId) {
    if (collectionId && !this.collections.has(collectionId)) {
      throw new Error(`Collection with ID "${collectionId}" is not registered`);
    }
    this.baseCollectionId = collectionId;
  }

  /**
   * Adds an operation step to the pipeline.
   * @param {string} operation - 'union' | 'intersection' | 'difference' | 'symmetric_difference'
   * @param {string} rightCollectionId - Backend ID of the right operand
   * @returns {PipelineStep}
   */
  addStep(operation, rightCollectionId) {
    if (!this.collections.has(rightCollectionId)) {
      throw new Error(`Collection with ID "${rightCollectionId}" is not registered`);
    }
    const stepId = `step-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const step = new PipelineStep({
      id: stepId,
      operation,
      rightCollectionId,
    });
    this.steps.push(step);
    return step;
  }

  /**
   * Updates an existing step's operation or right collection.
   * @param {string} stepId
   * @param {Object} patch
   * @param {string} [patch.operation]
   * @param {string} [patch.rightCollectionId]
   */
  updateStep(stepId, { operation, rightCollectionId }) {
    const step = this.steps.find((s) => s.id === stepId);
    if (!step) return;
    if (operation) step.operation = operation;
    if (rightCollectionId && this.collections.has(rightCollectionId)) {
      step.rightCollectionId = rightCollectionId;
    }
  }

  /**
   * Removes a step by ID.
   * @param {string} stepId
   */
  removeStep(stepId) {
    this.steps = this.steps.filter((s) => s.id !== stepId);
  }

  /**
   * Clears the entire pipeline.
   */
  clearPipeline() {
    this.baseCollectionId = null;
    this.steps = [];
  }

  /**
   * Evaluates the pipeline and produces the resulting tracks and origin provenance.
   * @returns {PipelineResult}
   */
  evaluate() {
    if (!this.baseCollectionId || !this.collections.has(this.baseCollectionId)) {
      return new PipelineResult({
        tracks: new Map(),
        trackSources: new Map(),
        stepSnapshots: [],
      });
    }

    const baseCollection = this.collections.get(this.baseCollectionId);
    let currentTracks = new Map(baseCollection.tracks);

    // Track provenance: identityKey -> Set of collection IDs
    const trackSources = new Map();
    for (const [key] of currentTracks.entries()) {
      trackSources.set(key, new Set([baseCollection.id]));
    }

    const stepSnapshots = [
      {
        stepId: 'base',
        collectionId: baseCollection.id,
        operation: null,
        count: currentTracks.size,
      },
    ];

    for (const step of this.steps) {
      const rightCol = this.collections.get(step.rightCollectionId);
      if (!rightCol) continue;

      // Update provenance for tracks in the right collection
      for (const [key] of rightCol.tracks.entries()) {
        if (!trackSources.has(key)) {
          trackSources.set(key, new Set());
        }
        trackSources.get(key).add(rightCol.id);
      }

      // Execute operation
      currentTracks = SetEngine.execute(step.operation, currentTracks, rightCol.tracks);

      stepSnapshots.push({
        stepId: step.id,
        collectionId: rightCol.id,
        operation: step.operation,
        count: currentTracks.size,
      });
    }

    return new PipelineResult({
      tracks: currentTracks,
      trackSources,
      stepSnapshots,
    });
  }
}
