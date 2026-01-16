/**
 * @fileoverview Background service worker for Zendesk File Renamer.
 *
 * This is the core of the extension. It runs as a service worker in the
 * background and handles:
 *   1. Receiving ticket ID updates from content scripts
 *   2. Intercepting file downloads
 *   3. Renaming files to include the ticket ID
 *   4. Managing extension settings
 *
 * Service workers in Manifest V3 are event-driven and may be terminated
 * when idle. All state must be stored persistently or reconstructed
 * from messages.
 *
 * @see https://developer.chrome.com/docs/extensions/mv3/service_workers/
 */

import {
  FILENAME_FORMATS,
  DEFAULT_SETTINGS,
  MESSAGE_TYPES,
  STORAGE_KEYS
} from './utils/constants.js';

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Maps tab IDs to their current Zendesk ticket IDs.
 *
 * This allows the extension to handle multiple Zendesk tabs simultaneously,
 * renaming downloads with the correct ticket ID for each tab.
 *
 * Note: This state is lost when the service worker is terminated.
 * Content scripts will re-send their ticket IDs when the worker restarts.
 *
 * @type {Map<number, string>}
 */
const tabTicketMap = new Map();

// ============================================================================
// SETTINGS MANAGEMENT
// ============================================================================

/**
 * Retrieves the current extension settings from storage.
 *
 * Uses chrome.storage.sync which syncs settings across the user's
 * Chrome instances. Falls back to defaults if no settings exist.
 *
 * @returns {Promise<Object>} The current settings object.
 * @property {boolean} enabled - Whether file renaming is active.
 * @property {string} format - ID of the active filename format.
 */
async function getSettings() {
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
    return result[STORAGE_KEYS.SETTINGS] || DEFAULT_SETTINGS;
  } catch (error) {
    console.error('[Zendesk File Renamer] Failed to load settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Gets the format template for a given format ID.
 *
 * @param {string} formatId - The format identifier.
 * @returns {string} The format template string.
 */
function getFormatTemplate(formatId) {
  // Find the format object by ID
  for (const format of Object.values(FILENAME_FORMATS)) {
    if (format.id === formatId) {
      return format.template;
    }
  }

  // Fall back to default format
  return FILENAME_FORMATS.PREFIX_UNDERSCORE.template;
}

// ============================================================================
// FILENAME FORMATTING
// ============================================================================

/**
 * Generates a new filename with the ticket ID included.
 *
 * Takes the original filename and applies the user's chosen format
 * to prepend the ticket ID.
 *
 * @param {string} originalFilename - The original download filename.
 * @param {string} ticketId - The Zendesk ticket ID.
 * @param {string} formatTemplate - The format template to apply.
 * @returns {string} The new filename with ticket ID included.
 *
 * @example
 * formatFilename('debug.log', '123456', 'ZD-{ticket}_{filename}');
 * // Returns: 'ZD-123456_debug.log'
 *
 * @example
 * formatFilename('attachment.pdf', '789', '[{ticket}] {filename}');
 * // Returns: '[789] attachment.pdf'
 */
function formatFilename(originalFilename, ticketId, formatTemplate) {
  return formatTemplate
    .replace('{ticket}', ticketId)
    .replace('{filename}', originalFilename);
}

/**
 * Extracts the filename from a full path.
 *
 * Downloads may include subdirectory paths. This function extracts
 * just the filename component for renaming.
 *
 * @param {string} fullPath - The full download path (may include directories).
 * @returns {string} Just the filename component.
 *
 * @example
 * extractFilename('downloads/zendesk/debug.log');
 * // Returns: 'debug.log'
 */
function extractFilename(fullPath) {
  // Handle both forward and back slashes
  const parts = fullPath.split(/[/\\]/);
  return parts[parts.length - 1];
}

/**
 * Reconstructs a path with a new filename.
 *
 * If the download had a subdirectory path, this preserves it
 * while replacing the filename.
 *
 * @param {string} originalPath - The original full path.
 * @param {string} newFilename - The new filename to use.
 * @returns {string} The path with the new filename.
 *
 * @example
 * reconstructPath('subdir/original.log', 'ZD-123_original.log');
 * // Returns: 'subdir/ZD-123_original.log'
 */
function reconstructPath(originalPath, newFilename) {
  const lastSlash = Math.max(
    originalPath.lastIndexOf('/'),
    originalPath.lastIndexOf('\\')
  );

  if (lastSlash === -1) {
    // No directory component
    return newFilename;
  }

  // Preserve directory path
  return originalPath.substring(0, lastSlash + 1) + newFilename;
}

// ============================================================================
// TAB AND URL UTILITIES
// ============================================================================

/**
 * Checks if a URL belongs to a Zendesk domain (or localhost for testing).
 *
 * Zendesk uses multiple domains:
 *   - *.zendesk.com - Main application
 *   - *.zdusercontent.com - CDN for attachments/files
 *   - *.zdassets.com - Static assets
 *
 * @param {string} url - The URL to check.
 * @returns {boolean} True if the URL is a Zendesk domain or localhost.
 */
function isZendeskUrl(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    // Include all Zendesk domains and localhost for testing
    return hostname.endsWith('.zendesk.com') ||
           hostname.endsWith('.zdusercontent.com') ||
           hostname.endsWith('.zdassets.com') ||
           hostname === 'localhost';
  } catch {
    return false;
  }
}

/**
 * Gets the ticket ID for a given tab.
 *
 * First checks the in-memory cache. If not found (e.g., service worker
 * was restarted), queries the content script directly.
 *
 * @param {number} tabId - The Chrome tab ID.
 * @returns {Promise<string|null>} The ticket ID or null if not found.
 */
async function getTicketIdForTab(tabId) {
  // Check in-memory cache first
  if (tabTicketMap.has(tabId)) {
    return tabTicketMap.get(tabId);
  }

  // Query the content script directly
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: MESSAGE_TYPES.GET_TICKET
    });

    if (response && response.ticketId) {
      // Cache the result
      tabTicketMap.set(tabId, response.ticketId);
      return response.ticketId;
    }
  } catch (error) {
    // Content script may not be loaded yet - this is normal
    console.debug('[Zendesk File Renamer] Could not query tab:', tabId, error.message);
  }

  return null;
}

