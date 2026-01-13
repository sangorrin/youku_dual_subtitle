// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2025-2026 Daniel Sangorrin
//
// Youku Dual Subtitle - Popup UI Script
// Subtitle language selection and user preferences interface

(function() {
  'use strict';

  const secondSelect = document.getElementById('second-subtitle-select');
  const chineseVariantSelect = document.getElementById('chinese-variant-select');
  const status = document.getElementById('status');
  const fontDecrease = document.getElementById('font-decrease');
  const fontIncrease = document.getElementById('font-increase');
  const fontSizeDisplay = document.getElementById('font-size-display');
  const pinyinToggle = document.getElementById('pinyin-toggle');
  const autoPauseToggle = document.getElementById('auto-pause-toggle');
  const helpIcon = document.getElementById('help-icon');
  const resetPositionBtn = document.getElementById('reset-position-btn');
  let availableSubtitles = [];
  let currentFontSize = 36; // Default: matches content.js and bridge.js defaults
  let closeTimeout = null;

  // Help icon click handler
  helpIcon.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('help.html') });
  });

  // Auto-close popup when mouse leaves
  document.body.addEventListener('mouseleave', () => {
    closeTimeout = setTimeout(() => {
      window.close();
    }, 500);
  });

  // Cancel auto-close when mouse re-enters
  document.body.addEventListener('mouseenter', () => {
    if (closeTimeout) {
      clearTimeout(closeTimeout);
      closeTimeout = null;
    }
  });

  // Load saved font size
  chrome.storage.local.get(['subtitleFontSize'], (result) => {
    if (result.subtitleFontSize) {
      currentFontSize = result.subtitleFontSize;
    }
    // Always update display (even with default value)
    fontSizeDisplay.textContent = currentFontSize + 'px';
  });

  // Load saved pinyin setting
  chrome.storage.local.get(['showPinyin'], (result) => {
    if (result.showPinyin !== undefined) {
      pinyinToggle.checked = result.showPinyin;
    } else {
      // Default to true (enabled)
      pinyinToggle.checked = true;
    }
  });

  // Load saved automatic pause setting
  chrome.storage.local.get(['autoPauseEnabled'], (result) => {
    if (result.autoPauseEnabled !== undefined) {
      autoPauseToggle.checked = result.autoPauseEnabled;
    } else {
      // Default to false (disabled)
      autoPauseToggle.checked = false;
    }
  });

  // Load saved Chinese variant preference
  chrome.storage.local.get(['chineseVariant'], (result) => {
    if (result.chineseVariant) {
      chineseVariantSelect.value = result.chineseVariant;
    } else {
      chineseVariantSelect.value = 'simplified'; // Default
    }
  });

  // Chinese variant selector
  chineseVariantSelect.addEventListener('change', () => {
    const variant = chineseVariantSelect.value;
    chrome.storage.local.set({ chineseVariant: variant });

    // Send to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'changeChineseVariant',
          variant: variant
        });
      }
    });
  });

  // Font size controls
  fontDecrease.addEventListener('click', () => {
    if (currentFontSize > 10) {
      currentFontSize--;
      updateFontSize();
    }
  });

  fontIncrease.addEventListener('click', () => {
    currentFontSize++;
    updateFontSize();
  });

  function updateFontSize() {
    fontSizeDisplay.textContent = currentFontSize + 'px';
    chrome.storage.local.set({ subtitleFontSize: currentFontSize });

    // Send to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'changeFontSize',
          fontSize: currentFontSize
        });
      }
    });
  }

  // Pinyin toggle
  pinyinToggle.addEventListener('change', () => {
    const showPinyin = pinyinToggle.checked;
    chrome.storage.local.set({ showPinyin: showPinyin });

    // Send to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'togglePinyin',
          showPinyin: showPinyin
        });
      }
    });
  });

  // Automatic pause toggle
  autoPauseToggle.addEventListener('change', () => {
    const autoPauseEnabled = autoPauseToggle.checked;
    chrome.storage.local.set({ autoPauseEnabled: autoPauseEnabled });

    // Send to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'toggleAutoPause',
          autoPauseEnabled: autoPauseEnabled
        });
      }
    });
  });

  // Tone color scheme selector
  const toneColorSelect = document.getElementById('tone-color-select');

  // Load saved tone color scheme
  chrome.storage.local.get(['toneColorScheme'], (result) => {
    if (result.toneColorScheme) {
      toneColorSelect.value = result.toneColorScheme;
    } else {
      toneColorSelect.value = 'pleco'; // Default
    }
  });

  toneColorSelect.addEventListener('change', () => {
    const scheme = toneColorSelect.value;
    chrome.storage.local.set({ toneColorScheme: scheme });

    // Send to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'changeToneColors',
          scheme: scheme
        });
      }
    });
  });

  // Reset position button
  resetPositionBtn.addEventListener('click', () => {
    // Send to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'resetPosition'
        });
      }
    });
  });

  // Update status message
  function updateStatus(message, type = '') {
    status.textContent = message;
    status.className = 'status ' + type;
    // Show status only for errors
    if (type === 'error') {
      status.style.display = 'block';
    } else {
      status.style.display = 'none';
    }
  }

  // Load available subtitles from content script
  let retryCount = 0;
  const maxRetries = 10;

  function loadSubtitles() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        updateStatus('No active tab', 'error');
        return;
      }

      // Check if tab URL is a Youku video page
      const url = tabs[0].url;
      if (!url || !url.startsWith('https://www.youku.tv/v/v_show/')) {
        updateStatus('Not a Youku video page', 'error');
        secondSelect.innerHTML = '<option value="">Not on a Youku video page</option>';
        secondSelect.disabled = true;
        chineseVariantSelect.disabled = true;
        fontDecrease.disabled = true;
        fontIncrease.disabled = true;
        pinyinToggle.disabled = true;
        return;
      }

      // Request subtitle list from content script
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getSubtitles' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Message error:', chrome.runtime.lastError.message);
          updateStatus('Extension not loaded on page', 'error');
          select.innerHTML = '<option value="">Reload page and try again</option>';
          return;
        }

        if (response && response.subtitles && response.subtitles.length > 0) {
          availableSubtitles = response.subtitles;
          populateSelect(response.subtitles);
          updateStatus('Select a language', 'success');

          // Load saved preference
          loadSavedPreference();
        } else if (retryCount < maxRetries) {
          // Subtitles not loaded yet, retry
          retryCount++;
          updateStatus(`Waiting for video... (${retryCount}/${maxRetries})`, 'loading');
          setTimeout(loadSubtitles, 1000);
        } else {
          updateStatus('No subtitles found', 'error');
          select.innerHTML = '<option value="">No subtitles available</option>';
        }
      });
    });
  }

  // Populate select dropdown (exclude Chinese languages - they're fixed)
  function populateSelect(subtitles) {
    secondSelect.innerHTML = '<option value="">Select language...</option>';

    // Filter out Chinese subtitles (chs, cht) as they're fixed
    const nonChineseSubtitles = subtitles.filter(sub =>
      sub.code !== 'chs' && sub.code !== 'cht'
    );

    nonChineseSubtitles.forEach(sub => {
      const option = document.createElement('option');
      option.value = sub.code;
      option.textContent = sub.name;
      option.dataset.url = sub.url;
      secondSelect.appendChild(option);
    });

    // Default to English if available
    if (nonChineseSubtitles.find(s => s.code === 'en')) {
      secondSelect.value = 'en';
    }
  }

  // Load saved preference
  function loadSavedPreference() {
    chrome.storage.local.get(['secondSubtitleCode'], (result) => {
      if (result.secondSubtitleCode) {
        secondSelect.value = result.secondSubtitleCode;
      }
    });
  }

  // Handle selection change
  secondSelect.addEventListener('change', () => {
    const selectedCode = secondSelect.value;
    const selectedOption = secondSelect.options[secondSelect.selectedIndex];

    if (!selectedCode) {
      // No subtitle selected
      updateStatus('Only showing Chinese', 'success');
      chrome.storage.local.set({ secondSubtitleCode: '' });

      // Tell content script to hide second subtitle
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'setSubtitle',
          code: '',
          url: ''
        });
      });
    } else {
      // Subtitle selected
      const url = selectedOption.dataset.url;
      updateStatus('Loading ' + selectedOption.textContent + '...', 'loading');

      // Save preference
      chrome.storage.local.set({ secondSubtitleCode: selectedCode });

      // Tell content script to load subtitle
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'setSubtitle',
          code: selectedCode,
          url: url
        }, (response) => {
          if (response && response.success) {
            updateStatus(selectedOption.textContent + ' loaded', 'success');
          } else {
            updateStatus('Failed to load subtitle', 'error');
          }
        });
      });
    }
  });

  // Initialize
  loadSubtitles();
})();
