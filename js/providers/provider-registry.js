/**
 * Provider Registry
 * Manages registered streaming music providers and active selection.
 */

import { Storage } from '../utils/storage.js';

const STORAGE_ACTIVE_KEY = 'sso_active_provider_id';

class ProviderRegistryImpl {
  constructor() {
    /** @type {Map<string, import('./provider-interface.js').MusicProvider>} */
    this.providers = new Map();
    /** @type {string|null} */
    this.activeProviderId = null;
    /** @type {Set<Function>} */
    this.listeners = new Set();
  }

  /**
   * Registers a provider instance.
   * @param {import('./provider-interface.js').MusicProvider} provider
   */
  register(provider) {
    if (!provider || !provider.id) {
      throw new Error('Valid MusicProvider with id required');
    }
    this.providers.set(provider.id, provider);

    // If no active provider, or matching previously saved provider, set it
    const savedActiveId = Storage.get(STORAGE_ACTIVE_KEY);
    if (!this.activeProviderId || (savedActiveId && savedActiveId === provider.id)) {
      this.activeProviderId = provider.id;
    }
  }

  /**
   * Gets a registered provider by ID.
   * @param {string} id
   * @returns {import('./provider-interface.js').MusicProvider|undefined}
   */
  get(id) {
    return this.providers.get(id);
  }

  /**
   * Gets all registered providers.
   * @returns {import('./provider-interface.js').MusicProvider[]}
   */
  getAll() {
    return Array.from(this.providers.values());
  }

  /**
   * Gets the currently active provider.
   * @returns {import('./provider-interface.js').MusicProvider|null}
   */
  getActive() {
    if (!this.activeProviderId) {
      const first = this.providers.keys().next().value;
      if (first) this.activeProviderId = first;
    }
    return this.activeProviderId ? this.providers.get(this.activeProviderId) || null : null;
  }

  /**
   * Switches the active provider.
   * @param {string} id
   */
  setActive(id) {
    if (!this.providers.has(id)) {
      throw new Error(`Provider "${id}" is not registered`);
    }
    this.activeProviderId = id;
    Storage.set(STORAGE_ACTIVE_KEY, id);
    this.notify();
  }

  /**
   * Subscribes to active provider changes.
   * @param {Function} callback
   * @returns {Function} unsubscribe function
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    const active = this.getActive();
    for (const listener of this.listeners) {
      try {
        listener(active);
      } catch (err) {
        console.error('Error in provider listener:', err);
      }
    }
  }
}

export const ProviderRegistry = new ProviderRegistryImpl();
