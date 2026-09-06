/**
 * Background Service Worker
 * Handles deletion state and Facebook cleanup after page reloads.
 */

console.log('[ZeroTrace] Background service worker loaded');

// Listen for messages from popup or platform scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'updateCounter') {
    chrome.storage.local.set({
      deleteCounter: message.count
    });

    return;
  }

  if (message.type === 'finished') {
    chrome.storage.local.set({
      deleteCounter: message.count,
      isDeleting: false
    });

    return;
  }
});

// Auto-resume Facebook cleanup after page reload
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (
    changeInfo.status !== 'complete' ||
    !tab ||
    !tab.url ||
    !tab.url.includes('facebook.com')
  ) {
    return;
  }

  const data = await chrome.storage.local.get([
    'isDeleting',
    'deleteType',
    'excludeOwnPosts',
    'currentPlatform',
    'deletePlatform'
  ]);

  const activePlatformId =
    data.currentPlatform || data.deletePlatform || 'facebook';

  // Only resume Facebook deletion.
  // Twitter/X cleanup is handled directly by popup.js.
  if (!data.isDeleting || activePlatformId !== 'facebook') {
    return;
  }

  console.log(
    '[ZeroTrace] Facebook page loaded/reloaded while deletion is active. ' +
    'Resuming cleanup...'
  );

  setTimeout(async () => {
    try {
      // Inject Facebook platform module
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['platforms/facebook.js']
      });

      // Start Facebook cleanup
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (type, excludeOwnPosts) => {
          if (typeof FacebookPlatform !== 'undefined') {
            const cleanupFunc = FacebookPlatform.getCleanupFunction();

            cleanupFunc(type, excludeOwnPosts);
          } else {
            console.error(
              '[ZeroTrace] FacebookPlatform object not found after injection.'
            );
          }
        },
        args: [
          data.deleteType || 'comments',
          data.excludeOwnPosts || false
        ]
      });

      console.log(
        '[ZeroTrace] Successfully resumed Facebook cleanup script.'
      );

    } catch (error) {
      console.error(
        '[ZeroTrace] Error resuming Facebook cleanup script:',
        error
      );
    }
  }, 3000);
});
