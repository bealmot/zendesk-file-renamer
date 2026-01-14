/**
 * @fileoverview Firefox background script for Zendesk File Renamer.
 *
 * Handles downloads initiated by the content script. Background scripts
 * can bypass CORS restrictions and use the downloads API with custom filenames.
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
// MESSAGE HANDLING
// ============================================================================

/**
 * Handle messages from content script.
 */
browser.runtime.onMessage.addListener(async (message, sender) => {
  console.log('[Zendesk File Renamer] Message received:', message);

  if (message.type === 'DOWNLOAD_FILE') {
    try {
      // Use Firefox's downloads API to download with custom filename
      const downloadId = await browser.downloads.download({
        url: message.url,
        filename: message.filename,
        saveAs: false
      });

      console.log('[Zendesk File Renamer] Download started:', {
        id: downloadId,
        filename: message.filename
      });

      return { success: true, downloadId };
    } catch (error) {
      console.error('[Zendesk File Renamer] Download failed:', error);
      return { success: false, error: error.message };
    }
  }

  return { success: false, error: 'Unknown message type' };
});

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
