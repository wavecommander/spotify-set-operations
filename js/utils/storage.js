/**
 * Safe LocalStorage wrapper with JSON parsing and fallback.
 */

const MEMORY_STORE = new Map();

export const Storage = {
  get(key, defaultValue = null) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const item = window.localStorage.getItem(key);
        return item !== null ? JSON.parse(item) : defaultValue;
      }
    } catch (e) {
      console.warn(`Storage get error for key "${key}":`, e);
    }
    return MEMORY_STORE.has(key) ? MEMORY_STORE.get(key) : defaultValue;
  },

  set(key, value) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, JSON.stringify(value));
        return;
      }
    } catch (e) {
      console.warn(`Storage set error for key "${key}":`, e);
    }
    MEMORY_STORE.set(key, value);
  },

  remove(key) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch (e) {
      console.warn(`Storage remove error for key "${key}":`, e);
    }
    MEMORY_STORE.delete(key);
  },

  clear() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.clear();
        return;
      }
    } catch (e) {
      console.warn('Storage clear error:', e);
    }
    MEMORY_STORE.clear();
  },
};