// ============================================================================
// DOWNLOAD INTERCEPTION
// ============================================================================

/**
 * Default timeout for download filename determination (in milliseconds).
 * If async operations take longer than this, we fall back to the original filename
 * to prevent downloads from hanging indefinitely.
 */
const DOWNLOAD_TIMEOUT_MS = 5000;

/**
 * Wraps the suggest callback with a timeout to ensure it's always called.
 *
 * In Manifest V3, service workers can be terminated mid-execution. This wrapper
 * ensures that suggest() is called within a reasonable timeframe, preventing
 * downloads from hanging if the service worker is terminated or async operations
 * fail silently.
 *
 * @param {Function} suggest - The original suggest callback.
 * @param {number} timeoutMs - Timeout in milliseconds.
 * @returns {Object} An object with safeSuggest() and cleanup() functions.
 */
function createSafeSuggest(suggest, timeoutMs = DOWNLOAD_TIMEOUT_MS) {
  let called = false;
  let timeoutId = null;

  const safeSuggest = (options) => {
    if (called) return; // Prevent double-calling
    called = true;
    if (timeoutId) clearTimeout(timeoutId);
    suggest(options);
  };

  // Set up timeout fallback
  timeoutId = setTimeout(() => {
    if (!called) {
      console.warn('[Zendesk File Renamer] Download handling timed out, using original filename');
      safeSuggest(); // Call without options to keep original filename
    }
  }, timeoutMs);

  return { safeSuggest, cleanup: () => clearTimeout(timeoutId) };
}

/**
 * Handles the download filename determination event.
 *
 * This is the core download interception logic. Chrome fires this event
 * when a download is about to start, giving us a chance to suggest a
 * different filename.
 *
 * The suggest() callback must be called exactly once, either:
 *   - With a new filename: suggest({ filename: 'new-name.txt' })
 *   - Without arguments to keep original: suggest()
 *
 * @param {Object} downloadItem - Information about the download.
 * @param {Function} suggest - Callback to suggest a new filename.
 */
