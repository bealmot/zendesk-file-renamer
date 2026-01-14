/**
 * @fileoverview Content script for Zendesk File Renamer.
 *
 * This script runs in the context of Zendesk web pages. Its responsibilities:
 *   1. Extract the ticket ID from the current page URL
 *   2. Notify the background script when the ticket changes
 *   3. Respond to ticket ID requests from the background script
 *
 * Content scripts have access to the page's DOM but run in an isolated
 * execution context. They communicate with other extension components
 * via Chrome's message passing API.
 *
 * @see https://developer.chrome.com/docs/extensions/mv3/content_scripts/
 */

// ============================================================================
// CONSTANTS (Inlined to avoid module loading complexity in content scripts)
// ============================================================================

/**
 * Message types for extension communication.
 * Must match values in src/utils/constants.js
 */
const MESSAGE_TYPES = {
  TICKET_UPDATE: 'TICKET_UPDATE',
  GET_TICKET: 'GET_TICKET',
  TICKET_RESPONSE: 'TICKET_RESPONSE'
};

/**
 * URL patterns for extracting Zendesk ticket IDs.
 * Patterns are tried in order; first match wins.
 */
const TICKET_URL_PATTERNS = [
  /\/agent\/tickets\/(\d+)/,   // Agent workspace
  /#\/tickets\/(\d+)/,          // Hash-based routing
  /\/tickets\/(\d+)/            // Direct ticket URL
];

// ============================================================================
// STATE
// ============================================================================

/**
 * Cache of the last known ticket ID.
 * Used to avoid sending duplicate updates to the background script.
 * @type {string|null}
 */
let lastKnownTicketId = null;

// ============================================================================
// TICKET ID EXTRACTION
// ============================================================================

/**
 * Extracts the ticket ID from the current page URL.
 *
 * Zendesk uses several URL formats across their different interfaces.
 * This function tries multiple patterns to handle all cases:
 *
 *   Agent workspace:  /agent/tickets/123456
 *   Hash routing:     #/tickets/123456
 *   Direct link:      /tickets/123456
 *
 * @returns {string|null} The ticket ID if found, null otherwise.
 *
 * @example
 * // URL: https://company.zendesk.com/agent/tickets/123456
 * extractTicketIdFromUrl(); // Returns "123456"
 *
 * @example
 * // URL: https://company.zendesk.com/agent/dashboard
 * extractTicketIdFromUrl(); // Returns null
 */
