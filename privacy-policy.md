# Privacy Policy for Youku Dual Subtitle

**Effective Date:** December 23, 2025
**Last Updated:** December 23, 2025

## Overview

Youku Dual Subtitle ("we", "our", or "the extension") is committed to protecting your privacy. This privacy policy explains what data our extension collects, how we use it, and your rights regarding your data.

## Data Collection

### Data We Collect Locally

Our extension stores the following data **locally on your device only** using Chrome's storage API and localStorage:

1. **User Preferences (chrome.storage.local):**
   - `subtitleFontSize`: Font size for subtitle display (10-40px, default: 36px)
   - `showPinyin`: Whether to show pinyin annotations (true/false, default: true)
   - `toneColorScheme`: Color scheme for tone marks (pleco/dummit/sinosplice/hanping/mdbg, default: pleco)
   - `chineseVariant`: Chinese character variant preference (simplified/traditional, default: simplified)
   - `secondSubtitleCode`: Selected second subtitle language code (default: 'en')
   - `autoPauseEnabled`: Whether to automatically pause on new subtitles (true/false, default: false)

2. **User Preferences (localStorage - synced from chrome.storage.local):**
   - `youku-dual-subtitle-fontsize`: Font size setting
   - `youku-dual-subtitle-pinyin`: Pinyin display setting
   - `youku-dual-subtitle-tone-colors`: Tone color scheme
   - `youku-dual-subtitle-chinese-variant`: Chinese variant setting
   - `youku-dual-subtitle-second-language`: Second subtitle language preference
   - `youku-dual-subtitle-auto-pause`: Automatic pause setting
   - `youku-dual-subtitle-position`: Subtitle position coordinates (JSON: {x, y} percentages)
   - `youku-dual-subtitle-position-user-set`: Whether position was manually set by user (true/false)

3. **Session Data (Memory Cache - not persisted):**
   - Cached subtitle content during video playback (cleared on page reload)
   - Word segmentation cache for performance optimization (cleared on page reload)

### Data We Do NOT Collect

- We do **NOT** collect any personal information
- We do **NOT** track your browsing history
- We do **NOT** collect information about videos you watch
- We do **NOT** send any data to external servers
- We do **NOT** use cookies or analytics services
- We do **NOT** share, sell, or transmit your data to third parties

## How We Use Data

All data collected is used solely to:
1. Remember your subtitle preferences across browsing sessions
2. Optimize performance by caching subtitle and segmentation data
3. Provide the dictionary and word segmentation features

## Data Storage

All data is stored locally on your device using:
- **chrome.storage.local**: For settings and preferences
- **localStorage**: For main-world content script access to settings

Your data never leaves your device.

## Third-Party Services

This extension does **NOT** use any third-party services, analytics, or tracking tools.

## Permissions Explanation

Our extension requests the following permissions:

1. **storage**: To save your preferences locally on your device
2. **Host permissions for youku.tv and v.youku.com**: To display subtitles and provide dictionary features on Youku video pages only

These permissions are used exclusively for the stated functionality and nothing else.

## Data Access

Only you have access to your stored preferences. The extension cannot and does not transmit any data externally.

## Data Deletion

You can delete all data stored by the extension at any time by:
1. Uninstalling the extension (removes all stored data automatically)
2. Manually clearing browser data through Chrome settings
3. Using the extension popup to reset preferences

## Dictionary Data

The extension includes an offline Chinese-English dictionary (CC-CEDICT) that is bundled with the extension and used entirely locally. No external dictionary API calls are made.

## Children's Privacy

This extension does not knowingly collect any information from children under 13. The extension is designed to enhance language learning and does not require or request any personal information.

## Changes to This Policy

We may update this privacy policy from time to time. Any changes will be reflected in the extension's listing on the Chrome Web Store and in the updated extension version.

## Contact Information

If you have questions about this privacy policy or the extension's data practices, please:
- Open an issue on the extension's GitHub repository
- Contact via the Chrome Web Store support tab

## Your Rights

You have the right to:
- Access your stored preferences (visible in Chrome's developer tools)
- Delete all stored data (uninstall extension or clear browser data)
- Opt out of data storage (do not use the extension)

## Legal Compliance

This extension complies with:
- Chrome Web Store Developer Program Policies
- General Data Protection Regulation (GDPR)
- California Consumer Privacy Act (CCPA)
- Other applicable privacy laws

## Data Retention

- Preferences: Retained until you change them or uninstall the extension
- Session cache: Cleared when you close the browser or navigate away from video pages

## Security

All data is stored securely using Chrome's built-in storage APIs. Since no data is transmitted externally, there is no risk of data interception or unauthorized access.

---

**Summary:** This extension stores only your preferences locally on your device to enhance your viewing experience. No personal information is collected, no data is transmitted externally, and you maintain complete control over your data.