async function handleDownloadFilename(downloadItem, suggest) {
  // Wrap suggest() with timeout protection
  const { safeSuggest } = createSafeSuggest(suggest);
  console.log('[Zendesk File Renamer] Processing download...');

  // Get current settings
  const settings = await getSettings();
  console.log('[Zendesk File Renamer] Settings:', settings);

  // If renaming is disabled, use original filename
  if (!settings.enabled) {
    console.log('[Zendesk File Renamer] SKIP: Renaming disabled');
    safeSuggest();
    return;
  }

  // Check if this download originated from a Zendesk tab
  // downloadItem.referrer or downloadItem.url may indicate the source
  const referrerUrl = downloadItem.referrer || '';
  const tabId = downloadItem.tabId;

  console.log('[Zendesk File Renamer] Referrer check:', referrerUrl, 'isZendesk:', isZendeskUrl(referrerUrl));

  // Verify this is from a Zendesk page
  if (!isZendeskUrl(referrerUrl) && !tabId) {
    // Download not from a Zendesk tab
    console.log('[Zendesk File Renamer] SKIP: Not from Zendesk, referrer:', referrerUrl);
    safeSuggest();
    return;
  }

  // Get the ticket ID for this tab
  let ticketId = null;

  if (tabId && tabId !== -1) {
    ticketId = await getTicketIdForTab(tabId);
    console.log('[Zendesk File Renamer] Ticket from tabId:', tabId, '→', ticketId);
  }

  // Fallback: if no tabId (e.g., data: URI downloads), search for ticket
  if (!ticketId && isZendeskUrl(referrerUrl)) {
    console.log('[Zendesk File Renamer] Trying fallback methods...');

    // Method 1: Try to get the currently active Zendesk tab first
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab && isZendeskUrl(activeTab.url || '')) {
        // Check if we have a cached ticket for the active tab
        if (tabTicketMap.has(activeTab.id)) {
          ticketId = tabTicketMap.get(activeTab.id);
          console.log('[Zendesk File Renamer] Using ticket from active tab', activeTab.id, ':', ticketId);
        } else {
          // Query the active tab's content script
          try {
            const response = await chrome.tabs.sendMessage(activeTab.id, {
              type: MESSAGE_TYPES.GET_TICKET
            });
            if (response && response.ticketId) {
              ticketId = response.ticketId;
              tabTicketMap.set(activeTab.id, ticketId);
              console.log('[Zendesk File Renamer] Got ticket from active tab', activeTab.id, ':', ticketId);
            }
          } catch (msgError) {
            console.debug('[Zendesk File Renamer] Active tab query failed:', msgError.message);
          }
        }
      }
    } catch (e) {
      console.debug('[Zendesk File Renamer] Could not query active tab:', e.message);
    }

    // Method 2: If no active Zendesk tab, query all Zendesk tabs
    if (!ticketId) {
      console.log('[Zendesk File Renamer] No active Zendesk tab, querying all Zendesk tabs...');
      try {
        const zendeskTabs = await chrome.tabs.query({ url: '*://*.zendesk.com/*' });
        console.log('[Zendesk File Renamer] Found', zendeskTabs.length, 'Zendesk tabs');

        // Prioritize tabs that have cached tickets (known to be on ticket pages)
        for (const tab of zendeskTabs) {
          if (tabTicketMap.has(tab.id)) {
            ticketId = tabTicketMap.get(tab.id);
            console.log('[Zendesk File Renamer] Using cached ticket from tab', tab.id, ':', ticketId);
            break;
          }
        }

        // If still no ticket, query content scripts
        if (!ticketId) {
          for (const tab of zendeskTabs) {
            try {
              const response = await chrome.tabs.sendMessage(tab.id, {
                type: MESSAGE_TYPES.GET_TICKET
              });
              if (response && response.ticketId) {
                ticketId = response.ticketId;
                tabTicketMap.set(tab.id, ticketId);
                console.log('[Zendesk File Renamer] Got ticket from tab', tab.id, ':', ticketId);
                break;
              }
            } catch (msgError) {
              // Tab might not have content script, continue to next
              console.debug('[Zendesk File Renamer] Tab', tab.id, 'failed:', msgError.message);
            }
          }
        }
      } catch (e) {
        console.log('[Zendesk File Renamer] Tab query error:', e);
      }
    }
  }

  // If we couldn't determine the ticket ID, keep original filename
  if (!ticketId) {
    console.log('[Zendesk File Renamer] SKIP: No ticket ID found');
    console.log('[Zendesk File Renamer] Current tabTicketMap:', [...tabTicketMap.entries()]);
    safeSuggest();
    return;
  }

  // Extract just the filename from the path
  const originalFilename = extractFilename(downloadItem.filename);

  // Check if file already has a ticket prefix (avoid double-renaming)
  // More specific check: only skip if it matches our known format patterns
  if (originalFilename.startsWith('ZD-') ||
      /^\[\d+\]\s/.test(originalFilename)) {
    console.debug('[Zendesk File Renamer] File already appears renamed:', originalFilename);
    safeSuggest();
    return;
  }

  // Generate the new filename
  const formatTemplate = getFormatTemplate(settings.format);
  const newFilename = formatFilename(originalFilename, ticketId, formatTemplate);

  // Reconstruct full path with new filename
  const newPath = reconstructPath(downloadItem.filename, newFilename);

  console.log('[Zendesk File Renamer] Renaming download:', {
    original: downloadItem.filename,
    new: newPath,
    ticketId: ticketId
  });

  // Suggest the new filename
  safeSuggest({ filename: newPath });
}

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

