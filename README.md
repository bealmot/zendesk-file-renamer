# Zendesk File Renamer

A browser extension for Chrome, Arc, and Firefox that automatically renames downloaded files from Zendesk tickets to include the ticket number. Helps support engineers organize and track log files, attachments, and other artifacts by ticket.

**Before:** `debug.log`, `attachment.pdf`, `screenshot.png`

**After:** `ZD-123456_debug.log`, `ZD-123456_attachment.pdf`, `ZD-123456_screenshot.png`

## Features

- **Automatic renaming** - Files are renamed as they download, no manual steps required
- **Multiple format options** - Choose from `ZD-{ticket}_`, `[{ticket}] `, or `{ticket}-` prefixes
- **Per-tab tracking** - Handles multiple Zendesk tabs simultaneously
- **Toggle on/off** - Easily disable when you don't need it
- **Zero configuration** - Works out of the box with sensible defaults
- **Privacy-focused** - No data collection, no external servers, all processing happens locally

## Installation

### Chrome / Arc

#### From Chrome Web Store (Recommended)

*Coming soon - pending Chrome Web Store review*

#### Manual Installation (Developer Mode)

1. Download or clone this repository:
   ```bash
   git clone https://github.com/bealmot/zendesk-file-renamer.git
   ```

2. Open Chrome/Arc and navigate to `chrome://extensions`

3. Enable **Developer mode** (toggle in top-right corner)

4. Click **Load unpacked** and select the `zendesk-file-renamer` folder (the root, not `/firefox`)

5. The extension icon should appear in your toolbar

### Firefox

#### From Firefox Add-ons (Recommended)

*Coming soon - pending Mozilla review*

#### Manual Installation (Temporary)

1. Download or clone this repository:
   ```bash
   git clone https://github.com/bealmot/zendesk-file-renamer.git
   ```

2. Open Firefox and navigate to `about:debugging`

3. Click **This Firefox** in the left sidebar

4. Click **Load Temporary Add-on**

5. Navigate to the `zendesk-file-renamer/firefox` folder and select `manifest.json`

6. The extension icon should appear in your toolbar

> **Note:** Temporary add-ons are removed when Firefox restarts. For permanent installation, wait for the Firefox Add-ons listing or package the extension as an `.xpi` file.

## Usage

1. Navigate to any Zendesk ticket (e.g., `https://company.zendesk.com/agent/tickets/123456`)

2. Download any attachment from the ticket

3. The file will automatically be renamed with the ticket number prefix

### Settings

Click the extension icon in your toolbar to access settings:

- **Enable Renaming** - Toggle the extension on/off
- **Filename Format** - Choose your preferred naming format:
  - `ZD-123456_filename.log` (default)
  - `[123456] filename.log`
  - `123456-filename.log`

## How It Works

### Chrome / Arc

```
┌─────────────────┐     message     ┌──────────────────────────┐
│ Content Script  │ ──────────────▶ │   Background Worker      │
│                 │                 │                          │
│ Extracts ticket │   ticket ID     │ Intercepts downloads     │
│ ID from URL     │   "123456"      │ and renames files        │
└─────────────────┘                 └──────────────────────────┘
```

Chrome version uses `chrome.downloads.onDeterminingFilename` to rename files *before* they're saved to disk.

### Firefox

```
┌─────────────────┐   click    ┌─────────────────┐  download  ┌──────────┐
│ Content Script  │ ─────────▶ │ Background      │ ─────────▶ │  File    │
│                 │ intercept  │ Script          │   API      │  Saved   │
│ Detects ticket  │            │                 │            │          │
│ ID from URL     │            │ Downloads with  │            │ Renamed! │
└─────────────────┘            │ custom filename │            └──────────┘
                               └─────────────────┘
```

Firefox doesn't support `onDeterminingFilename`, so we intercept download link clicks and use `browser.downloads.download()` with the renamed filename.

For technical details, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Permissions

This extension requires minimal permissions:

| Permission | Why It's Needed |
|------------|-----------------|
| `downloads` | Intercept and rename downloads |
| `storage` | Save your settings (synced across Chrome instances) |
| `activeTab` | Read the current Zendesk ticket ID |
| `*://*.zendesk.com/*` | Only runs on Zendesk pages |

**No data is collected or transmitted.** All processing happens locally in your browser.

## Compatibility

- **Chrome** 88+ (Manifest V3 support)
- **Arc** (Chromium-based, works identically to Chrome)
- **Firefox** 140+ (Manifest V2, uses click interception)
- **Edge** (Chromium-based, should work but untested)
- **Brave** (Chromium-based, should work but untested)

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Support Development

If this extension saves you time, consider supporting its development:

- [Buy Me a Coffee](https://buymeacoffee.com/bealmot)
- [GitHub Sponsors](https://github.com/sponsors/bealmot)
- Star this repository

## License

MIT License - see [LICENSE](LICENSE) for details.

## Changelog

### 1.1.0

- Added Firefox support via click interception
- Fixed timing issues with Zendesk SPA navigation
- Added support for Zendesk CDN domains (zdusercontent.com)
- Improved ticket detection with continuous URL monitoring

### 1.0.0

- Initial release
- Automatic file renaming with ticket ID prefix
- Three filename format options
- Toggle to enable/disable
- Settings sync across Chrome instances
