/**
 * @fileoverview Firefox popup UI logic for Zendesk File Renamer.
 *
 * Same as Chrome version but uses 'browser' namespace.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Available filename formats.
 * IMPORTANT: Must match the definitions in Chrome src/utils/constants.js
 * If updating these values, also update constants.js to keep them in sync.
 */
const FILENAME_FORMATS = {
  PREFIX_UNDERSCORE: {
    id: 'prefix_underscore',
    label: 'ZD-{ticket}_{filename}',
    example: 'ZD-123456_debug.log'
  },
  BRACKET: {
    id: 'bracket',
    label: '[{ticket}] {filename}',
    example: '[123456] debug.log'
  },
  MINIMAL: {
    id: 'minimal',
    label: '{ticket}-{filename}',
    example: '123456-debug.log'
  }
};

const DEFAULT_SETTINGS = {
  enabled: true,
  format: FILENAME_FORMATS.PREFIX_UNDERSCORE.id
};

const STORAGE_KEY = 'settings';

// ============================================================================
// DOM ELEMENTS
// ============================================================================

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

async function loadSettings() {
  try {
    const result = await browser.storage.sync.get(STORAGE_KEY);
    return { ...DEFAULT_SETTINGS, ...result[STORAGE_KEY] };
  } catch (error) {
    console.error('[Popup] Failed to load settings:', error);
    // Show user-friendly error message
    showStatusToast('Could not load settings', true);
    return DEFAULT_SETTINGS;
  }
}

async function saveSettings(settings) {
  try {
    await browser.storage.sync.set({ [STORAGE_KEY]: settings });
    showStatusToast('Settings saved');
  } catch (error) {
    console.error('[Popup] Failed to save settings:', error);
    showStatusToast('Failed to save settings', true);
  }
}

function getSettingsFromUI() {
  return {
    enabled: elements.enabledToggle.checked,
    format: elements.formatSelect.value
  };
}

// ============================================================================
// UI UPDATES
// ============================================================================

function updateUI(settings) {
  elements.enabledToggle.checked = settings.enabled;
  elements.formatSelect.value = settings.format;
  updateFormatPreview(settings.format);
  updateDisabledState(settings.enabled);
}

function updateFormatPreview(formatId) {
  const format = Object.values(FILENAME_FORMATS).find(f => f.id === formatId);
  const example = format ? format.example : FILENAME_FORMATS.PREFIX_UNDERSCORE.example;
  elements.formatPreview.textContent = example;
}

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
 * @param {boolean} isError - Whether this is an error message (affects styling).
 */
function showStatusToast(message, isError = false) {
  elements.statusToast.textContent = message;
  elements.statusToast.classList.remove('hidden');

  // Toggle error styling
  if (isError) {
    elements.statusToast.classList.add('error');
  } else {
    elements.statusToast.classList.remove('error');
  }

  // Auto-hide after 1.5 seconds (longer for errors)
  setTimeout(() => {
    elements.statusToast.classList.add('hidden');
    elements.statusToast.classList.remove('error');
  }, isError ? 3000 : 1500);
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

async function handleToggleChange() {
  const settings = getSettingsFromUI();
  updateDisabledState(settings.enabled);
  await saveSettings(settings);
}

async function handleFormatChange() {
  const settings = getSettingsFromUI();
  updateFormatPreview(settings.format);
  await saveSettings(settings);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function initializeElements() {
  elements.enabledToggle = document.getElementById('enabled-toggle');
  elements.formatSelect = document.getElementById('format-select');
  elements.formatPreview = document.getElementById('format-preview-text');
  elements.settingsContainer = document.querySelector('.settings');
  elements.statusToast = document.getElementById('status-toast');
}

function populateFormatOptions() {
  const select = elements.formatSelect;

  while (select.firstChild) {
    select.removeChild(select.firstChild);
  }

  for (const format of Object.values(FILENAME_FORMATS)) {
    const option = document.createElement('option');
    option.value = format.id;
    option.textContent = format.label;
    select.appendChild(option);
  }
}

function setupEventListeners() {
  elements.enabledToggle.addEventListener('change', handleToggleChange);
  elements.formatSelect.addEventListener('change', handleFormatChange);
}

async function initialize() {
  initializeElements();
  populateFormatOptions();
  setupEventListeners();

  const settings = await loadSettings();
  updateUI(settings);

  console.log('[Popup] Firefox popup initialized with settings:', settings);
}

document.addEventListener('DOMContentLoaded', initialize);
