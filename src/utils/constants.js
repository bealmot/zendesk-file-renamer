/**
 * @fileoverview Shared constants for Zendesk File Renamer extension.
 *
 * This module defines all configuration constants used across the extension.
 * Centralizing these values makes it easy to modify behavior and ensures
 * consistency between the background script, content script, and popup UI.
 *
 * @module constants
 */

// ============================================================================
// NAMING FORMAT TEMPLATES
// ============================================================================

/**
 * Available filename format templates.
 *
 * Each format uses placeholders:
 *   {ticket}   - The Zendesk ticket number (e.g., "123456")
 *   {filename} - The original filename (e.g., "debug.log")
 *
 * @constant {Object.<string, Object>}
 * @property {string} id - Unique identifier for the format
 * @property {string} label - Human-readable name for UI display
 * @property {string} template - Format string with placeholders
 * @property {string} example - Example output for UI preview
 */
export const FILENAME_FORMATS = {
  PREFIX_UNDERSCORE: {
    id: 'prefix_underscore',
    label: 'ZD-{ticket}_{filename}',
    template: 'ZD-{ticket}_{filename}',
    example: 'ZD-123456_debug.log'
  },
  BRACKET: {
    id: 'bracket',
    label: '[{ticket}] {filename}',
    template: '[{ticket}] {filename}',
    example: '[123456] debug.log'
  },
  MINIMAL: {
    id: 'minimal',
    label: '{ticket}-{filename}',
    template: '{ticket}-{filename}',
    example: '123456-debug.log'
  }
};

// ============================================================================
// DEFAULT SETTINGS
// ============================================================================

/**
 * Default extension settings.
 *
 * These values are used when:
 *   - Extension is first installed (no saved settings)
 *   - Settings are reset to defaults
 *   - Any setting is missing from storage
 *
 * @constant {Object}
 * @property {boolean} enabled - Whether file renaming is active
 * @property {string} format - ID of the active filename format
 */
export const DEFAULT_SETTINGS = {
  enabled: true,
  format: FILENAME_FORMATS.PREFIX_UNDERSCORE.id
};

// ============================================================================
// MESSAGE TYPES
// ============================================================================

/**
 * Message types for communication between extension components.
 *
 * Chrome extensions use message passing for inter-component communication.
 * Using constants prevents typos and makes refactoring easier.
 *
 * Flow:
 *   Content Script ──TICKET_UPDATE──▶ Background Script
 *   Background Script ──GET_TICKET──▶ Content Script
 *
 * @constant {Object.<string, string>}
 */
export const MESSAGE_TYPES = {
  /** Content script sends current ticket ID to background */
  TICKET_UPDATE: 'TICKET_UPDATE',

  /** Background requests current ticket ID from content script */
  GET_TICKET: 'GET_TICKET',

  /** Response containing ticket data */
  TICKET_RESPONSE: 'TICKET_RESPONSE'
};

// ============================================================================
// URL PATTERNS
// ============================================================================

/**
 * Regular expressions for extracting ticket IDs from Zendesk URLs.
 *
 * Zendesk uses several URL formats depending on the interface:
 *   - Agent interface: /agent/tickets/123456
 *   - Hash routing: #/tickets/123456
 *   - Direct links: /tickets/123456
 *
 * These patterns are tried in order until a match is found.
 *
 * @constant {RegExp[]}
 */
export const TICKET_URL_PATTERNS = [
  // Agent workspace: https://example.zendesk.com/agent/tickets/123456
  /\/agent\/tickets\/(\d+)/,

  // Hash-based routing: https://example.zendesk.com/#/tickets/123456
  /#\/tickets\/(\d+)/,

  // Direct ticket URL: https://example.zendesk.com/tickets/123456
  /\/tickets\/(\d+)/
];

// ============================================================================
// STORAGE KEYS
// ============================================================================

/**
 * Keys used for chrome.storage.sync.
 *
 * Using constants ensures consistency between read/write operations
 * and makes it easy to see all persisted data at a glance.
 *
 * @constant {Object.<string, string>}
 */
export const STORAGE_KEYS = {
  /** Main settings object key */
  SETTINGS: 'settings'
};
