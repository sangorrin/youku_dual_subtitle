// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2025 Daniel Sangorrin
//
// Youku Dual Subtitle - Content Script
// Main subtitle display, word segmentation, and dictionary popup functionality
//
// ---
//
// Dictionary popup and word segmentation features derived from:
// Zhongwen Chinese-English Pop-Up Dictionary
// Copyright (C) 2010-2023 Christian Schiller
// https://github.com/cschiller/zhongwen
//
// Originally based on Rikaikun 0.8
// Copyright (C) 2010 Erek Speed
// http://code.google.com/p/rikaikun/
//
// Originally based on Rikaichan 1.07
// by Jonathan Zarate
// http://www.polarcloud.com/
//
// Originally based on RikaiXUL 0.4 by Todd Rudick
// http://www.rikai.com/
// http://rikaixul.mozdev.org/

(function() {
  'use strict';


  // State
  let overlayContainer = null; // Container for both overlays
  let chineseOverlay = null; // Top overlay (Chinese with word segmentation)
  let secondOverlay = null; // Bottom overlay (user-selected language)
  let subtitleCache = new Map(); // Map<languageCode, parsedDialogues>
  let segmentationCache = new Map(); // Map<text, segments> for word segmentation
  let availableSubtitles = []; // Array of subtitle metadata
  let scrapedLanguageLabels = {}; // Map of code -> English label from player
  let currentLanguages = { chinese: 'chs', second: 'en' }; // Default: Simplified Chinese + English
  let currentDialogues = { chinese: null, second: null };
  let lastDisplayedText = { chinese: null, second: null };
  let fontSize = 36; // Default font size in pixels
  let pendingDictionaryRequests = new Map(); // Map<requestId, callback>
  let videoElement = null; // Reference to video element for pause/play
  let showPinyin = true; // Show pinyin in dictionary popup (default: enabled)
  let wasPlayingBeforeHover = false; // Track video play state
  let toneColorScheme = 'pleco'; // Color scheme for tones (default: Pleco)
  let chineseVariant = 'simplified'; // Chinese variant preference: 'simplified' or 'traditional'
  let autoPauseEnabled = false; // Automatic pause on new subtitle (default: disabled)
  let lastPausedSubtitle = null; // Track last subtitle that triggered auto-pause
  let currentDictionaryEntry = null; // Current dictionary entry for keyboard shortcuts
  let currentDictionaryWord = null; // Current word being displayed in popup

  // Dragging state
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let overlayPosition = { x: 50, y: 15 }; // Default position (percentages, from bottom)
  let isPositionUserSet = false; // Track if user manually positioned subtitles
  let videoContainerResizeObserver = null; // Observer for video container size changes
  let currentVideoContainer = null; // Reference to current video container

  // Create subtitle overlays (dual system)
  function createOverlay() {
    // Request initial settings sync from chrome.storage.local to localStorage
    window.postMessage({
      source: 'youku-dual-subtitle-main',
      action: 'syncSettingsFromChromeStorage'
    }, '*');

    // Load saved font size
    try {
      const savedSize = localStorage.getItem('youku-dual-subtitle-fontsize');
      if (savedSize) {
        fontSize = parseInt(savedSize);
      }
    } catch (e) {
    }

    // Load pinyin setting
    try {
      const savedPinyin = localStorage.getItem('youku-dual-subtitle-pinyin');
      if (savedPinyin !== null) {
        showPinyin = savedPinyin === 'true';
      }
    } catch (e) {
    }

    // Load tone color scheme
    try {
      const savedScheme = localStorage.getItem('youku-dual-subtitle-tone-colors');
      if (savedScheme) {
        toneColorScheme = savedScheme;
      }
    } catch (e) {
    }

    // Load Chinese variant preference
    try {
      const savedVariant = localStorage.getItem('youku-dual-subtitle-chinese-variant');
      if (savedVariant) {
        chineseVariant = savedVariant;
      }
    } catch (e) {
    }

    // Load automatic pause setting
    try {
      const savedAutoPause = localStorage.getItem('youku-dual-subtitle-auto-pause');
      if (savedAutoPause !== null) {
        autoPauseEnabled = savedAutoPause === 'true';
      }
    } catch (e) {
    }

    // Inject CSS for ruby tags (pinyin above Chinese characters)
    if (!document.getElementById('youku-dual-subtitle-ruby-styles')) {
      const style = document.createElement('style');
      style.id = 'youku-dual-subtitle-ruby-styles';
      style.textContent = `
        #youku-dual-subtitle-chinese ruby {
          ruby-position: over;
        }
        #youku-dual-subtitle-chinese rt {
          font-size: 0.7em;
          font-weight: normal;
          opacity: 0.95;
          line-height: 1.3;
        }
      `;
      document.head.appendChild(style);
    }

    // Create container for both overlays
    overlayContainer = document.createElement('div');
    overlayContainer.id = 'youku-dual-subtitle-container';
    overlayContainer.style.position = 'fixed';
    overlayContainer.style.pointerEvents = 'auto';
    overlayContainer.style.cursor = 'move';
    overlayContainer.style.zIndex = '999999';
    overlayContainer.style.display = 'flex';
    overlayContainer.style.flexDirection = 'column';
    overlayContainer.style.alignItems = 'center';
    overlayContainer.style.gap = '8px';

    // Create Chinese overlay (top)
    chineseOverlay = document.createElement('div');
    chineseOverlay.id = 'youku-dual-subtitle-chinese';
    chineseOverlay.className = 'subtitle-overlay';

    // Create second language overlay (bottom)
    secondOverlay = document.createElement('div');
    secondOverlay.id = 'youku-dual-subtitle-second';
    secondOverlay.className = 'subtitle-overlay';

    // Apply shared styles to both overlays
    [chineseOverlay, secondOverlay].forEach(overlay => {
      overlay.style.background = 'transparent';
      overlay.style.color = '#ffffff';
      overlay.style.fontSize = fontSize + 'px';
      overlay.style.fontWeight = 'bold';
      overlay.style.textAlign = 'center';
      overlay.style.textShadow = '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0px 0px 4px rgba(0,0,0,0.8)';
      overlay.style.userSelect = 'none';
      overlay.style.padding = '8px 20px';
      overlay.style.minWidth = '200px';
      overlay.style.maxWidth = '97%';
      overlay.style.lineHeight = '1.4';
      overlay.style.whiteSpace = 'pre-line';
      overlay.style.wordWrap = 'break-word';
      overlay.style.pointerEvents = 'auto'; // Allow hover on words
    });

    // Append overlays to container
    overlayContainer.appendChild(chineseOverlay);
    overlayContainer.appendChild(secondOverlay);

    // Find video container and append overlay container to it
    const videoContainer = document.querySelector('.kui-dashboard-display-panel') ||
                          document.querySelector('#ykPlayer') ||
                          document.body;

    // Make sure container has relative positioning
    if (videoContainer.classList.contains('kui-dashboard-display-panel') || videoContainer.id === 'ykPlayer') {
      const computedStyle = window.getComputedStyle(videoContainer);
      if (computedStyle.position === 'static') {
        videoContainer.style.position = 'relative';
      }
    }

    videoContainer.appendChild(overlayContainer);

    // Store reference for resize observer
    currentVideoContainer = videoContainer;

    // Load saved position and user-set flag from localStorage
    try {
      const saved = localStorage.getItem('youku-dual-subtitle-position');
      const savedUserSet = localStorage.getItem('youku-dual-subtitle-position-user-set');

      if (saved) {
        overlayPosition = JSON.parse(saved);
        isPositionUserSet = savedUserSet === 'true';
        updateOverlayPosition();
      } else {
        // Calculate initial position from player bounds
        calculateInitialPositionFromPlayer(videoContainer);
      }
    } catch (e) {
      calculateInitialPositionFromPlayer(videoContainer);
    }

    // Set up resize observer to handle video container size changes
    setupVideoContainerResizeObserver(videoContainer);

    // Add drag handlers to container
    overlayContainer.addEventListener('mousedown', handleDragStart);
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);

    // Add keyboard shortcuts for subtitle navigation
    document.addEventListener('keydown', handleKeyboardNavigation);
  }

  // Navigate to previous subtitle
  function navigateToPreviousSubtitle() {
    if (!videoElement) {
      videoElement = document.querySelector('video');
    }
    if (!videoElement || !currentDialogues.chinese) return;

    const currentTime = videoElement.currentTime;
    const dialogues = currentDialogues.chinese;

    // Find the currently playing or most recent subtitle
    let currentIndex = -1;
    for (let i = 0; i < dialogues.length; i++) {
      if (dialogues[i].startTime <= currentTime && dialogues[i].endTime >= currentTime) {
        // Currently inside this subtitle
        currentIndex = i;
        break;
      } else if (dialogues[i].startTime > currentTime) {
        // We've passed the current time - use the previous subtitle
        currentIndex = i - 1;
        break;
      }
    }

    // If no subtitle found, use the last one before current time
    if (currentIndex === -1) {
      for (let i = dialogues.length - 1; i >= 0; i--) {
        if (dialogues[i].endTime < currentTime) {
          currentIndex = i;
          break;
        }
      }
    }

    // Go to the previous subtitle (one before current)
    const previousIndex = currentIndex - 1;
    if (previousIndex >= 0) {
      videoElement.currentTime = dialogues[previousIndex].startTime;
    } else if (currentIndex >= 0) {
      // If we're at the first subtitle, restart it
      videoElement.currentTime = dialogues[currentIndex].startTime;
    }
  }

  // Navigate to next subtitle
  function navigateToNextSubtitle() {
    if (!videoElement) {
      videoElement = document.querySelector('video');
    }
    if (!videoElement || !currentDialogues.chinese) return;

    const currentTime = videoElement.currentTime;
    const dialogues = currentDialogues.chinese;

    // Find the next subtitle (first one that starts after current time + 0.5s)
    let nextDialogue = null;
    for (let i = 0; i < dialogues.length; i++) {
      if (dialogues[i].startTime > currentTime + 0.5) {
        nextDialogue = dialogues[i];
        break;
      }
    }

    if (nextDialogue) {
      videoElement.currentTime = nextDialogue.startTime;
    }
  }

  // Replay current subtitle
  function replayCurrentSubtitle() {
    if (!videoElement) {
      videoElement = document.querySelector('video');
    }
    if (!videoElement || !currentDialogues.chinese) return;

    const currentTime = videoElement.currentTime;
    const dialogues = currentDialogues.chinese;

    // Find the current subtitle (one that contains current time)
    let currentDialogue = null;
    for (let i = 0; i < dialogues.length; i++) {
      if (dialogues[i].startTime <= currentTime && dialogues[i].endTime >= currentTime) {
        currentDialogue = dialogues[i];
        break;
      }
    }

    // If found, replay from start; otherwise find the most recent one
    if (currentDialogue) {
      videoElement.currentTime = currentDialogue.startTime;
    } else {
      // Find the most recent subtitle that ended
      for (let i = dialogues.length - 1; i >= 0; i--) {
        if (dialogues[i].endTime < currentTime) {
          videoElement.currentTime = dialogues[i].startTime;
          break;
        }
      }
    }
  }

  // Handle keyboard navigation (A, D, S keys)
  function handleKeyboardNavigation(e) {
    // Ignore if user is typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const key = e.key.toLowerCase();

    if (key === 'a') {
      e.preventDefault();
      navigateToPreviousSubtitle();
    } else if (key === 'd') {
      e.preventDefault();
      navigateToNextSubtitle();
    } else if (key === 's') {
      e.preventDefault();
      replayCurrentSubtitle();
    } else if (key === 'p') {
      e.preventDefault();
      // Toggle auto-pause
      autoPauseEnabled = !autoPauseEnabled;
      lastPausedSubtitle = null; // Reset to allow immediate pause
      try {
        localStorage.setItem('youku-dual-subtitle-auto-pause', autoPauseEnabled.toString());
        // Sync to chrome.storage via bridge
        window.postMessage({
          source: 'youku-dual-subtitle-main',
          action: 'syncAutoPauseToStorage',
          autoPauseEnabled: autoPauseEnabled
        }, '*');
      } catch (e) {
        console.error('%c[Dual-Subtitle] Failed to save auto-pause setting:', 'color: #ff0000', e);
      }
    }
  }

  // Handle keyboard shortcuts for dictionary lookups (Zhongwen-style)
  function handleDictionaryKeyboard(e) {
    // Only handle if dictionary popup is visible
    if (!currentDictionaryEntry || !currentDictionaryWord) return;

    // Ignore if user is typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // Use keyCode like Zhongwen does - it works across platforms including macOS
    const keyCode = e.keyCode;
    const altKey = e.altKey;
    let url = null;

    // Get simplified and traditional forms from first entry
    const firstEntry = currentDictionaryEntry.data && currentDictionaryEntry.data[0];
    let simplified = currentDictionaryWord;
    let traditional = currentDictionaryWord;

    if (firstEntry && firstEntry[0]) {
      const parsed = parseDictionaryEntry(firstEntry[0]);
      simplified = parsed.simplified || currentDictionaryWord;
      traditional = parsed.traditional || currentDictionaryWord;
    }

    // Use keyCode to handle keys properly on all platforms (including macOS Option key)
    switch (keyCode) {
      case 49: // '1'
        if (altKey) {
          // LINE Dict - use simplified
          url = 'https://english.dict.naver.com/english-chinese-dictionary/#/search?query=' + encodeURIComponent(simplified);
          e.preventDefault();
        }
        break;

      case 50: // '2'
        if (altKey) {
          // Forvo - pronunciation
          url = 'https://forvo.com/search/' + encodeURIComponent(currentDictionaryWord) + '/zh/';
          e.preventDefault();
        }
        break;

      case 51: // '3'
        if (altKey) {
          // Dict.cn
          url = 'https://dict.cn/' + encodeURIComponent(currentDictionaryWord);
          e.preventDefault();
        }
        break;

      case 52: // '4'
        if (altKey) {
          // iCIBA
          url = 'https://www.iciba.com/' + encodeURIComponent(currentDictionaryWord);
          e.preventDefault();
        }
        break;

      case 53: // '5'
        if (altKey) {
          // MDBG
          url = 'https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=' + encodeURIComponent(currentDictionaryWord);
          e.preventDefault();
        }
        break;

      case 54: // '6'
        if (altKey) {
          // Reverso
          url = 'https://context.reverso.net/translation/chinese-english/' + encodeURIComponent(currentDictionaryWord);
          e.preventDefault();
        }
        break;

      case 55: // '7'
        if (altKey) {
          // MoeDict - use traditional
          url = 'https://www.moedict.tw/~' + encodeURIComponent(traditional);
          e.preventDefault();
        }
        break;

      case 84: // 't'
        if (!altKey && !e.ctrlKey && !e.metaKey) {
          // Tatoeba - example sentences
          url = 'https://tatoeba.org/eng/sentences/search?from=cmn&to=eng&query=' + encodeURIComponent(currentDictionaryWord);
          e.preventDefault();
        }
        break;

      case 71: // 'g'
        if (!altKey && !e.ctrlKey && !e.metaKey && currentDictionaryEntry.grammar) {
          // AllSet Learning - Grammar
          url = 'https://resources.allsetlearning.com/chinese/grammar/' + encodeURIComponent(currentDictionaryWord);
          e.preventDefault();
        }
        break;

      case 86: // 'v'
        if (!altKey && !e.ctrlKey && !e.metaKey && currentDictionaryEntry.vocab) {
          // AllSet Learning - Vocabulary
          url = 'https://resources.allsetlearning.com/chinese/vocabulary/' + encodeURIComponent(currentDictionaryWord);
          e.preventDefault();
        }
        break;
    }

    // Open URL in new tab if one was set
    if (url) {
      window.open(url, '_blank');
    }
  }

  // Update overlay styles (used when font size changes)
  function updateOverlayStyles() {
    if (!chineseOverlay || !secondOverlay) return;

    [chineseOverlay, secondOverlay].forEach(overlay => {
      overlay.style.fontSize = fontSize + 'px';
    });

    updateOverlayPosition();
  }

  // Update overlay position based on stored percentages
  function updateOverlayPosition() {
    if (!overlayContainer) return;
    overlayContainer.style.left = overlayPosition.x + '%';
    overlayContainer.style.bottom = overlayPosition.y + '%';
    overlayContainer.style.transform = 'translateX(-50%)';
  }

  // Calculate initial subtitle position to be inside player container
  function calculateInitialPositionFromPlayer(playerContainer) {
    if (!overlayContainer) return;

    // Get player container bounds relative to viewport
    const playerRect = playerContainer.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Check if player is visible and has reasonable dimensions
    if (playerRect.width > 100 && playerRect.height > 100) {
      // Calculate center X position of player in viewport percentage
      const playerCenterX = playerRect.left + playerRect.width / 2;
      overlayPosition.x = (playerCenterX / viewportWidth) * 100;

      // Calculate Y position: 15% from bottom of player (85% from top)
      const targetYFromTop = playerRect.top + (playerRect.height * 0.85);
      const fromBottom = viewportHeight - targetYFromTop;
      overlayPosition.y = (fromBottom / viewportHeight) * 100;

      // Clamp to reasonable bounds
      overlayPosition.x = Math.max(10, Math.min(90, overlayPosition.x));
      overlayPosition.y = Math.max(5, Math.min(85, overlayPosition.y));
    }

    updateOverlayPosition();
  }

  // Set up ResizeObserver to watch video container size changes
  function setupVideoContainerResizeObserver(videoContainer) {
    if (!videoContainer || videoContainer === document.body) return;

    // Clean up existing observer
    if (videoContainerResizeObserver) {
      videoContainerResizeObserver.disconnect();
    }

    // Create new observer
    videoContainerResizeObserver = new ResizeObserver(() => {
      // Only reposition if user hasn't manually set position
      if (!isPositionUserSet) {
        calculateInitialPositionFromPlayer(videoContainer);
      }
    });

    videoContainerResizeObserver.observe(videoContainer);
  }

  // Drag handlers
  function handleDragStart(e) {
    // Set dragging state first
    isDragging = true;
    overlayContainer.style.background = 'rgba(128, 128, 128, 0.2)';
    overlayContainer.style.borderRadius = '4px';

    // Pause video while dragging (only if not already paused by hover)
    if (!videoElement) {
      videoElement = document.querySelector('video');
    }
    if (videoElement && !videoElement.paused && !wasPlayingBeforeHover) {
      wasPlayingBeforeHover = true;
      videoElement.pause();
    }

    // Calculate offset from overlay center
    const rect = overlayContainer.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    dragOffsetX = e.clientX - centerX;
    dragOffsetY = e.clientY - centerY;

    e.preventDefault();
  }

  function handleDragMove(e) {
    if (!isDragging) return;

    // Calculate position relative to viewport (for fixed positioning)
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Calculate position relative to viewport
    const newX = ((e.clientX - dragOffsetX) / viewportWidth) * 100;
    // For bottom positioning, calculate from bottom of viewport
    const newYFromBottom = ((viewportHeight - (e.clientY - dragOffsetY)) / viewportHeight) * 100;

    // Clamp to viewport
    overlayPosition.x = Math.max(5, Math.min(95, newX));
    overlayPosition.y = Math.max(5, Math.min(95, newYFromBottom));

    updateOverlayPosition();
  }

  function handleDragEnd() {
    if (!isDragging) return;

    isDragging = false;
    overlayContainer.style.background = 'transparent';
    overlayContainer.style.borderRadius = '0';

    // Resume video after dragging
    if (videoElement && wasPlayingBeforeHover) {
      videoElement.play();
      wasPlayingBeforeHover = false;
    }

    // Mark position as user-set and save both position and flag
    isPositionUserSet = true;
    try {
      localStorage.setItem('youku-dual-subtitle-position', JSON.stringify(overlayPosition));
      localStorage.setItem('youku-dual-subtitle-position-user-set', 'true');
    } catch (e) {
      console.error('%c[Dual-Subtitle] Failed to save position:', 'color: #ff0000', e);
    }
  }

  // Show subtitle text with word segmentation for Chinese
  function showSubtitle(overlay, text, isChinese = false) {
    if (overlay) {
      if (isChinese && text) {
        // Request word segmentation from background worker
        segmentAndDisplayChinese(overlay, text);
      } else {
        overlay.textContent = text;
      }
      overlay.style.display = 'block';
    }
  }

  // Segment Chinese text and display with hoverable words
  async function segmentAndDisplayChinese(overlay, text) {
    // Check cache first
    if (segmentationCache.has(text)) {
      displaySegmentedText(overlay, segmentationCache.get(text));
      return;
    }

    try {
      // Send segmentation request via bridge
      const requestId = 'segment_' + Date.now() + '_' + Math.random();

      const response = await new Promise((resolve, reject) => {
        pendingDictionaryRequests.set(requestId, resolve);

        window.postMessage({
          source: 'youku-dual-subtitle-main',
          action: 'dictionaryRequest',
          requestId: requestId,
          type: 'segment',
          text: text
        }, '*');

        // Timeout after 5 seconds
        setTimeout(() => {
          if (pendingDictionaryRequests.has(requestId)) {
            pendingDictionaryRequests.delete(requestId);
            reject(new Error('Segmentation timeout'));
          }
        }, 5000);
      });

      if (response && response.segments) {
        // Cache the result
        segmentationCache.set(text, response.segments);
        displaySegmentedText(overlay, response.segments);
      } else {
        // Fallback to plain text if segmentation fails
        overlay.textContent = text;
      }
    } catch (error) {
      console.error('%c[Dual-Subtitle] Segmentation error:', 'color: #ff0000', error);
      overlay.textContent = text;
    }
  }

  // Display segmented text with hoverable spans
  function displaySegmentedText(overlay, segments) {
    // Build HTML with spans for each segment
    const html = segments.map(segment => {
      if (segment.isWord && segment.text.length > 0) {
        // Wrap words in hoverable spans, optionally with ruby pinyin
        if (segment.pinyin) {
          const convertedPinyin = convertPinyinToToneMarks(segment.pinyin);
          const syllables = convertedPinyin.split(' ');
          const characters = segment.text.split('');

          // Color each hanzi character by its corresponding pinyin syllable tone
          const coloredHanzi = characters.map((char, index) => {
            const syllable = syllables[index] || '';
            const tone = getToneNumber(syllable);
            const color = getToneColor(tone);
            return `<span style="color: ${color}; text-shadow: 0 0 3px #000">${char}</span>`;
          }).join('');

          if (showPinyin) {
            // Color each pinyin syllable
            const coloredPinyin = syllables.map(syllable => {
              const tone = getToneNumber(syllable);
              const color = getToneColor(tone);
              return `<span style="color: ${color}; text-shadow: 0 0 2px #000">${syllable}</span>`;
            }).join('');

            return `<ruby><span class="chinese-word" data-word="${segment.text}">${coloredHanzi}</span><rt>${coloredPinyin}</rt></ruby>`;
          } else {
            // No pinyin, but keep colors
            return `<span class="chinese-word" data-word="${segment.text}">${coloredHanzi}</span>`;
          }
        } else {
          return `<span class="chinese-word" data-word="${segment.text}">${segment.text}</span>`;
        }
      } else {
        // Non-words (punctuation, single chars)
        return segment.text;
      }
    }).join('');

    overlay.innerHTML = html;

    // Add hover event listeners to word spans
    const wordSpans = overlay.querySelectorAll('.chinese-word');
    wordSpans.forEach(span => {
      span.addEventListener('mouseenter', handleWordHover);
      span.addEventListener('mouseleave', handleWordLeave);
    });

    // Add hover listeners to entire Chinese overlay for video pause
    overlay.addEventListener('mouseenter', pauseVideoOnHover);
    overlay.addEventListener('mouseleave', resumeVideoOnLeave);
  }

  // Hide subtitle
  function hideSubtitle(overlay) {
    if (overlay) {
      overlay.style.display = 'none';
      overlay.textContent = '';
      // Hide dictionary popup when subtitle is hidden
      hideDictionaryPopup();
    }
  }

  // Pause video when hovering over Chinese subtitle
  function pauseVideoOnHover() {
    // Don't trigger hover pause if we're dragging
    if (isDragging) return;

    if (!videoElement) {
      videoElement = document.querySelector('video');
    }
    if (videoElement && !videoElement.paused) {
      wasPlayingBeforeHover = true;
      videoElement.pause();
    }
  }

  // Resume video when leaving Chinese subtitle
  function resumeVideoOnLeave() {
    // Don't trigger hover resume if we're dragging
    if (isDragging) return;

    if (videoElement && wasPlayingBeforeHover) {
      videoElement.play();
      wasPlayingBeforeHover = false;
    }
  }

  // Handle word hover - show dictionary popup
  async function handleWordHover(event) {
    const word = event.target.getAttribute('data-word');
    if (!word) return;

    try {
      // Request dictionary lookup via bridge
      const requestId = 'search_' + Date.now() + '_' + Math.random();

      const response = await new Promise((resolve, reject) => {
        pendingDictionaryRequests.set(requestId, resolve);

        window.postMessage({
          source: 'youku-dual-subtitle-main',
          action: 'dictionaryRequest',
          requestId: requestId,
          type: 'search',
          text: word
        }, '*');

        // Timeout after 3 seconds
        setTimeout(() => {
          if (pendingDictionaryRequests.has(requestId)) {
            pendingDictionaryRequests.delete(requestId);
            reject(new Error('Dictionary lookup timeout'));
          }
        }, 3000);
      });

      if (response && response.data && response.data.length > 0) {
        // Show popup with dictionary entry
        showDictionaryPopup(event.target, response);
      }
    } catch (error) {
      console.error('%c[Dual-Subtitle] Dictionary lookup error:', 'color: #ff0000', error);
    }
  }

  // Handle word leave - hide dictionary popup
  function handleWordLeave(event) {
    hideDictionaryPopup();
  }

  // Show dictionary popup near the hovered word
  function showDictionaryPopup(element, entry) {
    // Remove existing popup if any
    hideDictionaryPopup();

    // Store current entry for keyboard shortcuts
    currentDictionaryEntry = entry;
    currentDictionaryWord = element.getAttribute('data-word');

    // Create popup element
    const popup = document.createElement('div');
    popup.id = 'zhongwen-window';
    popup.className = 'zhongwen-popup';

    // Parse dictionary entry and build HTML
    const html = buildDictionaryHTML(entry);
    popup.innerHTML = html;

    // Add to document
    document.body.appendChild(popup);

    // Position popup near the hovered word
    const rect = element.getBoundingClientRect();
    popup.style.left = rect.left + 'px';
    popup.style.top = (rect.bottom + 5) + 'px';

    // Adjust if popup goes off screen
    const popupRect = popup.getBoundingClientRect();
    if (popupRect.right > window.innerWidth) {
      popup.style.left = (window.innerWidth - popupRect.width - 10) + 'px';
    }
    if (popupRect.bottom > window.innerHeight) {
      popup.style.top = (rect.top - popupRect.height - 5) + 'px';
    }

    // Add keyboard listener for dictionary shortcuts
    document.addEventListener('keydown', handleDictionaryKeyboard);
  }

  // Hide dictionary popup
  function hideDictionaryPopup() {
    const popup = document.getElementById('zhongwen-window');
    if (popup) {
      popup.remove();
    }
    // Clear stored entry and remove keyboard listener
    currentDictionaryEntry = null;
    currentDictionaryWord = null;
    document.removeEventListener('keydown', handleDictionaryKeyboard);
  }

  // Build HTML for dictionary popup
  function buildDictionaryHTML(entry) {
    if (!entry || !entry.data || entry.data.length === 0) {
      return '<div class="w-def">No definition found</div>';
    }

    let html = '';

    // Display all matching entries (like zhongwen does)
    const maxEntries = Math.min(entry.data.length, 5); // Show up to 5 entries

    for (let i = 0; i < maxEntries; i++) {
      const [dictEntry, matchedWord] = entry.data[i];

      // Parse dictionary entry format: "simplified traditional [pinyin] /definition1/definition2/"
      const parsed = parseDictionaryEntry(dictEntry);

      if (i > 0) {
        html += '<br>'; // Separate multiple entries
      }

      // Display Chinese characters with individual tone colors
      // Show the selected variant first, then the other variant in brackets if different
      const isTraditionalSubtitle = currentLanguages.chinese === 'cht';

      if (parsed.pinyin) {
        const convertedPinyin = convertPinyinToToneMarks(parsed.pinyin);
        const syllables = convertedPinyin.split(' ');

        // Choose the correct variant to display as primary
        const primaryText = isTraditionalSubtitle ? parsed.traditional : parsed.simplified;
        const alternateText = isTraditionalSubtitle ? parsed.simplified : parsed.traditional;
        const primaryCharacters = primaryText.split('');

        // Color each hanzi character by its corresponding pinyin syllable tone
        const hanziSpans = primaryCharacters.map((char, index) => {
          const syllable = syllables[index] || '';
          const tone = getToneNumber(syllable);
          const color = getToneColor(tone);
          return `<span style="color: ${color} !important; font-size: 24px; font-weight: bold;">${char}</span>`;
        }).join('');
        html += `<span class="w-hanzi" style="margin-right: 8px;">${hanziSpans}</span>`;

        // Show alternate form if different, also colored
        if (primaryText !== alternateText) {
          const alternateCharacters = alternateText.split('');
          const alternateSpans = alternateCharacters.map((char, index) => {
            const syllable = syllables[index] || '';
            const tone = getToneNumber(syllable);
            const color = getToneColor(tone);
            return `<span style="color: ${color} !important; font-size: 24px; font-weight: bold;">${char}</span>`;
          }).join('');
          html += `<span class="w-hanzi" style="margin-right: 8px; opacity: 0.7;">${alternateSpans}</span>`;
        }
      } else {
        // No pinyin - show selected variant with alternate in brackets
        const primaryText = isTraditionalSubtitle ? parsed.traditional : parsed.simplified;
        const alternateText = isTraditionalSubtitle ? parsed.simplified : parsed.traditional;
        html += `<span class="w-hanzi">${primaryText}</span>`;
        if (primaryText !== alternateText) {
          html += ` <span class="w-hanzi" style="opacity: 0.7;">[${alternateText}]</span>`;
        }
      }

      // Display pinyin (always enabled for dictionary popup)
      if (parsed.pinyin) {
        const convertedPinyin = convertPinyinToToneMarks(parsed.pinyin);
        // Split by syllables and color each by its own tone
        const syllables = convertedPinyin.split(' ');
        const pinyinSpans = syllables.map(syllable => {
          const tone = getToneNumber(syllable);
          const color = getToneColor(tone);
          return `<span class="w-pinyin" style="color: ${color} !important;">${syllable}</span>`;
        }).join('');  // Join without spaces for compact display
        html += pinyinSpans + '<br>';
      }

      // Display definitions with converted pinyin
      if (parsed.definitions && parsed.definitions.length > 0) {
        const defs = parsed.definitions.map(def => {
          // Convert pinyin in definitions like "也[ye3]" to "也[yě]" with colors
          return def.replace(/([\u4e00-\u9fff|]+)\[([^\]]+)\]/g, (match, chars, pinyin) => {
            // Pre-process: split concatenated numbered syllables (e.g., "lu:3you2" → "lu:3 you2")
            // Match pattern: consonants + vowels + consonants + tone number
            const preprocessed = pinyin.replace(/([1-5])([a-zA-Z])/g, '$1 $2');

            const converted = convertPinyinToToneMarks(preprocessed);
            let syllables = converted.split(/\s+/).filter(s => s.length > 0);

            // For pipe-separated variants like "迴|回", both share the same pinyin
            // Use the first part (before pipe) to determine character count
            const firstVariant = chars.split('|')[0];
            const characters = firstVariant.split('');

            // If syllable count doesn't match character count, try to split further
            if (syllables.length !== characters.length && syllables.length === 1 && characters.length > 1) {
              // Split by detecting where each syllable ends (after a tone mark or precomposed vowel)
              const parts = [];
              let current = '';
              for (let i = 0; i < converted.length; i++) {
                const char = converted[i];
                current += char;

                // Check if current character is a combining diacritic
                const isCombiningMark = /[\u0300-\u030C\u0304]/.test(char);
                // Check if current character is a precomposed vowel with tone
                const isPrecomposedVowel = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(char);

                if (isCombiningMark || isPrecomposedVowel) {
                  parts.push(current);
                  current = '';
                }
              }
              if (current) parts.push(current);
              if (parts.length > 1) syllables = parts;
            }

            // Color each hanzi character (handle variants with pipe)
            const variants = chars.split('|');
            const coloredChars = variants.map(variant => {
              return variant.split('').map((char, index) => {
                const syllable = syllables[index] || syllables[0]; // Fallback to first syllable
                const tone = getToneNumber(syllable);
                const color = getToneColor(tone);
                return `<span style="color: ${color}">${char}</span>`;
              }).join('');
            });

            // Swap order based on current subtitle mode (variants[0] is traditional, variants[1] is simplified)
            const orderedChars = (variants.length > 1 && !isTraditionalSubtitle)
              ? [coloredChars[1], coloredChars[0]].join('|')
              : coloredChars.join('|');

            // Color each pinyin syllable
            const coloredPinyin = syllables.map(syllable => {
              const tone = getToneNumber(syllable);
              const color = getToneColor(tone);
              return `<span style="color: ${color}">${syllable}</span>`;
            }).join('');

            return `${orderedChars}[${coloredPinyin}]`;
          });
        }).join('; ');
        html += `<span class="w-def">${defs}</span>`;
      }
    }

    // Add shortcuts section at the bottom
    let shortcuts = 'shortcuts: t, alt+1..7';

    // Add optional shortcuts (only if word is in grammar/vocab keywords)
    if (entry.grammar) {
      shortcuts += ', g';
    }
    if (entry.vocab) {
      shortcuts += ', v';
    }

    html += `<br><div style="margin-top: 4px; padding-top: 3px; font-size: 11px; color: #8B0000;">${shortcuts}</div>`;

    return html;
  }

  // Parse dictionary entry format
  function parseDictionaryEntry(entry) {
    // Format: "traditional simplified [pinyin] /definition1/definition2/"
    // CC-CEDICT format has traditional first, then simplified
    const match = entry.match(/^([^\s]+?)\s+([^\s]+?)\s+\[(.*?)\]?\s*\/(.+)\//);

    if (!match) {
      console.warn('%c[Dual-Subtitle] Failed to parse dictionary entry:', 'color: #ff9900', entry);
      return { simplified: entry, traditional: entry, pinyin: '', definitions: [] };
    }

    const [, traditional, simplified, pinyin, defString] = match;

    // Parse definitions (split by /)
    const definitions = defString.split('/').filter(d => d.trim().length > 0);


    return {
      simplified,
      traditional,
      pinyin,
      definitions
    };
  }

  // Get tone number from pinyin syllable
  function getToneNumber(syllable) {
    if (!syllable) return 5;
    // Check for combining diacritics (used by our tonify function)
    if (/\u0304/.test(syllable)) return 1; // combining macron (tone 1)
    if (/\u0301/.test(syllable)) return 2; // combining acute (tone 2)
    if (/\u030C/.test(syllable)) return 3; // combining caron (tone 3)
    if (/\u0300/.test(syllable)) return 4; // combining grave (tone 4)
    // Check for precomposed characters (fallback)
    if (/[āēīōūǖĀĒĪŌŪǕ]/.test(syllable)) return 1;
    if (/[áéíóúǘÁÉÍÓÚǗ]/.test(syllable)) return 2;
    if (/[ǎěǐǒǔǚǍĚǏǑǓǙ]/.test(syllable)) return 3;
    if (/[àèìòùǜÀÈÌÒÙǛ]/.test(syllable)) return 4;
    // Check for tone numbers (e.g., "ni3")
    const toneMatch = syllable.match(/\d/);
    if (toneMatch) return parseInt(toneMatch[0]);
    return 5; // Neutral tone
  }

  // Convert numbered pinyin (ni3) to tone marks (nǐ)
  // Based on zhongwen extension's tonify function
  const toneDiacritics = {
    1: '\u0304', // ̄ macron
    2: '\u0301', // ́ acute
    3: '\u030C', // ̌ caron
    4: '\u0300', // ̀ grave
    5: ''        // neutral
  };

  // Tone color schemes
  const toneColorSchemes = {
    pleco: {
      1: '#ff0000', // red
      2: '#00aa00', // green
      3: '#0066ff', // blue
      4: '#aa00ff', // purple
      5: '#888888'  // gray
    },
    dummit: {
      1: '#ff0000', // red
      2: '#ff8800', // orange
      3: '#00aa00', // green
      4: '#00ccff', // light blue
      5: '#888888'  // gray
    },
    sinosplice: {
      1: '#ff8800', // orange
      2: '#00aa00', // green
      3: '#0066ff', // blue
      4: '#ff0000', // red
      5: '#888888'  // gray
    },
    hanping: {
      1: '#00ccff', // light blue
      2: '#00aa00', // green
      3: '#ff8800', // orange
      4: '#ff0000', // red
      5: '#888888'  // gray
    },
    mdbg: {
      1: '#ff0000', // red
      2: '#ff8800', // orange
      3: '#00aa00', // green
      4: '#0066ff', // blue
      5: '#888888'  // gray
    }
  };

  function getToneColor(tone) {
    const scheme = toneColorSchemes[toneColorScheme] || toneColorSchemes.pleco;
    const toneNum = parseInt(tone) || 5;
    return scheme[toneNum] || scheme[5];
  }

  function parsePinyin(syllable) {
    // Match: consonants, vowels, consonants, tone number
    return syllable.match(/([^AEIOUaeiou]*)([AEIOUaeiou:]+)([^aeiou:]*)([1-5])/);
  }

  function tonifyVowels(vowels, tone) {
    if (vowels === 'ou') {
      return 'o' + toneDiacritics[tone] + 'u';
    }

    let result = '';
    let tonified = false;

    for (let i = 0; i < vowels.length; i++) {
      let char = vowels.charAt(i);
      result += char;

      // Place tone mark on 'a' or 'e' if present
      if (char === 'a' || char === 'e') {
        result += toneDiacritics[tone];
        tonified = true;
      }
      // Otherwise place on last vowel
      else if (i === vowels.length - 1 && !tonified) {
        result += toneDiacritics[tone];
        tonified = true;
      }
    }

    // Handle ü (u:)
    result = result.replace(/u:/, 'ü');

    return result;
  }

  function convertPinyinToToneMarks(pinyinString) {
    if (!pinyinString) return '';

    const syllables = pinyinString.split(/[\s·]+/);
    const converted = syllables.map(syllable => {
      // Handle special cases
      if (syllable === 'r5') return 'r';
      if (syllable === 'xx5') return '??';
      if (syllable === ',') return ',';

      const match = parsePinyin(syllable);
      if (!match) return syllable;

      const [, initial, vowels, final, tone] = match;
      const tonifiedVowels = tonifyVowels(vowels, tone);

      return initial + tonifiedVowels + final;
    });

    return converted.join(' ');
  }

  // Intercept JSONP responses to get subtitle metadata
  function interceptJSONP() {

    for (let i = 1; i <= 20; i++) {
      const callbackName = 'mtopjsonp' + i;

      Object.defineProperty(window, callbackName, {
        configurable: true,
        enumerable: true,
        get: function() {
          return this['_' + callbackName];
        },
        set: function(value) {
          this['_' + callbackName] = function(data) {
            parseYoukuResponse(data);
            if (typeof value === 'function') {
              return value.apply(this, arguments);
            }
          };
        }
      });

      window['_mtopjsonp' + i] = function(data) {
        parseYoukuResponse(data);
      };
    }
  }

  // Scrape language labels from player UI (English names)
  function scrapeLanguageLabels(retryCount = 0) {
    const nodes = document.querySelectorAll('div[data-spm="subtitle"]');

    if (nodes.length === 0 && retryCount < 10) {
      // Player UI not ready yet, retry after delay
      setTimeout(() => scrapeLanguageLabels(retryCount + 1), 500);
      return;
    }

    scrapedLanguageLabels = {};
    nodes.forEach(node => {
      const code = node.getAttribute('data-val') || '';
      const label = node.textContent ? node.textContent.trim() : '';
      if (code && label) {
        scrapedLanguageLabels[code] = label;
      }
    });

    // Update available subtitles with new labels
    if (availableSubtitles.length > 0) {
      updateSubtitleLabels();
    }
  }

  // Update subtitle labels with scraped English names
  function updateSubtitleLabels() {
    availableSubtitles = availableSubtitles.map(sub => {
      // Special handling for Chinese subtitle codes
      if (sub.code === 'chs') {
        return {
          ...sub,
          name: '简体中文 (Simplified Chinese)'
        };
      }
      if (sub.code === 'cht') {
        return {
          ...sub,
          name: '繁体中文 (Traditional Chinese)'
        };
      }

      const chineseName = sub.name.split(' (')[0]; // Get original Chinese name
      const englishName = scrapedLanguageLabels[sub.code] || '';

      // Create display name: 英语 (English) or just 英语 if same
      let displayName = chineseName;
      if (englishName && englishName !== chineseName && !chineseName.includes(englishName)) {
        displayName = `${chineseName} (${englishName})`;
      }

      return {
        ...sub,
        name: displayName
      };
    });
  }

  // Parse Youku API response and extract subtitle info
  function parseYoukuResponse(jsonData) {
    try {
      if (jsonData && jsonData.data && jsonData.data.data && jsonData.data.data.subtitle) {
        const subtitles = jsonData.data.data.subtitle;


        // Store available subtitles with Chinese names initially
        availableSubtitles = subtitles.map(sub => {
          const code = (Array.isArray(sub.subtitle_info_code) ? sub.subtitle_info_code[0] : sub.subtitle_info_code) || sub.lang || 'unknown';
          const chineseName = (Array.isArray(sub.subtitle_info) ? sub.subtitle_info[0] : sub.subtitle_info) || code;

          return {
            code: code,
            name: chineseName,
            url: sub.url
          };
        });


        // Scrape language labels from player UI (with retry)
        scrapeLanguageLabels();

        // Load saved preference from localStorage and display it
        try {
          const savedSecondLang = localStorage.getItem('youku-dual-subtitle-second-language') || 'en';

          // Load Chinese subtitle based on variant preference
          const preferredCode = chineseVariant === 'traditional' ? 'cht' : 'chs';
          const fallbackCode = chineseVariant === 'traditional' ? 'chs' : 'cht';

          const chineseSubtitle = availableSubtitles.find(s => s.code === preferredCode) ||
                                  availableSubtitles.find(s => s.code === fallbackCode);
          if (chineseSubtitle) {
            loadSubtitle(chineseSubtitle.code, chineseSubtitle.url, 'chinese');
          }

          // Load second language subtitle
          const secondSubtitle = availableSubtitles.find(s => s.code === savedSecondLang);
          if (secondSubtitle) {
            loadSubtitle(secondSubtitle.code, secondSubtitle.url, 'second');
          } else {
            console.warn('%c[Dual-Subtitle] Second subtitle not available:', 'color: #ff9900', {
              requested: savedSecondLang,
              available: availableSubtitles.map(s => s.code).join(', ')
            });
            // Try to fall back to English if requested language not available
            if (savedSecondLang !== 'en') {
              const englishSubtitle = availableSubtitles.find(s => s.code === 'en');
              if (englishSubtitle) {
                loadSubtitle(englishSubtitle.code, englishSubtitle.url, 'second');
              }
            }
          }
        } catch (e) {
        }
      }
    } catch (error) {
      console.error('%c[Dual-Subtitle] Error parsing response:', 'color: #ff0000', error);
    }
  }

  // Download and parse subtitle file
  function loadSubtitle(code, url, slot = 'chinese') {
    // Check cache first
    if (subtitleCache.has(code)) {
      currentLanguages[slot] = code;
      currentDialogues[slot] = subtitleCache.get(code);
      lastDisplayedText[slot] = null;
      return;
    }


    // Convert http to https to avoid mixed content issues
    const httpsUrl = url.replace(/^http:/, 'https:');

    const xhr = new XMLHttpRequest();
    xhr.open('GET', httpsUrl, true);
    xhr.responseType = 'text';

    xhr.onload = function() {
      if (xhr.status >= 200 && xhr.status < 300) {

        // Parse the .ass file
        const dialogues = parseAssFile(xhr.responseText);

        // Cache it
        subtitleCache.set(code, dialogues);

        // Set as current for this slot
        currentLanguages[slot] = code;
        currentDialogues[slot] = dialogues;
        lastDisplayedText[slot] = null;

      } else {
        console.error('%c[Dual-Subtitle] Download failed:', 'color: #ff0000', xhr.status);
      }
    };

    xhr.onerror = function() {
      console.error('%c[Dual-Subtitle] Network error downloading subtitle', 'color: #ff0000');
    };

    xhr.send();
  }

  // Parse .ass file format
  function parseAssFile(assText) {
    const lines = assText.split('\n');
    const dialogues = [];
    let inEventsSection = false;
    let formatLine = null;

    for (let line of lines) {
      line = line.trim();

      if (line === '[Events]') {
        inEventsSection = true;
        continue;
      }

      if (line.startsWith('[') && line !== '[Events]') {
        inEventsSection = false;
      }

      if (!inEventsSection) continue;

      if (line.startsWith('Format:')) {
        formatLine = line.substring(7).split(',').map(s => s.trim());
        continue;
      }

      if (line.startsWith('Dialogue:') && formatLine) {
        const parts = line.substring(9).split(',');
        const dialogue = {};

        // The Text field may contain commas, so join remaining parts
        const textIndex = formatLine.indexOf('Text');
        formatLine.forEach((key, index) => {
          if (index < textIndex) {
            dialogue[key] = parts[index].trim();
          } else if (index === textIndex) {
            // Join all remaining parts for Text field
            dialogue[key] = parts.slice(index).join(',').trim();
          }
        });

        // Convert time to seconds
        dialogue.startTime = timeToSeconds(dialogue.Start);
        dialogue.endTime = timeToSeconds(dialogue.End);

        // Replace ASS line breaks (\N) with actual line breaks
        if (dialogue.Text) {
          dialogue.Text = dialogue.Text.replace(/\\N/g, '\n');
        }

        dialogues.push(dialogue);
      }
    }

    return dialogues;
  }

  // Convert ASS time format to seconds
  function timeToSeconds(timeStr) {
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  }

  // Hook into XAss to sync subtitles with video
  function hookXAssEvents() {

    if (!window.XAss) {
      setTimeout(hookXAssEvents, 500);
      return;
    }


    const proto = window.XAss.prototype;

    if (proto && proto.onTimeUpdate) {
      const originalOnTimeUpdate = proto.onTimeUpdate;

      proto.onTimeUpdate = function(time) {
        // Display Chinese subtitle
        if (currentDialogues.chinese && currentLanguages.chinese) {
          const chineseDialogue = currentDialogues.chinese.find(d =>
            d.startTime <= time && d.endTime >= time
          );

          if (chineseDialogue) {
            const text = chineseDialogue.Text;
            if (text !== lastDisplayedText.chinese) {
              showSubtitle(chineseOverlay, text, true);
              lastDisplayedText.chinese = text;

              // Auto-pause on new subtitle if enabled
              if (autoPauseEnabled && text !== lastPausedSubtitle) {
                if (!videoElement) {
                  videoElement = document.querySelector('video');
                }
                if (videoElement && !videoElement.paused) {
                  videoElement.pause();
                  lastPausedSubtitle = text;
                }
              }
            }
          } else if (lastDisplayedText.chinese !== null) {
            hideSubtitle(chineseOverlay);
            lastDisplayedText.chinese = null;
          }
        } else {
          if (chineseOverlay && chineseOverlay.style.display !== 'none') {
            hideSubtitle(chineseOverlay);
            lastDisplayedText.chinese = null;
          }
        }

        // Display second language subtitle
        if (currentDialogues.second && currentLanguages.second) {
          const secondDialogue = currentDialogues.second.find(d =>
            d.startTime <= time && d.endTime >= time
          );

          if (secondDialogue) {
            const text = secondDialogue.Text;
            if (text !== lastDisplayedText.second) {
              showSubtitle(secondOverlay, text, false);
              lastDisplayedText.second = text;
            }
          } else if (lastDisplayedText.second !== null) {
            hideSubtitle(secondOverlay);
            lastDisplayedText.second = null;
          }
        } else {
          if (secondOverlay && secondOverlay.style.display !== 'none') {
            hideSubtitle(secondOverlay);
            lastDisplayedText.second = null;
          }
        }

        return originalOnTimeUpdate.call(this, time);
      };

    }
  }

  // Handle messages from bridge script via window.postMessage
  window.addEventListener('message', (event) => {
    // Only accept messages from same origin
    if (event.source !== window) return;

    const message = event.data;
    if (!message || message.source !== 'youku-dual-subtitle-bridge') return;


    // Handle localStorage sync from bridge
    if (message.action === 'syncStorage') {
      try {
        localStorage.setItem(message.storageKey, message.storageValue);

        // Also update the runtime variables immediately
        if (message.storageKey === 'youku-dual-subtitle-fontsize') {
          fontSize = parseInt(message.storageValue);
          updateOverlayStyles();
        } else if (message.storageKey === 'youku-dual-subtitle-pinyin') {
          showPinyin = message.storageValue === 'true';
        } else if (message.storageKey === 'youku-dual-subtitle-tone-colors') {
          toneColorScheme = message.storageValue;
        } else if (message.storageKey === 'youku-dual-subtitle-chinese-variant') {
          chineseVariant = message.storageValue;
        } else if (message.storageKey === 'youku-dual-subtitle-auto-pause') {
          autoPauseEnabled = message.storageValue === 'true';
        }
      } catch (e) {
        console.error('%c[Dual-Subtitle] Failed to sync storage:', 'color: #ff0000', e);
      }
      return;
    }

    if (message.action === 'changeFontSize') {
      fontSize = message.fontSize;
      updateOverlayStyles();
      try {
        localStorage.setItem('youku-dual-subtitle-fontsize', fontSize.toString());
      } catch (e) {
        console.error('%c[Dual-Subtitle] Failed to save font size:', 'color: #ff0000', e);
      }
      window.postMessage({
        source: 'youku-dual-subtitle-main',
        action: 'changeFontSize',
        success: true,
        fontSize: fontSize
      }, '*');
      return;
    }

    if (message.action === 'togglePinyin') {
      showPinyin = message.showPinyin;
      try {
        localStorage.setItem('youku-dual-subtitle-pinyin', showPinyin.toString());

        // Re-render Chinese subtitle if currently displayed
        if (lastDisplayedText.chinese && chineseOverlay) {
          // Get segments from cache
          const segments = segmentationCache.get(lastDisplayedText.chinese);
          if (segments) {
            displaySegmentedText(chineseOverlay, segments);
          }
        }
      } catch (e) {
        console.error('%c[Dual-Subtitle] Failed to save pinyin setting:', 'color: #ff0000', e);
      }
      window.postMessage({
        source: 'youku-dual-subtitle-main',
        action: 'togglePinyin',
        success: true,
        showPinyin: showPinyin
      }, '*');
      return;
    }

    if (message.action === 'toggleAutoPause') {
      autoPauseEnabled = message.autoPauseEnabled;
      lastPausedSubtitle = null; // Reset to allow immediate pause on next subtitle
      try {
        localStorage.setItem('youku-dual-subtitle-auto-pause', autoPauseEnabled.toString());
      } catch (e) {
        console.error('%c[Dual-Subtitle] Failed to save auto-pause setting:', 'color: #ff0000', e);
      }
      window.postMessage({
        source: 'youku-dual-subtitle-main',
        action: 'toggleAutoPause',
        success: true,
        autoPauseEnabled: autoPauseEnabled
      }, '*');
      return;
    }

    if (message.action === 'changeToneColors') {
      toneColorScheme = message.scheme;
      try {
        localStorage.setItem('youku-dual-subtitle-tone-colors', toneColorScheme);

        // Hide any existing dictionary popup so user sees new colors on next hover
        hideDictionaryPopup();

        // Re-render Chinese subtitle if currently displayed
        if (lastDisplayedText.chinese && chineseOverlay) {
          const segments = segmentationCache.get(lastDisplayedText.chinese);
          if (segments) {
            displaySegmentedText(chineseOverlay, segments);
          }
        }
      } catch (e) {
        console.error('%c[Dual-Subtitle] Failed to save tone color scheme:', 'color: #ff0000', e);
      }
      return;
    }

    if (message.action === 'changeChineseVariant') {
      chineseVariant = message.variant;
      try {
        localStorage.setItem('youku-dual-subtitle-chinese-variant', chineseVariant);

        // Reload Chinese subtitle with new variant
        if (availableSubtitles.length > 0) {
          const preferredCode = chineseVariant === 'traditional' ? 'cht' : 'chs';
          const fallbackCode = chineseVariant === 'traditional' ? 'chs' : 'cht';

          const chineseSubtitle = availableSubtitles.find(s => s.code === preferredCode) ||
                                  availableSubtitles.find(s => s.code === fallbackCode);
          if (chineseSubtitle) {
            loadSubtitle(chineseSubtitle.code, chineseSubtitle.url, 'chinese');
          }
        }
      } catch (e) {
        console.error('%c[Dual-Subtitle] Failed to save Chinese variant:', 'color: #ff0000', e);
      }
      return;
    }

    if (message.action === 'resetPosition') {
      // Reset position to default
      overlayPosition = { x: 50, y: 15 };
      isPositionUserSet = false;

      // Clear saved position from storage
      try {
        localStorage.removeItem('youku-dual-subtitle-position');
        localStorage.removeItem('youku-dual-subtitle-position-user-set');
      } catch (e) {
        console.error('%c[Dual-Subtitle] Failed to clear position:', 'color: #ff0000', e);
      }

      // Update overlay position immediately
      updateOverlayPosition();
      return;
    }

    if (message.action === 'dictionaryResponse') {
      // Handle dictionary lookup response from bridge
      const requestId = message.requestId;
      if (pendingDictionaryRequests.has(requestId)) {
        const callback = pendingDictionaryRequests.get(requestId);
        pendingDictionaryRequests.delete(requestId);
        callback(message.result);
      }
      return;
    }

    if (message.action === 'getSubtitles') {
      window.postMessage({
        source: 'youku-dual-subtitle-main',
        action: 'getSubtitles',
        subtitles: availableSubtitles
      }, '*');
    } else if (message.action === 'setSubtitle') {
      // Now handles setting the second language subtitle
      // Chinese is always loaded automatically
      if (!message.code) {
        // Clear second subtitle
        currentLanguages.second = null;
        currentDialogues.second = null;
        hideSubtitle(secondOverlay);
        window.postMessage({
          source: 'youku-dual-subtitle-main',
          action: 'setSubtitle',
          success: true
        }, '*');
      } else {
        // Load second language subtitle
        loadSubtitle(message.code, message.url, 'second');

        // Save preference
        try {
          localStorage.setItem('youku-dual-subtitle-second-language', message.code);
        } catch (e) {
          console.error('%c[Dual-Subtitle] Failed to save language preference:', 'color: #ff0000', e);
        }

        window.postMessage({
          source: 'youku-dual-subtitle-main',
          action: 'setSubtitle',
          success: true
        }, '*');
      }
    }
  });

  // Initialize
  function initialize() {

    if (document.body) {
      createOverlay();
    } else {
      setTimeout(initialize, 100);
      return;
    }

    // Set up JSONP interception
    interceptJSONP();

    // Hook XAss
    setTimeout(hookXAssEvents, 1000);
  }

  // Start initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
