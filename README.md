# Youku Dual Subtitle

A Chrome extension that enhances your Youku video experience with dual subtitles and an integrated Chinese-English dictionary.

## Overview

Youku Dual Subtitle displays two subtitle tracks simultaneously on Youku videos:
- **Chinese subtitles** (Simplified or Traditional) with word segmentation
- **Second language subtitles** (English, Japanese, Korean, Spanish, Thai, Vietnamese, etc.)

The extension also features a powerful hover dictionary for Chinese characters with tone colors and pinyin, making it perfect for language learners.

## Features

### 📺 Dual Subtitle Display
- Display Chinese and a second language simultaneously
- **Additional third subtitle**: Activate one more subtitle through the native video player menu
- Draggable subtitles - position them anywhere on screen
- Adjustable font size
- Position and preferences saved automatically

### 📖 Chinese Dictionary
- Hover over any Chinese word to see definitions
- Automatic word segmentation
- Pinyin with tone marks
- **5 color schemes** for tone visualization: Pleco (default), Dummit, Sinosplice, Hanping, and MDBG. Or choose None for no coloring.
- Toggle pinyin display on/off
- Video auto-pauses during dictionary lookup

### ⚙️ Customization
- Switch between Simplified and Traditional Chinese
- Choose from the available subtitle languages in the Youku video
- **Automatic pause**: Pause video on each new subtitle for studying
- **Subtitle navigation**: Jump between dialogues efficiently
- Persistent settings across sessions
- Clean, transparent overlay design

## Installation

### From Chrome Web Store
*(Coming soon - pending publication)*

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked"
5. Select the repository's folder
6. Navigate to any Youku video (https://www.youku.tv/v/v_show/*)

## Usage

### Getting Started
1. Navigate to a Youku video (https://www.youku.tv/v/v_show/*)
2. Click the extension icon in your Chrome toolbar
3. Configure your preferences (see settings below)
4. Click the **(?)** symbol in the popup for detailed help

### Settings
1. **Select Languages**: Click the extension icon and choose:
   - Chinese variant (Simplified/Traditional)
   - Second subtitle language (English, Spanish, Japanese, Korean, etc.)
   - Tone color scheme (Pleco, Dummit, Sinosplice, Hanping, MDBG, or None)

2. **Adjust Display**: Use the popup controls to:
   - Increase/decrease font size (− and + buttons)
   - Toggle pinyin display above characters
   - Toggle automatic pause on new subtitles

3. **Position Subtitles**: Click and drag the subtitle overlay to your preferred position

4. **Additional Subtitles**: You can activate a third subtitle language through the native Youku video player menu

### Dictionary Lookup
Simply hover over any Chinese word in the subtitle to see:
- Character(s) with traditional/simplified variants
- Pinyin with tone marks
- English definitions
- Color-coded tones (colors vary by selected scheme)

**Dictionary Keyboard Shortcuts** (while hovering):
- **Alt+1**: LINE Dict
- **Alt+2**: Forvo (pronunciation)
- **Alt+3**: Dict.cn
- **Alt+4**: iCIBA
- **Alt+5**: MDBG dictionary
- **Alt+6**: Reverso
- **Alt+7**: MoeDict
- **T**: Tatoeba (example sentences)
- **G**: AllSet Learning (grammar)
- **V**: AllSet Learning (vocabulary)

### Navigation Shortcuts
- **A**: Previous subtitle
- **D**: Next subtitle
- **S**: Replay current subtitle
- **P**: Toggle automatic pause
- **Space**: Play/Pause video (standard)

## Licenses

This extension is licensed under **GNU General Public License v2.0 or later**.
See [LICENSE](LICENSE) for the full license text.

### Dictionary Attribution

**CC-CEDICT Dictionary** (`data/cedict_ts.u8`, `data/cedict.idx`):
- Licensed under Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)
- Published by MDBG - https://www.mdbg.net/chinese/dictionary?page=cc-cedict
- See [LICENSE-DICTIONARIES](LICENSE-DICTIONARIES) for details

**Grammar and Vocabulary Keywords** (`data/grammarKeywordsMin.json`, `data/vocabularyKeywordsMin.json`):
- Derived from Zhongwen Chinese-English Dictionary Extension
- Copyright (C) 2019-2023 Christian Schiller
- Licensed under GPL-2.0

### Based on Zhongwen

This extension incorporates dictionary functionality from:
- **Zhongwen Chinese-English Pop-Up Dictionary**
- Copyright (C) 2010-2023 Christian Schiller
- https://github.com/cschiller/zhongwen
- Licensed under GPL-2.0

**Attribution Chain:**
- Originally based on **Rikaikun 0.8** - Copyright (C) 2010 Erek Speed
- Originally based on **Rikaichan 1.07** - by Jonathan Zarate
- Originally based on **RikaiXUL 0.4** - by Todd Rudick

Files derived from Zhongwen: `background.js`, `dict.js`, `content.js` (dictionary features), `zhongwen-popup.css`, JSON data files

See [CREDITS.md](CREDITS.md) for complete attribution details.

## Privacy

This extension:
- ✅ Stores preferences locally only (no remote servers)
- ✅ No user tracking or analytics
- ✅ No data collection
- ✅ Works only on Youku video pages

See [privacy-policy.md](privacy-policy.md) for complete privacy policy.

## Contributing

Contributions are welcome! This project is open source under GPL-2.0-or-later.

## Support

For issues or questions:
- Check existing issues on GitHub
- File a new issue with details about your problem
- Include browser version and extension version

## Author

Copyright (C) 2025 Daniel Sangorrin

---

**Note**: This extension is not affiliated with or endorsed by Youku, Alibaba, or any related companies.
