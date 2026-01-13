// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2025-2026 Daniel Sangorrin
//
// Youku Dual Subtitle - Bridge Script
// Runs in ISOLATED world to handle chrome API communication
// Bridges between popup (chrome.runtime messages) and content.js (window.postMessage)

(function() {
  'use strict';


  // Listen for messages from MAIN world (dictionary requests)
  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== 'youku-dual-subtitle-main') return;

    // Handle initial settings sync request
    if (data.action === 'syncSettingsFromChromeStorage') {
      try {
        const settings = await chrome.storage.local.get(['subtitleFontSize', 'showPinyin', 'toneColorScheme', 'chineseVariant', 'autoPauseEnabled', 'secondSubtitleCode']);

        // Sync each setting to localStorage via postMessage (with defaults)
        const fontSize = settings.subtitleFontSize || 36;
        window.postMessage({
          source: 'youku-dual-subtitle-bridge',
          action: 'syncStorage',
          storageKey: 'youku-dual-subtitle-fontsize',
          storageValue: fontSize.toString()
        }, '*');

        const showPinyin = settings.showPinyin !== undefined ? settings.showPinyin : true;
        window.postMessage({
          source: 'youku-dual-subtitle-bridge',
          action: 'syncStorage',
          storageKey: 'youku-dual-subtitle-pinyin',
          storageValue: showPinyin.toString()
        }, '*');

        const toneColorScheme = settings.toneColorScheme || 'pleco';
        window.postMessage({
          source: 'youku-dual-subtitle-bridge',
          action: 'syncStorage',
          storageKey: 'youku-dual-subtitle-tone-colors',
          storageValue: toneColorScheme
        }, '*');

        const chineseVariant = settings.chineseVariant || 'simplified';
        window.postMessage({
          source: 'youku-dual-subtitle-bridge',
          action: 'syncStorage',
          storageKey: 'youku-dual-subtitle-chinese-variant',
          storageValue: chineseVariant
        }, '*');

        const autoPauseEnabled = settings.autoPauseEnabled !== undefined ? settings.autoPauseEnabled : false;
        window.postMessage({
          source: 'youku-dual-subtitle-bridge',
          action: 'syncStorage',
          storageKey: 'youku-dual-subtitle-auto-pause',
          storageValue: autoPauseEnabled.toString()
        }, '*');

        // Sync second subtitle language preference
        const secondSubtitleCode = settings.secondSubtitleCode || 'en';
        window.postMessage({
          source: 'youku-dual-subtitle-bridge',
          action: 'syncStorage',
          storageKey: 'youku-dual-subtitle-second-language',
          storageValue: secondSubtitleCode
        }, '*');
      } catch (error) {
        console.error('%c[Bridge] Failed to sync settings:', 'color: #ff0000', error);
      }
      return;
    }

    // Handle auto-pause sync from keyboard shortcut
    if (data.action === 'syncAutoPauseToStorage') {
      try {
        await chrome.storage.local.set({ autoPauseEnabled: data.autoPauseEnabled });
      } catch (error) {
        console.error('%c[Bridge] Failed to sync auto-pause to storage:', 'color: #ff0000', error);
      }
      return;
    }

    // Handle dictionary requests
    if (data.action === 'dictionaryRequest') {

      try {
        // Check if extension context is still valid
        if (!chrome.runtime?.id) {
          throw new Error('Extension context invalidated');
        }

        // Forward to background service worker
        const response = await chrome.runtime.sendMessage({
          type: data.type,
          text: data.text
        });

        // Send response back to MAIN world
        window.postMessage({
          source: 'youku-dual-subtitle-bridge',
          action: 'dictionaryResponse',
          requestId: data.requestId,
          result: response
        }, '*');
      } catch (error) {
        // Only log the error once if it's the first time seeing context invalidation
        const isContextInvalidated = error.message && (
          error.message.includes('Extension context invalidated') ||
          error.message.includes('message port closed')
        );

        if (isContextInvalidated && !window.__youku_extension_context_invalidated) {
          window.__youku_extension_context_invalidated = true;
          // Silently disable dictionary lookups without console warning

          // Show a user-friendly notification (only once per page load)
          const showNotification = () => {
            const notification = document.createElement('div');
            notification.id = 'youku-extension-reload-notification';
            notification.style.cssText = `
              position: fixed !important;
              top: 20px !important;
              left: 50% !important;
              transform: translateX(-50%) !important;
              background: rgba(255, 152, 0, 0.95) !important;
              color: white !important;
              padding: 15px 25px !important;
              border-radius: 8px !important;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif !important;
              font-size: 14px !important;
              font-weight: 500 !important;
              z-index: 2147483647 !important;
              box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
              text-align: center !important;
              cursor: pointer !important;
            `;
            notification.textContent = '🔄 Dictionary disabled - Reload page (F5) to re-enable';
            notification.title = 'Click to dismiss';

            // Remove any existing notification
            const existing = document.getElementById('youku-extension-reload-notification');
            if (existing) existing.remove();

            // Click to dismiss
            notification.addEventListener('click', () => notification.remove());

            document.body.appendChild(notification);

            // Auto-remove after 8 seconds
            setTimeout(() => {
              if (notification.parentElement) {
                notification.remove();
              }
            }, 8000);
          };

          // Ensure document.body exists
          if (document.body) {
            showNotification();
          } else {
            document.addEventListener('DOMContentLoaded', showNotification);
          }
        } else if (!isContextInvalidated) {
          // Log other errors normally
          console.error('%c[Bridge] Dictionary request error:', 'color: #ff0000', error);
        }

        window.postMessage({
          source: 'youku-dual-subtitle-bridge',
          action: 'dictionaryResponse',
          requestId: data.requestId,
          result: null
        }, '*');
      }
    }
  });

  // Listen for messages from popup via chrome.runtime
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    // Sync language preference to localStorage if setting subtitle
    if (message.action === 'setSubtitle') {
      // Send the language code through postMessage so MAIN world script can save it
      window.postMessage({
        source: 'youku-dual-subtitle-bridge',
        action: 'syncStorage',
        storageKey: 'youku-dual-subtitle-language',
        storageValue: message.code || ''
      }, '*');
    }

    // Create a one-time listener for the response from MAIN world
    const responseHandler = (event) => {
      if (event.source !== window) return;

      const data = event.data;
      if (!data || data.source !== 'youku-dual-subtitle-main') return;
      if (data.action !== message.action) return;


      // Remove this listener
      window.removeEventListener('message', responseHandler);

      // Send response back to popup
      if (data.action === 'getSubtitles') {
        sendResponse({ subtitles: data.subtitles || [] });
      } else if (data.action === 'setSubtitle') {
        sendResponse({ success: data.success || false });
      }
    };

    // Add listener for response
    window.addEventListener('message', responseHandler);

    // Forward message to MAIN world content script
    window.postMessage({
      source: 'youku-dual-subtitle-bridge',
      action: message.action,
      code: message.code,
      url: message.url,
      fontSize: message.fontSize,
      showPinyin: message.showPinyin,
      autoPauseEnabled: message.autoPauseEnabled,
      scheme: message.scheme,
      variant: message.variant
    }, '*');

    // Set timeout to prevent hanging
    setTimeout(() => {
      window.removeEventListener('message', responseHandler);
    }, 5000);

    // Return true to indicate async response
    return true;
  });

})();
