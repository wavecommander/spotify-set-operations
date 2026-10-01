/**
 * Dynamic SVG Venn Diagram Component (<sso-venn-diagram>)
 * Visualizes partitions between two collections with live song counts and interactive segment filtering.
 * Supports multi-step operation pipelines with step indicators and operand flow.
 */

import { SetEngine, SetOperationType } from '../core/set-engine.js';
import { SvgIcons } from '../utils/svg-icons.js';

export class SsoVennDiagram extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.collectionA = null;
    this.collectionB = null;
    this.operation = SetOperationType.UNION;
    this.activeFilter = 'all'; // 'all', 'onlyA', 'overlap', 'onlyB'
    this.stepNumber = null;
    this.totalSteps = null;
    this.stepIndex = 0;
  }

  connectedCallback() {
    this.render();
    this.setupListeners();
  }

  setData({ collectionA, collectionB, operation, stepNumber, totalSteps, stepIndex }) {
    this.collectionA = collectionA;
    this.collectionB = collectionB;
    if (operation) this.operation = operation;
    if (stepNumber !== undefined) this.stepNumber = stepNumber;
    if (totalSteps !== undefined) this.totalSteps = totalSteps;
    if (stepIndex !== undefined) this.stepIndex = stepIndex;
    this.render();
    this.setupListeners();
  }

  setOperation(operation) {
    this.operation = operation;
    this.render();
    this.setupListeners();
  }

  clearFilter() {
    if (this.activeFilter !== 'all') {
      this.activeFilter = 'all';
      this.render();
      this.setupListeners();
    }
  }

  setupListeners() {
    const clickables = this.shadowRoot.querySelectorAll('.venn-interactive-slice, .legend-item');
    clickables.forEach((item) => {
      item.addEventListener('click', (e) => {
        const sliceType = e.currentTarget.dataset.slice;
        if (!sliceType) return;

        this.activeFilter = this.activeFilter === sliceType ? 'all' : sliceType;
        this.dispatchEvent(
          new CustomEvent('filter-slice', {
            detail: {
              slice: this.activeFilter,
              stepIndex: this.stepIndex ?? 0,
              collectionA: this.collectionA,
              collectionB: this.collectionB,
              operation: this.operation,
            },
            bubbles: true,
            composed: true,
          })
        );
        this.render();
        this.setupListeners();
      });
    });
  }

  render() {
    if (!this.collectionA || !this.collectionB) {
      this.shadowRoot.innerHTML = `
        <style>
          :host { display: block; }
          .empty-box {
            padding: 32px 20px;
            background: #181818;
            border: 1px dashed rgba(255, 255, 255, 0.15);
            border-radius: 12px;
            text-align: center;
            color: #727272;
            font-size: 0.9rem;
          }
        </style>
        <div class="empty-box">
          Select or add at least two collections above to inspect their Venn overlap.
        </div>
      `;
      return;
    }

    const partition = SetEngine.getVennPartition(this.collectionA, this.collectionB);
    const op = this.operation;

    // Operation colors
    let opColor = '#1db954';
    if (op === SetOperationType.INTERSECTION) opColor = '#3d91f4';
    if (op === SetOperationType.DIFFERENCE) opColor = '#f59e0b';
    if (op === SetOperationType.SYMMETRIC_DIFFERENCE) opColor = '#b05dfa';

    // SVG Geometry
    const cxA = 190, cxB = 310, cy = 130, r = 100;

    // Determine region opacities based on active operation
    const isUnion = op === SetOperationType.UNION;
    const isIntersect = op === SetOperationType.INTERSECTION;
    const isDiff = op === SetOperationType.DIFFERENCE;
    const isSymDiff = op === SetOperationType.SYMMETRIC_DIFFERENCE;

    const fillLeft = isUnion || isDiff || isSymDiff;
    const fillCenter = isUnion || isIntersect;
    const fillRight = isUnion || isSymDiff;

    // Unique IDs for SVG defs to avoid collisions across multiple Venn cards
    const uid = `step-${this.stepIndex ?? 0}`;
    const clipAId = `clip-a-${uid}`;
    const maskLeftId = `mask-left-${uid}`;
    const maskRightId = `mask-right-${uid}`;

    const totalStepResult =
      op === SetOperationType.UNION
        ? partition.totalUnique
        : op === SetOperationType.INTERSECTION
        ? partition.countOverlap
        : op === SetOperationType.DIFFERENCE
        ? partition.countA
        : partition.countA + partition.countB;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .venn-card {
          background: #181818;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .venn-card:hover {
          border-color: rgba(255, 255, 255, 0.16);
        }
        .step-header {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .step-badge {
          background: rgba(29, 185, 84, 0.15);
          color: #1db954;
          border: 1px solid rgba(29, 185, 84, 0.35);
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 3px 10px;
          border-radius: 12px;
        }
        .step-op-pill {
          font-size: 0.8rem;
          font-weight: 700;
          color: ${opColor};
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .header-row {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          font-size: 0.85rem;
          color: #b3b3b3;
          gap: 12px;
        }
        .source-tag {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          color: #ffffff;
          max-width: 170px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .source-tag img {
          width: 22px;
          height: 22px;
          border-radius: 4px;
          object-fit: cover;
          flex-shrink: 0;
        }
        .source-icon-placeholder {
          width: 22px;
          height: 22px;
          border-radius: 4px;
          background: #282828;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #1db954;
          flex-shrink: 0;
        }
        .summary-badge {
          background: #242424;
          padding: 5px 12px;
          border-radius: 20px;
          font-weight: 700;
          color: ${opColor};
          border: 1px solid ${opColor}44;
          font-size: 0.82rem;
          white-space: nowrap;
          text-align: center;
        }
        .svg-container {
          width: 100%;
          max-width: 520px;
        }
        svg {
          width: 100%;
          height: auto;
          overflow: visible;
        }
        .venn-interactive-slice {
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .venn-interactive-slice:hover {
          filter: brightness(1.25);
        }
        .venn-interactive-slice.filter-selected {
          stroke: #ffffff;
          stroke-width: 2.5;
        }
        .legend-row {
          display: flex;
          gap: 12px;
          margin-top: 14px;
          font-size: 0.78rem;
          flex-wrap: wrap;
          justify-content: center;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #b3b3b3;
          cursor: pointer;
          padding: 4px 10px;
          border-radius: 6px;
          background: #202020;
          border: 1px solid rgba(255, 255, 255, 0.05);
          transition: all 0.15s ease;
        }
        .legend-item:hover, .legend-item.active {
          background: #282828;
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.2);
        }
        .legend-item.active {
          border-color: ${opColor};
          box-shadow: 0 0 8px ${opColor}33;
        }
        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }
      </style>

      <div class="venn-card">
        ${
          this.stepNumber
            ? `
          <div class="step-header">
            <div class="step-badge">Step ${this.stepNumber}${
                this.totalSteps && this.totalSteps > 1 ? ` of ${this.totalSteps}` : ''
              }</div>
            <div class="step-op-pill">
              <span>${SetEngine.getOperationName(op)}</span>
              <span>(${SetEngine.getSymbol(op)})</span>
            </div>
          </div>
        `
            : ''
        }

        <div class="header-row">
          <div class="source-tag" title="${this.collectionA.name}">
            ${
              this.collectionA.imageUrl
                ? `<img src="${this.collectionA.imageUrl}" alt="" />`
                : `<div class="source-icon-placeholder">${SvgIcons.music(13)}</div>`
            }
            <span style="overflow: hidden; text-overflow: ellipsis;">${this.collectionA.name}</span>
          </div>

          <div class="summary-badge">
            ${SetEngine.getOperationName(op)}: ${totalStepResult} tracks
          </div>

          <div class="source-tag" style="justify-content: flex-end;" title="${this.collectionB.name}">
            <span style="overflow: hidden; text-overflow: ellipsis;">${this.collectionB.name}</span>
            ${
              this.collectionB.imageUrl
                ? `<img src="${this.collectionB.imageUrl}" alt="" />`
                : `<div class="source-icon-placeholder">${SvgIcons.music(13)}</div>`
            }
          </div>
        </div>

        <div class="svg-container">
          <svg viewBox="0 0 500 260">
            <defs>
              <!-- Center intersection clip -->
              <clipPath id="${clipAId}">
                <circle cx="${cxA}" cy="${cy}" r="${r}" />
              </clipPath>
              <!-- Left only mask (A minus B) -->
              <mask id="${maskLeftId}">
                <rect width="500" height="260" fill="white" />
                <circle cx="${cxB}" cy="${cy}" r="${r}" fill="black" />
              </mask>
              <!-- Right only mask (B minus A) -->
              <mask id="${maskRightId}">
                <rect width="500" height="260" fill="white" />
                <circle cx="${cxA}" cy="${cy}" r="${r}" fill="black" />
              </mask>
            </defs>

            <!-- Background Circles Outline -->
            <circle cx="${cxA}" cy="${cy}" r="${r}" fill="#242424" fill-opacity="0.3" stroke="rgba(255,255,255,0.2)" stroke-width="2" />
            <circle cx="${cxB}" cy="${cy}" r="${r}" fill="#242424" fill-opacity="0.3" stroke="rgba(255,255,255,0.2)" stroke-width="2" />

            <!-- LEFT CRESCENT (Only in A) -->
            <circle
              class="venn-interactive-slice ${this.activeFilter === 'onlyA' ? 'filter-selected' : ''}"
              data-slice="onlyA"
              cx="${cxA}"
              cy="${cy}"
              r="${r}"
              fill="${fillLeft ? opColor : '#333333'}"
              fill-opacity="${fillLeft ? 0.75 : 0.2}"
              mask="url(#${maskLeftId})"
            />

            <!-- RIGHT CRESCENT (Only in B) -->
            <circle
              class="venn-interactive-slice ${this.activeFilter === 'onlyB' ? 'filter-selected' : ''}"
              data-slice="onlyB"
              cx="${cxB}"
              cy="${cy}"
              r="${r}"
              fill="${fillRight ? opColor : '#333333'}"
              fill-opacity="${fillRight ? 0.75 : 0.2}"
              mask="url(#${maskRightId})"
            />

            <!-- CENTER LENS (Overlap) -->
            <circle
              class="venn-interactive-slice ${this.activeFilter === 'overlap' ? 'filter-selected' : ''}"
              data-slice="overlap"
              cx="${cxB}"
              cy="${cy}"
              r="${r}"
              fill="${fillCenter ? opColor : '#333333'}"
              fill-opacity="${fillCenter ? 0.88 : 0.2}"
              clip-path="url(#${clipAId})"
            />

            <!-- Outer Circle Strokes -->
            <circle cx="${cxA}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" pointer-events="none" />
            <circle cx="${cxB}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" pointer-events="none" />

            <!-- Track Counts inside Partitions -->
            <!-- Left Only Count -->
            <text x="135" y="125" text-anchor="middle" fill="#ffffff" font-size="19" font-weight="700" font-family="monospace">
              ${partition.countA}
            </text>
            <text x="135" y="145" text-anchor="middle" fill="#b3b3b3" font-size="11" font-weight="600">
              Only in Left
            </text>

            <!-- Overlap Count -->
            <text x="250" y="125" text-anchor="middle" fill="#ffffff" font-size="21" font-weight="800" font-family="monospace">
              ${partition.countOverlap}
            </text>
            <text x="250" y="145" text-anchor="middle" fill="#b3b3b3" font-size="11" font-weight="600">
              In Both
            </text>

            <!-- Right Only Count -->
            <text x="365" y="125" text-anchor="middle" fill="#ffffff" font-size="19" font-weight="700" font-family="monospace">
              ${partition.countB}
            </text>
            <text x="365" y="145" text-anchor="middle" fill="#b3b3b3" font-size="11" font-weight="600">
              Only in Right
            </text>
          </svg>
        </div>

        <div class="legend-row">
          <div class="legend-item ${this.activeFilter === 'all' ? 'active' : ''}" data-slice="all" title="View all result tracks for this step">
            <span class="legend-dot" style="background: ${opColor};"></span>
            All Result Tracks (${totalStepResult})
          </div>
          <div class="legend-item ${this.activeFilter === 'onlyA' ? 'active' : ''}" data-slice="onlyA" title="Filter tracks only in left collection">
            <span class="legend-dot" style="background: #eab308;"></span>
            Left Only (${partition.countA})
          </div>
          <div class="legend-item ${this.activeFilter === 'overlap' ? 'active' : ''}" data-slice="overlap" title="Filter shared tracks">
            <span class="legend-dot" style="background: #3d91f4;"></span>
            Shared (${partition.countOverlap})
          </div>
          <div class="legend-item ${this.activeFilter === 'onlyB' ? 'active' : ''}" data-slice="onlyB" title="Filter tracks only in right collection">
            <span class="legend-dot" style="background: #a855f7;"></span>
            Right Only (${partition.countB})
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('sso-venn-diagram', SsoVennDiagram);
