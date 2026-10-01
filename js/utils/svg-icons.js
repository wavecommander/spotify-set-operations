/**
 * SVG Icons for Venn Operations and UI Actions.
 * Venn diagrams visually represent Union, Intersection, Difference, and Symmetric Difference.
 */

export const SvgIcons = {
  /**
   * Union: Both circles filled.
   */
  vennUnion(size = 36, color = '#1DB954') {
    return `<svg width="${size}" height="${size * 0.6}" viewBox="0 0 100 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <mask id="u-mask">
          <rect width="100" height="60" fill="black" />
          <circle cx="36" cy="30" r="24" fill="white" />
          <circle cx="64" cy="30" r="24" fill="white" />
        </mask>
      </defs>
      <!-- Background circles outline -->
      <circle cx="36" cy="30" r="24" stroke="${color}" stroke-width="2.5" fill="none" opacity="0.4"/>
      <circle cx="64" cy="30" r="24" stroke="${color}" stroke-width="2.5" fill="none" opacity="0.4"/>
      <!-- Filled Union -->
      <rect width="100" height="60" fill="${color}" mask="url(#u-mask)" fill-opacity="0.85" />
      <circle cx="36" cy="30" r="24" stroke="${color}" stroke-width="2" fill="none" />
      <circle cx="64" cy="30" r="24" stroke="${color}" stroke-width="2" fill="none" />
    </svg>`;
  },

  /**
   * Intersection: Center lens only filled.
   */
  vennIntersection(size = 36, color = '#3d91f4') {
    return `<svg width="${size}" height="${size * 0.6}" viewBox="0 0 100 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="i-clip">
          <circle cx="36" cy="30" r="24" />
        </clipPath>
      </defs>
      <!-- Circle outlines -->
      <circle cx="36" cy="30" r="24" stroke="${color}" stroke-width="2" fill="none" opacity="0.4" />
      <circle cx="64" cy="30" r="24" stroke="${color}" stroke-width="2" fill="none" opacity="0.4" />
      <!-- Center overlap filled -->
      <circle cx="64" cy="30" r="24" fill="${color}" fill-opacity="0.9" clip-path="url(#i-clip)" />
      <circle cx="36" cy="30" r="24" stroke="${color}" stroke-width="2" fill="none" />
      <circle cx="64" cy="30" r="24" stroke="${color}" stroke-width="2" fill="none" />
    </svg>`;
  },

  /**
   * Difference: Left circle filled minus overlap.
   */
  vennDifference(size = 36, color = '#f59e0b') {
    return `<svg width="${size}" height="${size * 0.6}" viewBox="0 0 100 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <mask id="d-mask">
          <rect width="100" height="60" fill="black" />
          <circle cx="36" cy="30" r="24" fill="white" />
          <circle cx="64" cy="30" r="24" fill="black" />
        </mask>
      </defs>
      <circle cx="36" cy="30" r="24" stroke="${color}" stroke-width="2" fill="none" opacity="0.4" />
      <circle cx="64" cy="30" r="24" stroke="${color}" stroke-width="2" fill="none" opacity="0.4" />
      <!-- Left only filled -->
      <rect width="100" height="60" fill="${color}" mask="url(#d-mask)" fill-opacity="0.9" />
      <circle cx="36" cy="30" r="24" stroke="${color}" stroke-width="2" fill="none" />
      <circle cx="64" cy="30" r="24" stroke="${color}" stroke-width="2" fill="none" />
    </svg>`;
  },

  /**
   * Symmetric Difference: Outer crescents filled, center empty.
   */
  vennSymmetricDifference(size = 36, color = '#b05dfa') {
    return `<svg width="${size}" height="${size * 0.6}" viewBox="0 0 100 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <mask id="sd-left">
          <rect width="100" height="60" fill="black" />
          <circle cx="36" cy="30" r="24" fill="white" />
          <circle cx="64" cy="30" r="24" fill="black" />
        </mask>
        <mask id="sd-right">
          <rect width="100" height="60" fill="black" />
          <circle cx="64" cy="30" r="24" fill="white" />
          <circle cx="36" cy="30" r="24" fill="black" />
        </mask>
      </defs>
      <circle cx="36" cy="30" r="24" stroke="${color}" stroke-width="2" fill="none" opacity="0.4" />
      <circle cx="64" cy="30" r="24" stroke="${color}" stroke-width="2" fill="none" opacity="0.4" />
      <!-- Left crescent -->
      <rect width="100" height="60" fill="${color}" mask="url(#sd-left)" fill-opacity="0.9" />
      <!-- Right crescent -->
      <rect width="100" height="60" fill="${color}" mask="url(#sd-right)" fill-opacity="0.9" />
      <circle cx="36" cy="30" r="24" stroke="${color}" stroke-width="2" fill="none" />
      <circle cx="64" cy="30" r="24" stroke="${color}" stroke-width="2" fill="none" />
    </svg>`;
  },

  arrowDown(size = 16) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <polyline points="19 12 12 19 5 12"></polyline>
    </svg>`;
  },

  search(size = 18) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>`;
  },

  plus(size = 18) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>`;
  },

  trash(size = 18) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>`;
  },

  close(size = 18) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>`;
  },

  exportIcon(size = 18) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>`;
  },

  slice(size = 18) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="6" cy="6" r="3"></circle>
      <circle cx="6" cy="18" r="3"></circle>
      <line x1="20" y1="4" x2="8.12" y2="15.88"></line>
      <line x1="14.47" y1="14.48" x2="20" y2="20"></line>
      <line x1="8.12" y1="8.12" x2="12" y2="12"></line>
    </svg>`;
  },

  settings(size = 18) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>`;
  },

  music(size = 18) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 18V5l12-2v13"></path>
      <circle cx="6" cy="18" r="3"></circle>
      <circle cx="18" cy="16" r="3"></circle>
    </svg>`;
  },

  spotify(size = 20) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.48.66.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>`;
  },

  ytmusic(size = 20) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104 0-3.924 3.18-7.104 7.104-7.104 3.924 0 7.104 3.18 7.104 7.104 0 3.924-3.18 7.104-7.104 7.104zm0-11.784c-2.58 0-4.68 2.1-4.68 4.68s2.1 4.68 4.68 4.68 4.68-2.1 4.68-4.68-2.1-4.68-4.68-4.68zm-1.2 6.72V9.864l3.6 2.088-3.6 2.088z"/>
    </svg>`;
  },
};