/**
 * Handles messages from content scripts and popup.
 *
 * Content scripts send TICKET_UPDATE messages when:
 *   - Page first loads
 *   - User navigates to a different ticket
 *   - URL changes within the SPA
 *
 * @param {Object} message - The message object.
 * @param {Object} sender - Information about the sender.
 * @param {Function} sendResponse - Callback for response.
 * @returns {boolean} True if response will be sent asynchronously.
 */
function handleMessage(message, sender, sendResponse) {
  console.log('[Zendesk File Renamer] Message received:', message, 'from tab:', sender.tab?.id);

  if (message.type === MESSAGE_TYPES.TICKET_UPDATE) {
    // Content script is reporting a ticket ID
    const tabId = sender.tab?.id;

    if (tabId) {
      if (message.ticketId) {
        // Store the ticket ID for this tab
        tabTicketMap.set(tabId, message.ticketId);
        console.debug('[Zendesk File Renamer] Ticket update:', {
          tabId,
          ticketId: message.ticketId
        });
      } else {
        // No ticket ID (user navigated away from ticket view)
        tabTicketMap.delete(tabId);
      }
    }
  }

  // Synchronous response
  return false;
}

// ============================================================================
// TAB LIFECYCLE
// ============================================================================

/**
 * Cleans up state when a tab is closed.
 *
 * Removes the ticket ID mapping to prevent memory leaks
 * from accumulating stale data.
 *
 * @param {number} tabId - The ID of the closed tab.
 */
function handleTabRemoved(tabId) {
  tabTicketMap.delete(tabId);
}

/**
 * Handles tab URL updates.
 *
 * If a tab navigates away from Zendesk, clear its ticket ID.
 * The content script will send a new update if they return.
 *
 * @param {number} tabId - The tab ID.
 * @param {Object} changeInfo - What changed.
 * @param {Object} tab - Full tab information.
 */
function handleTabUpdated(tabId, changeInfo, tab) {
  // Only care about URL changes
  if (!changeInfo.url) {
    return;
  }

  // If navigated away from Zendesk, clear the mapping
  if (!isZendeskUrl(changeInfo.url)) {
    tabTicketMap.delete(tabId);
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

// Download interception - the core functionality
// Note: Must return true from the listener to indicate async response
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  console.log('[Zendesk File Renamer] Download intercepted:', {
    filename: downloadItem.filename,
    url: downloadItem.url?.substring(0, 100),
    referrer: downloadItem.referrer,
    tabId: downloadItem.tabId
  });
  // Handle asynchronously
  handleDownloadFilename(downloadItem, suggest);
  // Return true to indicate we'll call suggest() asynchronously
  return true;
});

// Message handling from content scripts
chrome.runtime.onMessage.addListener(handleMessage);

// Tab lifecycle management
chrome.tabs.onRemoved.addListener(handleTabRemoved);
chrome.tabs.onUpdated.addListener(handleTabUpdated);

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the service worker.
 *
 * Service workers may be started and stopped frequently.
 * This initialization is minimal - most state is reconstructed
 * from content script messages as needed.
 */
function initialize() {
  console.log('[Zendesk File Renamer] Service worker initialized');
}

// Run initialization
initialize();
