# Zendesk File Renamer

A Chrome/Arc browser extension that automatically renames downloaded files from Zendesk tickets to include the ticket number. Helps support engineers organize and track log files, attachments, and other artifacts by ticket.

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

### From Chrome Web Store (Recommended)

*Coming soon - pending Chrome Web Store review*

### Manual Installation (Developer Mode)

1. Download or clone this repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/zendesk-file-renamer.git
   ```

2. Open Chrome/Arc and navigate to `chrome://extensions`

3. Enable **Developer mode** (toggle in top-right corner)

4. Click **Load unpacked** and select the `zendesk-file-renamer` folder

5. The extension icon should appear in your toolbar

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

```
┌─────────────────┐     message     ┌──────────────────────────┐
│ Content Script  │ ──────────────▶ │   Background Worker      │
│                 │                 │                          │
│ Extracts ticket │   ticket ID     │ Intercepts downloads     │
│ ID from URL     │   "123456"      │ and renames files        │
└─────────────────┘                 └──────────────────────────┘
```

The extension uses Chrome's official download API (`chrome.downloads.onDeterminingFilename`) to rename files *before* they're saved to disk. No file manipulation happens after download.

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
- **Edge** (Chromium-based, should work but untested)
- **Brave** (Chromium-based, should work but untested)

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Support Development

If this extension saves you time, consider supporting its development:

- [Buy Me a Coffee](https://buymeacoffee.com/YOUR_USERNAME)
- [GitHub Sponsors](https://github.com/sponsors/YOUR_USERNAME)
- Star this repository

## License

MIT License - see [LICENSE](LICENSE) for details.

## Changelog

### 1.0.0

- Initial release
- Automatic file renaming with ticket ID prefix
- Three filename format options
- Toggle to enable/disable
- Settings sync across Chrome instances