function extractTicketIdFromUrl() {
  // Combine pathname and hash to handle both standard and hash-based routing
  const fullPath = window.location.pathname + window.location.hash;

  // Try each pattern until we find a match
  for (const pattern of TICKET_URL_PATTERNS) {
    const match = fullPath.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Attempts to extract ticket ID from the page DOM as a fallback.
 *
 * This is a backup method for cases where URL parsing fails.
 * Zendesk's UI may change, so this is less reliable than URL parsing.
 *
 * Currently checks:
 *   - data-ticket-id attributes
 *   - Ticket number display elements
 *
 * @returns {string|null} The ticket ID if found in DOM, null otherwise.
 */
function extractTicketIdFromDom() {
  // Try data attribute (some Zendesk versions use this)
  const ticketElement = document.querySelector('[data-ticket-id]');
  if (ticketElement) {
    return ticketElement.getAttribute('data-ticket-id');
  }

  // Try ticket number display (visible in ticket header)
  // Format is typically "#123456" or "Ticket #123456"
  const ticketHeader = document.querySelector('[data-test-id="ticket-pane-header"]');
  if (ticketHeader) {
    const match = ticketHeader.textContent.match(/#(\d+)/);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Gets the current ticket ID using all available methods.
 *
 * Priority order:
 *   1. URL parsing (most reliable)
 *   2. DOM extraction (fallback)
 *
 * @returns {string|null} The ticket ID if found, null otherwise.
 */
function getCurrentTicketId() {
  // URL parsing is preferred - it's fast and doesn't depend on DOM state
  const urlTicketId = extractTicketIdFromUrl();
  if (urlTicketId) {
    return urlTicketId;
  }

  // Fall back to DOM extraction if URL doesn't contain ticket ID
  return extractTicketIdFromDom();
}

// ============================================================================
// BACKGROUND SCRIPT COMMUNICATION
// ============================================================================

/**
 * Sends the current ticket ID to the background script.
 *
 * The background script maintains a mapping of tab IDs to ticket IDs.
 * When a download is initiated, it uses this mapping to determine
 * which ticket ID to prepend to the filename.
 *
 * This function is called:
 *   - When the page first loads
 *   - When URL changes (via history API or hash changes)
 *   - When the background script requests the current ticket
 *
 * @param {string|null} ticketId - The ticket ID to send, or null if none.
 */
function notifyBackgroundOfTicket(ticketId) {
  // Don't send duplicate updates
  if (ticketId === lastKnownTicketId) {
    return;
  }

  lastKnownTicketId = ticketId;

  // Send message to background script
  // Using chrome.runtime.sendMessage for one-time messages
  chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.TICKET_UPDATE,
    ticketId: ticketId
  }).catch(() => {
    // Ignore errors - background script may not be ready yet
    // This is expected during extension initialization
  });
}

/**
 * Handles incoming messages from other extension components.
 *
 * Currently handles:
 *   - GET_TICKET: Background script requesting current ticket ID
 *
 * @param {Object} message - The message object.
 * @param {Object} sender - Information about the message sender.
 * @param {Function} sendResponse - Callback to send a response.
 * @returns {boolean} True if response will be sent asynchronously.
 */
function handleMessage(message, sender, sendResponse) {
  if (message.type === MESSAGE_TYPES.GET_TICKET) {
    const ticketId = getCurrentTicketId();
    sendResponse({
      type: MESSAGE_TYPES.TICKET_RESPONSE,
      ticketId: ticketId
    });
  }

  // Return false for synchronous response
  return false;
}

// ============================================================================
// URL CHANGE DETECTION
// ============================================================================

/**
 * Monitors URL changes and updates the background script.
 *
 * Zendesk is a single-page application (SPA) that uses the History API
 * for navigation. This means the page doesn't reload when switching
 * between tickets. We need to detect these URL changes and update
 * the background script accordingly.
 *
 * This function sets up monitoring for:
 *   - pushState/replaceState calls (History API)
 *   - hashchange events (for hash-based routing)
 *   - popstate events (browser back/forward)
 */
function setupUrlChangeDetection() {
  // Store the original history methods
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  // Wrap pushState to detect navigation
  history.pushState = function(...args) {
    originalPushState.apply(this, args);
    checkForTicketChange();
  };

  // Wrap replaceState to detect navigation
  history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    checkForTicketChange();
  };

  // Listen for browser back/forward navigation
  window.addEventListener('popstate', checkForTicketChange);

  // Listen for hash changes (some Zendesk versions use hash routing)
  window.addEventListener('hashchange', checkForTicketChange);
}

/**
 * Checks if the ticket ID has changed and notifies the background script.
 *
 * This is called whenever URL changes are detected. It extracts the
 * current ticket ID and sends it to the background script if it
 * differs from the last known value.
 */
function checkForTicketChange() {
  const ticketId = getCurrentTicketId();
  notifyBackgroundOfTicket(ticketId);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initializes the content script.
 *
 * Executed when the content script is injected into the page.
 * Sets up message listeners, URL change detection, and sends
 * the initial ticket ID to the background script.
 */
function initialize() {
  // Set up message listener for background script requests
  chrome.runtime.onMessage.addListener(handleMessage);

  // Set up URL change detection for SPA navigation
  setupUrlChangeDetection();

  // Send initial ticket ID to background script
  const initialTicketId = getCurrentTicketId();
  notifyBackgroundOfTicket(initialTicketId);

  // Log initialization for debugging (visible in page console)
  console.log('[Zendesk File Renamer] Content script initialized', {
    ticketId: initialTicketId
  });

  // Zendesk is an SPA - the URL might not be ready on first load.
  // Poll briefly to catch late URL updates.
  let pollCount = 0;
  const pollInterval = setInterval(() => {
    pollCount++;
    const ticketId = getCurrentTicketId();
    if (ticketId && ticketId !== lastKnownTicketId) {
      console.log('[Zendesk File Renamer] Detected ticket via polling:', ticketId);
      notifyBackgroundOfTicket(ticketId);
    }
    // Stop polling after 5 seconds
    if (pollCount >= 10) {
      clearInterval(pollInterval);
    }
  }, 500);
}

// Run initialization
initialize();
