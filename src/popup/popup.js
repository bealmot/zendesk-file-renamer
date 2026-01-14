/**
 * @fileoverview Popup UI logic for Zendesk File Renamer.
 *
 * Manages the settings interface shown when clicking the extension icon.
 * Responsibilities:
 *   - Load and display current settings
 *   - Handle user interactions (toggle, format selection)
 *   - Persist settings to chrome.storage.sync
 *   - Update UI preview when format changes
 *
 * Settings are synced across all Chrome instances where the user is logged in.
 */

// ============================================================================
// CONSTANTS (Mirrored from constants.js for popup isolation)
// ============================================================================

/**
 * Available filename formats.
 * Must match the definitions in src/utils/constants.js
 */
const FILENAME_FORMATS = {
  PREFIX_UNDERSCORE: {
    id: 'prefix_underscore',
    label: 'ZD-{ticket}_{filename}',
    template: 'ZD-{ticket}_{filename}',
    example: 'ZD-123456_attachment.log'
  },
  BRACKET: {
    id: 'bracket',
    label: '[{ticket}] {filename}',
    template: '[{ticket}] {filename}',
    example: '[123456] attachment.log'
  },
  MINIMAL: {
    id: 'minimal',
    label: '{ticket}-{filename}',
    template: '{ticket}-{filename}',
    example: '123456-attachment.log'
  }
};

/**
 * Default settings values.
 */
const DEFAULT_SETTINGS = {
  enabled: true,
  format: FILENAME_FORMATS.PREFIX_UNDERSCORE.id
};

/**
 * Storage key for settings.
 */
const STORAGE_KEY = 'settings';

// ============================================================================
// DOM ELEMENTS
// ============================================================================

/**
 * References to DOM elements.
 * Initialized in initializeElements().
 */
const elements = {
  enabledToggle: null,
  formatSelect: null,
  formatPreview: null,
  settingsContainer: null,
  statusToast: null
};

// ============================================================================
// SETTINGS MANAGEMENT
// ============================================================================

/**
 * Loads settings from chrome.storage.sync.
 *
 * @returns {Promise<Object>} The current settings, with defaults applied.
 */
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEY);
    return { ...DEFAULT_SETTINGS, ...result[STORAGE_KEY] };
  } catch (error) {
    console.error('[Popup] Failed to load settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Saves settings to chrome.storage.sync.
 *
 * @param {Object} settings - The settings object to save.
 * @returns {Promise<void>}
 */
async function saveSettings(settings) {
  try {
    await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
    showStatusToast('Settings saved');
  } catch (error) {
    console.error('[Popup] Failed to save settings:', error);
    showStatusToast('Failed to save');
  }
}

/**
 * Gets the current settings from the UI.
 *
 * @returns {Object} Settings object reflecting current UI state.
 */
function getSettingsFromUI() {
  return {
    enabled: elements.enabledToggle.checked,
    format: elements.formatSelect.value
  };
}

// ============================================================================
// UI UPDATES
// ============================================================================

/**
 * Updates the UI to reflect the given settings.
 *
 * @param {Object} settings - Settings to apply to UI.
 */
function updateUI(settings) {
  // Update toggle
  elements.enabledToggle.checked = settings.enabled;

  // Update format select
  elements.formatSelect.value = settings.format;

  // Update preview
  updateFormatPreview(settings.format);

  // Update disabled state
  updateDisabledState(settings.enabled);
}

/**
 * Updates the format preview text.
 *
 * @param {string} formatId - The format ID to preview.
 */
function updateFormatPreview(formatId) {
  const format = Object.values(FILENAME_FORMATS).find(f => f.id === formatId);
  const example = format ? format.example : FILENAME_FORMATS.PREFIX_UNDERSCORE.example;
  elements.formatPreview.textContent = example;
}

/**
 * Updates the disabled visual state of secondary settings.
 *
 * When the extension is disabled, the format selector is dimmed
 * to indicate it has no effect.
 *
 * @param {boolean} enabled - Whether the extension is enabled.
 */
function updateDisabledState(enabled) {
  if (enabled) {
    elements.settingsContainer.classList.remove('disabled');
  } else {
    elements.settingsContainer.classList.add('disabled');
  }
}

/**
 * Shows a brief status toast notification.
 *
 * @param {string} message - The message to display.
 */
function showStatusToast(message) {
  elements.statusToast.textContent = message;
  elements.statusToast.classList.remove('hidden');

  // Auto-hide after 1.5 seconds
  setTimeout(() => {
    elements.statusToast.classList.add('hidden');
  }, 1500);
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Handles the enabled toggle change.
 *
 * Saves the new state and updates UI accordingly.
 */
async function handleToggleChange() {
  const settings = getSettingsFromUI();
  updateDisabledState(settings.enabled);
  await saveSettings(settings);
}

/**
 * Handles format selection change.
 *
 * Updates the preview and saves the new format.
 */
async function handleFormatChange() {
  const settings = getSettingsFromUI();
  updateFormatPreview(settings.format);
  await saveSettings(settings);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initializes DOM element references.
 *
 * Called once when the popup loads. Caches element references
 * to avoid repeated DOM queries.
 */
function initializeElements() {
  elements.enabledToggle = document.getElementById('enabled-toggle');
  elements.formatSelect = document.getElementById('format-select');
  elements.formatPreview = document.getElementById('format-preview-text');
  elements.settingsContainer = document.querySelector('.settings');
  elements.statusToast = document.getElementById('status-toast');
}

/**
 * Populates the format select dropdown with options.
 *
 * Creates an option element for each available format,
 * using the format's label as the display text.
 *
 * Uses safe DOM methods to avoid XSS vulnerabilities.
 */
function populateFormatOptions() {
  const select = elements.formatSelect;

  // Clear existing options using safe DOM method
  while (select.firstChild) {
    select.removeChild(select.firstChild);
  }

  // Add an option for each format using safe DOM creation
  for (const format of Object.values(FILENAME_FORMATS)) {
    const option = document.createElement('option');
    option.value = format.id;
    // Use textContent for safe text assignment (no XSS risk)
    option.textContent = format.label;
    select.appendChild(option);
  }
}

/**
 * Sets up event listeners for UI interactions.
 */
function setupEventListeners() {
  elements.enabledToggle.addEventListener('change', handleToggleChange);
  elements.formatSelect.addEventListener('change', handleFormatChange);
}

/**
 * Main initialization function.
 *
 * Called when the popup DOM is ready. Sets up the UI
 * and loads saved settings.
 */
async function initialize() {
  // Initialize DOM references
  initializeElements();

  // Populate format dropdown
  populateFormatOptions();

  // Set up event listeners
  setupEventListeners();

  // Load and apply saved settings
  const settings = await loadSettings();
  updateUI(settings);

  console.log('[Popup] Initialized with settings:', settings);
}

// ============================================================================
// ENTRY POINT
// ============================================================================

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initialize);
