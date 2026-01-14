/**
 * @fileoverview Firefox background script for Zendesk File Renamer.
 *
 * Minimal background script for Firefox. The heavy lifting is done
 * by the content script which intercepts download link clicks.
 *
 * This script handles:
 *   - Extension installation/update events
 *   - Default settings initialization
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_SETTINGS = {
  enabled: true,
  format: 'prefix_underscore'
};

const STORAGE_KEY = 'settings';

// ============================================================================
// INSTALLATION
// ============================================================================

/**
 * Handle extension installation or update.
 */
browser.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Set default settings on first install
    const existing = await browser.storage.sync.get(STORAGE_KEY);
    if (!existing[STORAGE_KEY]) {
      await browser.storage.sync.set({ [STORAGE_KEY]: DEFAULT_SETTINGS });
      console.log('[Zendesk File Renamer] Default settings initialized');
    }
  }

  console.log('[Zendesk File Renamer] Extension installed/updated:', details.reason);
});

// ============================================================================
// INITIALIZATION
// ============================================================================

console.log('[Zendesk File Renamer] Firefox background script loaded');
