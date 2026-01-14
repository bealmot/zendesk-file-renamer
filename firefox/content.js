/**
 * @fileoverview Firefox content script for Zendesk File Renamer.
 *
 * Firefox doesn't support chrome.downloads.onDeterminingFilename, so we use
 * a different approach: intercept clicks on download links (<a> tags) and
 * modify the 'download' attribute before the download starts.
 *
 * This works for most Zendesk attachments since they use <a href="..."> links.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * URL patterns for extracting Zendesk ticket IDs.
 */
const TICKET_URL_PATTERNS = [
  /\/agent\/tickets\/(\d+)/,
  /#\/tickets\/(\d+)/,
  /\/tickets\/(\d+)/
];

/**
 * Domains that indicate a Zendesk download link.
 */
const ZENDESK_DOWNLOAD_DOMAINS = [
  '.zendesk.com',
  '.zdusercontent.com',
  '.zdassets.com'
];

/**
 * Default settings.
 */
const DEFAULT_SETTINGS = {
  enabled: true,
  format: 'prefix_underscore'
};

/**
 * Format templates.
 */
const FORMAT_TEMPLATES = {
  prefix_underscore: 'ZD-{ticket}_{filename}',
  bracket: '[{ticket}] {filename}',
  minimal: '{ticket}-{filename}'
};

// ============================================================================
// SETTINGS
// ============================================================================

/**
 * Cached settings.
 */
let settings = DEFAULT_SETTINGS;

/**
 * Load settings from storage.
 */
async function loadSettings() {
  try {
    const result = await browser.storage.sync.get('settings');
    settings = result.settings || DEFAULT_SETTINGS;
  } catch (e) {
    console.debug('[Zendesk File Renamer] Could not load settings:', e);
    settings = DEFAULT_SETTINGS;
  }
}

// ============================================================================
// TICKET EXTRACTION
// ============================================================================

/**
 * Extracts ticket ID from the current page URL.
 *
 * @returns {string|null} The ticket ID or null if not found.
 */
function getCurrentTicketId() {
  const fullPath = window.location.pathname + window.location.hash;

  for (const pattern of TICKET_URL_PATTERNS) {
    const match = fullPath.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

// ============================================================================
// FILENAME FORMATTING
// ============================================================================

/**
 * Checks if a URL is a Zendesk download URL.
 *
 * @param {string} url - The URL to check.
 * @returns {boolean} True if it's a Zendesk download URL.
 */
function isZendeskDownloadUrl(url) {
  try {
    const urlObj = new URL(url);
    return ZENDESK_DOWNLOAD_DOMAINS.some(domain =>
      urlObj.hostname.endsWith(domain)
    );
  } catch {
    return false;
  }
}

/**
 * Formats a filename with the ticket ID.
 *
 * @param {string} originalFilename - The original filename.
 * @param {string} ticketId - The ticket ID.
 * @returns {string} The formatted filename.
 */
function formatFilename(originalFilename, ticketId) {
  const template = FORMAT_TEMPLATES[settings.format] || FORMAT_TEMPLATES.prefix_underscore;
  return template
    .replace('{ticket}', ticketId)
    .replace('{filename}', originalFilename);
}

/**
 * Extracts filename from a URL or download attribute.
 *
 * @param {HTMLAnchorElement} link - The anchor element.
 * @returns {string} The filename.
 */
function getFilenameFromLink(link) {
  // First check the download attribute
  if (link.download) {
    return link.download;
  }

  // Try to get filename from URL
  try {
    const url = new URL(link.href);
    const pathname = url.pathname;
    const filename = pathname.split('/').pop();
    if (filename) {
      return decodeURIComponent(filename);
    }
  } catch {
    // Ignore
  }

  // Fallback
  return 'download';
}

// ============================================================================
// LINK INTERCEPTION
// ============================================================================

/**
 * Handles click events on the document.
 *
 * Intercepts clicks on download links and modifies the filename.
 *
 * @param {MouseEvent} event - The click event.
 */
function handleClick(event) {
  // Check if extension is enabled
  if (!settings.enabled) {
    return;
  }

  // Find the clicked link (might be a child element)
  const link = event.target.closest('a[href]');
  if (!link) {
    return;
  }

  // Check if this is a Zendesk download link
  if (!isZendeskDownloadUrl(link.href)) {
    return;
  }

  // Get current ticket ID
  const ticketId = getCurrentTicketId();
  if (!ticketId) {
    console.debug('[Zendesk File Renamer] No ticket ID found, skipping rename');
    return;
  }

  // Get the original filename
  const originalFilename = getFilenameFromLink(link);

  // Check if already renamed (avoid double-renaming)
  if (originalFilename.startsWith('ZD-') ||
      originalFilename.startsWith('[') ||
      /^\d+-/.test(originalFilename)) {
    console.debug('[Zendesk File Renamer] File already renamed:', originalFilename);
    return;
  }

  // Format the new filename
  const newFilename = formatFilename(originalFilename, ticketId);

  // Set the download attribute to force the new filename
  link.download = newFilename;

  console.log('[Zendesk File Renamer] Renamed download:', {
    original: originalFilename,
    new: newFilename,
    ticketId: ticketId
  });
}

/**
 * Handles auxclick events (middle-click) on the document.
 *
 * @param {MouseEvent} event - The click event.
 */
function handleAuxClick(event) {
  // Middle click (button 1) can also trigger downloads
  if (event.button === 1) {
    handleClick(event);
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the content script.
 */
async function initialize() {
  // Load settings
  await loadSettings();

  // Listen for clicks on the document (capture phase to intercept early)
  document.addEventListener('click', handleClick, true);
  document.addEventListener('auxclick', handleAuxClick, true);

  // Listen for settings changes
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.settings) {
      settings = changes.settings.newValue || DEFAULT_SETTINGS;
      console.log('[Zendesk File Renamer] Settings updated:', settings);
    }
  });

  console.log('[Zendesk File Renamer] Firefox content script initialized', {
    ticketId: getCurrentTicketId(),
    settings: settings
  });
}

// Run initialization
initialize();
