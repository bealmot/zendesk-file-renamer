# Architecture Documentation

This document provides a technical deep-dive into the Zendesk File Renamer extension for developers and contributors.

## Table of Contents

1. [Overview](#overview)
2. [Component Architecture](#component-architecture)
3. [Data Flow](#data-flow)
4. [File Structure](#file-structure)
5. [Key APIs](#key-apis)
6. [State Management](#state-management)
7. [Security Considerations](#security-considerations)
8. [Testing](#testing)
9. [Known Limitations](#known-limitations)

---

## Overview

Zendesk File Renamer is a Manifest V3 Chrome extension that intercepts file downloads originating from Zendesk pages and prepends the ticket number to the filename.

### Design Principles

1. **Minimal permissions** - Request only what's needed
2. **No external dependencies** - Pure vanilla JavaScript
3. **Graceful degradation** - If ticket ID unknown, preserve original filename
4. **Privacy by design** - No data leaves the browser

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           BROWSER CONTEXT                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    EXTENSION CONTEXT                             │    │
│  │                                                                  │    │
│  │  ┌──────────────┐        ┌──────────────────────────────────┐   │    │
│  │  │   Popup UI   │◀──────▶│     chrome.storage.sync          │   │    │
│  │  │  popup.html  │  sync  │                                  │   │    │
│  │  │  popup.js    │        │  { settings: {                   │   │    │
│  │  │  popup.css   │        │      enabled: true,              │   │    │
│  │  └──────────────┘        │      format: 'prefix_underscore' │   │    │
│  │                          │  }}                              │   │    │
│  │                          └──────────────────────────────────┘   │    │
│  │                                       ▲                         │    │
│  │                                       │ reads                   │    │
│  │                                       │                         │    │
│  │  ┌──────────────────────────────────────────────────────────┐   │    │
│  │  │              Background Service Worker                    │   │    │
│  │  │                   background.js                           │   │    │
│  │  │                                                           │   │    │
│  │  │  ┌─────────────────┐    ┌─────────────────────────────┐  │   │    │
│  │  │  │ tabTicketMap    │    │ chrome.downloads            │  │   │    │
│  │  │  │ Map<tabId,      │    │ .onDeterminingFilename      │  │   │    │
│  │  │  │     ticketId>   │    │                             │  │   │    │
│  │  │  └─────────────────┘    └─────────────────────────────┘  │   │    │
│  │  │           ▲                                               │   │    │
│  │  └───────────│───────────────────────────────────────────────┘   │    │
│  │              │ message                                           │    │
│  │              │ TICKET_UPDATE                                     │    │
│  │              │                                                   │    │
│  └──────────────│───────────────────────────────────────────────────┘    │
│                 │                                                         │
│  ┌──────────────│───────────────────────────────────────────────────┐    │
│  │              │              PAGE CONTEXT                          │    │
│  │              │         (zendesk.com domain)                       │    │
│  │              │                                                    │    │
│  │  ┌──────────────────────────────────────────────────────────┐    │    │
│  │  │                   Content Script                          │    │    │
│  │  │                     content.js                            │    │    │
│  │  │                                                           │    │    │
│  │  │  • Extracts ticket ID from URL                           │    │    │
│  │  │  • Monitors URL changes (SPA navigation)                 │    │    │
│  │  │  • Sends updates to background script                    │    │    │
│  │  │                                                           │    │    │
│  │  └──────────────────────────────────────────────────────────┘    │    │
│  │                                                                   │    │
│  └───────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Components

| Component | File | Responsibility |
|-----------|------|----------------|
| **Content Script** | `src/content.js` | Extracts ticket ID from Zendesk pages |
| **Service Worker** | `src/background.js` | Intercepts downloads, renames files |
| **Popup UI** | `src/popup/*` | User settings interface |
| **Constants** | `src/utils/constants.js` | Shared configuration |

---

## Data Flow

### Download Renaming Flow

```
1. User navigates to Zendesk ticket
   │
   ▼
2. Content script extracts ticket ID from URL
   URL: https://company.zendesk.com/agent/tickets/123456
   Extracted: "123456"
   │
   ▼
3. Content script sends TICKET_UPDATE message to background
   { type: 'TICKET_UPDATE', ticketId: '123456' }
   │
   ▼
4. Background stores ticket ID in tabTicketMap
   tabTicketMap.set(tabId, '123456')
   │
   ▼
5. User clicks download on an attachment
   │
   ▼
6. Chrome fires onDeterminingFilename event
   downloadItem: { filename: 'debug.log', tabId: 123, ... }
   │
   ▼
7. Background looks up ticket ID for tab
   ticketId = tabTicketMap.get(123) // '123456'
   │
   ▼
8. Background applies format template
   'ZD-{ticket}_{filename}' → 'ZD-123456_debug.log'
   │
   ▼
9. Background suggests new filename
   suggest({ filename: 'ZD-123456_debug.log' })
   │
   ▼
10. Chrome saves file with new name
```

### Settings Flow

```
1. User opens popup
   │
   ▼
2. popup.js loads settings from chrome.storage.sync
   │
   ▼
3. User changes setting (e.g., format)
   │
   ▼
4. popup.js saves to chrome.storage.sync
   │
   ▼
5. Next download, background.js reads current settings
```

---

## File Structure

```
zendesk-file-renamer/
├── manifest.json              # Extension manifest (entry point)
│
├── src/
│   ├── background.js          # Service worker
│   │   ├── tabTicketMap       # In-memory state
│   │   ├── handleDownloadFilename()
│   │   └── handleMessage()
│   │
│   ├── content.js             # Content script
│   │   ├── extractTicketIdFromUrl()
│   │   ├── setupUrlChangeDetection()
│   │   └── notifyBackgroundOfTicket()
│   │
│   ├── popup/
│   │   ├── popup.html         # Settings UI structure
│   │   ├── popup.css          # Styles
│   │   └── popup.js           # Settings logic
│   │
│   └── utils/
│       └── constants.js       # Shared constants
│
├── icons/                     # Extension icons
│
└── docs/
    ├── README.md
    ├── ARCHITECTURE.md        # This file
    └── CONTRIBUTING.md
```

---

## Key APIs

### chrome.downloads.onDeterminingFilename

The core API that enables filename modification. Called when a download is about to begin.

```javascript
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  // downloadItem contains:
  // - filename: suggested filename
  // - url: download URL
  // - referrer: page that initiated download
  // - tabId: tab ID (-1 if not from a tab)

  // Must call suggest() exactly once:
  suggest({ filename: 'new-name.txt' });  // Rename
  // or
  suggest();  // Keep original
});
```

**Important:** Return `true` from the listener to indicate async handling.

### chrome.storage.sync

Settings persistence with cross-device sync.

```javascript
// Save
await chrome.storage.sync.set({ settings: { enabled: true } });

// Load
const result = await chrome.storage.sync.get('settings');
```

### chrome.runtime.sendMessage / onMessage

Inter-component messaging.

```javascript
// Send (from content script)
chrome.runtime.sendMessage({ type: 'TICKET_UPDATE', ticketId: '123' });

// Receive (in service worker)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // sender.tab.id gives the tab ID
});
```

---

## State Management

### In-Memory State (Service Worker)

```javascript
const tabTicketMap = new Map();
// Key: Chrome tab ID (number)
// Value: Zendesk ticket ID (string)
```

**Lifecycle considerations:**
- Service workers can be terminated when idle
- State is lost on termination
- Content scripts re-send ticket IDs when worker restarts
- No explicit state restoration needed

### Persistent State (chrome.storage.sync)

```javascript
{
  settings: {
    enabled: boolean,  // Is renaming active?
    format: string     // Format ID ('prefix_underscore', 'bracket', 'minimal')
  }
}
```

---

## Security Considerations

### Input Validation

- Ticket IDs are validated as numeric strings (`\d+`)
- Filenames are never executed, only used in download paths
- No user input is ever used in `innerHTML` or similar APIs

### Permissions Minimization

- `downloads` - Required for core functionality
- `storage` - Required for settings
- `activeTab` - Limited to user-activated tabs
- Host permission limited to `*.zendesk.com`

### No External Communication

- No analytics
- No telemetry
- No external API calls
- All processing is local

---

## Testing

### Manual Testing Checklist

1. **Basic renaming**
   - [ ] Navigate to Zendesk ticket
   - [ ] Download attachment
   - [ ] Verify filename includes ticket number

2. **Multiple tabs**
   - [ ] Open two different tickets in separate tabs
   - [ ] Download from each tab
   - [ ] Verify each file has correct ticket number

3. **Settings**
   - [ ] Disable extension, verify downloads unchanged
   - [ ] Change format, verify new format applied
   - [ ] Close and reopen browser, verify settings persist

4. **Edge cases**
   - [ ] Download from non-ticket Zendesk page (should not rename)
   - [ ] Download file that already has ticket prefix (should not double-rename)
   - [ ] Navigate away from ticket, then download (should not rename)

### Automated Testing (Future)

Consider adding:
- Unit tests for filename formatting functions
- Integration tests with Puppeteer/Playwright
- E2E tests simulating Zendesk pages

---

## Known Limitations

1. **Service worker state loss**
   - Ticket ID may be unknown briefly after worker restart
   - Mitigated by content script re-sending on worker request

2. **Downloads not from tabs**
   - Downloads with `tabId: -1` cannot be associated with a ticket
   - These are left unchanged

3. **Zendesk URL changes**
   - If Zendesk changes their URL structure, patterns need updating
   - URL patterns are centralized in `constants.js` for easy updates

4. **No Firefox support**
   - Manifest V3 service workers are Chrome-specific
   - Firefox uses different event page model

---

## Future Enhancements

Potential improvements for future versions:

- [ ] Custom format string input
- [ ] Filename sanitization options
- [ ] Download history log
- [ ] Bulk rename existing files
- [ ] Firefox/Safari support
- [ ] Keyboard shortcuts
