/**
 * Visual Operation Pipeline Builder (<sso-visual-builder>)
 * Graphical interface displaying real playlist/album names and Venn diagram operation symbols.
 * Under the hood, coordinates operations via backend IDs in GraphEngine.
 */

import { GraphEngine } from '../core/graph-engine.js';
import { SetOperationType } from '../core/set-engine.js';
import { SvgIcons } from '../utils/svg-icons.js';
import { notify } from './sso-toast.js';

export class SsoVisualBuilder extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.graph = new GraphEngine();
    this.selectedStepIndex = 0;
  }

  connectedCallback() {
    this.render();
    this.setupListeners();
  }

  /**
   * Adds a collection to the graph and sets as base if none exists,
   * or automatically appends a new operation at the end of the order of operations.
   * @param {import('../core/models.js').MusicCollection} collection
   */
  addCollection(collection) {
    if (!collection) return;
    this.graph.registerCollection(collection);

    if (!this.graph.baseCollectionId) {
      this.graph.setBaseCollection(collection.id);
    } else {
      // Automatically create a new operation on the end of the current order of operations
      // with it and the previous result as the sets being operated on
      this.graph.addStep(SetOperationType.UNION, collection.id);
    }

    this.notifyPipelineChange();
    this.render();
    this.setupListeners();
  }

  /**
   * Removes a collection from the graph.
   * @param {string} collectionId
   */
  removeCollection(collectionId) {
    this.graph.unregisterCollection(collectionId);
    if (!this.graph.baseCollectionId && this.graph.collections.size > 0) {
      const firstId = this.graph.collections.keys().next().value;
      this.graph.setBaseCollection(firstId);
      this.graph.steps = this.graph.steps.filter((s) => s.rightCollectionId !== firstId);
    }
    this.notifyPipelineChange();
    this.render();
    this.setupListeners();
  }

  notifyPipelineChange() {
    const result = this.graph.evaluate();
    this.dispatchEvent(
      new CustomEvent('pipeline-change', {
        detail: {
          result,
          graph: this.graph,
          baseCollection: this.graph.baseCollectionId
            ? this.graph.getCollection(this.graph.baseCollectionId)
            : null,
          steps: this.graph.steps,
        },
        bubbles: true,
      })
    );
  }

  setupListeners() {
    // Delete source button
    const deleteBtns = this.shadowRoot.querySelectorAll('.remove-source-btn');
    deleteBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        this.removeCollection(id);
      });
    });

    // Venn operation symbol buttons
    const opBtns = this.shadowRoot.querySelectorAll('.venn-symbol-btn');
    opBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const stepId = e.currentTarget.dataset.stepId;
        const op = e.currentTarget.dataset.op;
        this.graph.updateStep(stepId, { operation: op });
        this.notifyPipelineChange();
        this.render();
        this.setupListeners();
      });
    });

    // Right operand collection dropdown change
    const operandSelects = this.shadowRoot.querySelectorAll('.operand-select');
    operandSelects.forEach((sel) => {
      sel.addEventListener('change', (e) => {
        const stepId = e.currentTarget.dataset.stepId;
        const newRightId = e.currentTarget.value;
        this.graph.updateStep(stepId, { rightCollectionId: newRightId });
        this.notifyPipelineChange();
        this.render();
        this.setupListeners();
      });
    });

    // Base collection selector
    const baseSelect = this.shadowRoot.querySelector('#base-collection-select');
    if (baseSelect) {
      baseSelect.addEventListener('change', (e) => {
        this.graph.setBaseCollection(e.target.value);
        this.notifyPipelineChange();
        this.render();
        this.setupListeners();
      });
    }

    // Add step button
    const addStepBtn = this.shadowRoot.querySelector('#add-step-btn');
    if (addStepBtn) {
      addStepBtn.addEventListener('click', () => {
        const registered = Array.from(this.graph.collections.values());
        if (registered.length < 2) {
          notify('Add more playlists or albums to chain operations', 'info');
          return;
        }
        // Pick the first available collection that is not the base (or first collection)
        const candidate = registered.find((c) => c.id !== this.graph.baseCollectionId) || registered[0];
        this.graph.addStep(SetOperationType.UNION, candidate.id);
        this.notifyPipelineChange();
        this.render();
        this.setupListeners();
      });
    }

    // Delete step button
    const deleteStepBtns = this.shadowRoot.querySelectorAll('.delete-step-btn');
    deleteStepBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const stepId = e.currentTarget.dataset.stepId;
        this.graph.removeStep(stepId);
        this.notifyPipelineChange();
        this.render();
        this.setupListeners();
      });
    });
  }

  render() {
    const collections = Array.from(this.graph.collections.values());
    const baseCol = this.graph.baseCollectionId ? this.graph.getCollection(this.graph.baseCollectionId) : null;
    const steps = this.graph.steps;
    const evalResult = this.graph.evaluate();

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .builder-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* Source Shelf */
        .shelf-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.85rem;
          color: #b3b3b3;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .sources-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 12px;
        }
        .source-pill {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #181818;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 8px 12px;
          position: relative;
        }
        .source-pill.is-base {
          border-left: 4px solid #1db954;
        }
        .source-pill img {
          width: 38px;
          height: 38px;
          border-radius: 4px;
          object-fit: cover;
          background: #242424;
        }
        .pill-meta {
          flex: 1;
          min-width: 0;
        }
        .pill-title {
          font-size: 0.85rem;
          font-weight: 600;
          color: #ffffff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pill-sub {
          font-size: 0.75rem;
          color: #b3b3b3;
        }
        .remove-source-btn {
          color: #727272;
          padding: 4px;
          border-radius: 4px;
          background: transparent;
          cursor: pointer;
        }
        .remove-source-btn:hover {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
        }

        /* Pipeline Builder Section */
        .pipeline-workspace {
          background: #181818;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 20px;
        }
        .workspace-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        /* Pipeline Nodes */
        .pipeline-sequence {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .pipeline-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #242424;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          padding: 12px 18px;
          gap: 14px;
        }
        .pipeline-card.base-card {
          border-color: #1db954;
          background: rgba(29, 185, 84, 0.05);
        }
        .card-identity {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }
        .card-thumb {
          width: 44px;
          height: 44px;
          border-radius: 6px;
          object-fit: cover;
          background: #121212;
        }
        .card-name {
          font-size: 0.95rem;
          font-weight: 600;
          color: #ffffff;
        }
        .card-count {
          font-size: 0.8rem;
          color: #b3b3b3;
        }

        /* Venn Operation Selector Row */
        .operation-connector {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          margin: 6px 0;
          padding: 10px;
          background: #1c1c1c;
          border: 1px dashed rgba(255, 255, 255, 0.15);
          border-radius: 10px;
        }
        .venn-btn-group {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: center;
        }
        .venn-symbol-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 8px 12px;
          background: #282828;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #b3b3b3;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .venn-symbol-btn:hover {
          background: #333333;
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.3);
        }
        .venn-symbol-btn.active-union {
          border-color: #1db954;
          background: rgba(29, 185, 84, 0.15);
          color: #1db954;
        }
        .venn-symbol-btn.active-intersection {
          border-color: #3d91f4;
          background: rgba(61, 145, 244, 0.15);
          color: #3d91f4;
        }
        .venn-symbol-btn.active-difference {
          border-color: #f59e0b;
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
        }
        .venn-symbol-btn.active-symdiff {
          border-color: #b05dfa;
          background: rgba(176, 93, 250, 0.15);
          color: #b05dfa;
        }

        .operand-select {
          background: #2a2a2a;
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #ffffff;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.85rem;
          max-width: 260px;
        }
        .step-footer-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          font-size: 0.8rem;
          color: #727272;
          padding-top: 4px;
        }
        .btn-add-step {
          display: flex;
          align-items: center;
          gap: 6px;
          margin: 16px auto 0;
          padding: 8px 18px;
          border-radius: 20px;
          background: #2a2a2a;
          border: 1px dashed rgba(255, 255, 255, 0.2);
          color: #ffffff;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .btn-add-step:hover {
          background: #333333;
          border-color: #1db954;
          color: #1db954;
        }
        .empty-placeholder {
          text-align: center;
          padding: 32px 16px;
          color: #727272;
          font-size: 0.9rem;
        }
      </style>

      <div class="builder-container">
        <!-- Loaded Collections Shelf -->
        ${
          collections.length > 0
            ? `
          <div class="shelf-header">
            <span>Workspace Collections (${collections.length})</span>
          </div>
          <div class="sources-grid">
            ${collections
              .map(
                (c) => `
              <div class="source-pill ${c.id === this.graph.baseCollectionId ? 'is-base' : ''}">
                <img src="${c.imageUrl || ''}" alt="" onerror="this.style.opacity='0.2'" />
                <div class="pill-meta">
                  <div class="pill-title" title="${c.name}">${c.name}</div>
                  <div class="pill-sub">${c.type} • ${c.trackCount} tracks</div>
                </div>
                <button class="remove-source-btn" data-id="${c.id}" title="Remove from workspace">
                  ${SvgIcons.trash(14)}
                </button>
              </div>
            `
              )
              .join('')}
          </div>
        `
            : ''
        }

        <!-- Operation Pipeline -->
        <div class="pipeline-workspace">
          <div class="workspace-title">
            <span>Graphical Operation Pipeline</span>
            ${
              evalResult.count > 0
                ? `<span style="color: #1db954; font-size: 0.85rem;">Result: ${evalResult.count} tracks</span>`
                : ''
            }
          </div>

          ${
            !baseCol
              ? `
            <div class="empty-placeholder">
              Search and add your first playlist or album above to start building operations.
            </div>
          `
              : `
            <div class="pipeline-sequence">
              <!-- Base Card -->
              <div class="pipeline-card base-card">
                <div class="card-identity">
                  <img class="card-thumb" src="${baseCol.imageUrl || ''}" alt="" />
                  <div>
                    <div style="font-size: 0.75rem; text-transform: uppercase; color: #1db954; font-weight: 700;">Base Source</div>
                    <div class="card-name">${baseCol.name}</div>
                    <div class="card-count">${baseCol.trackCount} tracks</div>
                  </div>
                </div>

                <div>
                  <select id="base-collection-select" class="operand-select" title="Change Base Source">
                    ${collections
                      .map(
                        (c) => `
                      <option value="${c.id}" ${c.id === baseCol.id ? 'selected' : ''}>
                        ${c.name} (${c.trackCount})
                      </option>
                    `
                      )
                      .join('')}
                  </select>
                </div>
              </div>

              <!-- Steps -->
              ${steps
                .map((step, idx) => {
                  const rightCol = this.graph.getCollection(step.rightCollectionId);
                  const isUnion = step.operation === SetOperationType.UNION;
                  const isIntersect = step.operation === SetOperationType.INTERSECTION;
                  const isDiff = step.operation === SetOperationType.DIFFERENCE;
                  const isSymDiff = step.operation === SetOperationType.SYMMETRIC_DIFFERENCE;

                  return `
                    <div class="operation-connector">
                      <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; margin-bottom: 2px;">
                        <span style="font-size: 0.75rem; color: #b3b3b3; font-weight: 700; text-transform: uppercase;">
                          Operation Step ${idx + 1}
                        </span>
                        ${
                          idx > 0
                            ? `<span style="font-size: 0.72rem; color: #1db954; font-weight: 600; background: rgba(29, 185, 84, 0.12); border: 1px solid rgba(29, 185, 84, 0.3); padding: 2px 8px; border-radius: 10px;">
                                Feeds from Step ${idx} Result (${evalResult.stepSnapshots[idx]?.count ?? 0} tracks)
                              </span>`
                            : `<span style="font-size: 0.72rem; color: #b3b3b3; font-weight: 500;">
                                Feeds from Base Source
                              </span>`
                        }
                      </div>

                      <!-- Venn Diagram Operation Symbols -->
                      <div class="venn-btn-group">
                        <button class="venn-symbol-btn ${isUnion ? 'active-union' : ''}" data-step-id="${step.id}" data-op="${SetOperationType.UNION}" title="Union: Combine all tracks">
                          ${SvgIcons.vennUnion(38, isUnion ? '#1db954' : '#b3b3b3')}
                          <span>Union (∪)</span>
                        </button>

                        <button class="venn-symbol-btn ${isIntersect ? 'active-intersection' : ''}" data-step-id="${step.id}" data-op="${SetOperationType.INTERSECTION}" title="Intersection: Only shared tracks">
                          ${SvgIcons.vennIntersection(38, isIntersect ? '#3d91f4' : '#b3b3b3')}
                          <span>Intersect (∩)</span>
                        </button>

                        <button class="venn-symbol-btn ${isDiff ? 'active-difference' : ''}" data-step-id="${step.id}" data-op="${SetOperationType.DIFFERENCE}" title="Difference: Subtract second from first">
                          ${SvgIcons.vennDifference(38, isDiff ? '#f59e0b' : '#b3b3b3')}
                          <span>Subtract (∖)</span>
                        </button>

                        <button class="venn-symbol-btn ${isSymDiff ? 'active-symdiff' : ''}" data-step-id="${step.id}" data-op="${SetOperationType.SYMMETRIC_DIFFERENCE}" title="Symmetric Difference: Unique to either">
                          ${SvgIcons.vennSymmetricDifference(38, isSymDiff ? '#b05dfa' : '#b3b3b3')}
                          <span>Sym Diff (Δ)</span>
                        </button>
                      </div>

                      <div style="display: flex; align-items: center; gap: 10px; margin-top: 6px;">
                        <span style="font-size: 0.85rem; color: #b3b3b3;">with:</span>
                        <select class="operand-select" data-step-id="${step.id}">
                          ${collections
                            .map(
                              (c) => `
                            <option value="${c.id}" ${c.id === step.rightCollectionId ? 'selected' : ''}>
                              ${c.name} (${c.trackCount} tracks)
                            </option>
                          `
                            )
                            .join('')}
                        </select>
                      </div>

                      <div class="step-footer-bar">
                        <span>Step ${idx + 1} Result: ${evalResult.stepSnapshots[idx + 1]?.count ?? 0} tracks</span>
                        <button class="delete-step-btn" data-step-id="${step.id}" style="color: #727272; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                          ${SvgIcons.trash(12)} Remove step
                        </button>
                      </div>
                    </div>

                    <!-- Operand Display Card -->
                    ${
                      rightCol
                        ? `
                      <div class="pipeline-card">
                        <div class="card-identity">
                          <img class="card-thumb" src="${rightCol.imageUrl || ''}" alt="" />
                          <div>
                            <div class="card-name">${rightCol.name}</div>
                            <div class="card-count">${rightCol.type} • ${rightCol.trackCount} tracks</div>
                          </div>
                        </div>
                      </div>
                    `
                        : ''
                    }
                  `;
                })
                .join('')}

              <button id="add-step-btn" class="btn-add-step">
                ${SvgIcons.plus(16)} Add Operation Step
              </button>
            </div>
          `
          }
        </div>
      </div>
    `;
  }
}

customElements.define('sso-visual-builder', SsoVisualBuilder);
