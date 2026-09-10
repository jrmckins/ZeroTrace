/**
 * ZeroTrace
 * Background Service Worker
 *
 * Handles:
 * - Side Panel behavior
 * - Deletion state
 * - Facebook cleanup after page reloads
 */

console.log('[ZeroTrace] Background service worker loaded');

// ============================================================================
// SIDE PANEL
// ============================================================================

chrome.runtime.onInstalled.addListener(async () => {
  try {
    await chrome.sidePanel.setPanelBehavior({
      openPanelOnActionClick: true
    });

    console.log(
      '[ZeroTrace] Side Panel configured to open when extension icon is clicked.'
    );
  } catch (error) {
    console.error(
      '[ZeroTrace] Failed to configure Side Panel:',
      error
    );
  }
});

// Also configure immediately when the service worker starts.

(async () => {
  try {
    await chrome.sidePanel.setPanelBehavior({
      openPanelOnActionClick: true
    });

    console.log(
      '[ZeroTrace] Side Panel behavior initialized.'
    );
  } catch (error) {
    console.error(
      '[ZeroTrace] Could not initialize Side Panel behavior:',
      error
    );
  }
})();

// ============================================================================
// MESSAGES FROM SIDE PANEL / PLATFORM SCRIPTS
// ============================================================================

chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {

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
  }
);

// ============================================================================
// AUTO-RESUME FACEBOOK CLEANUP AFTER PAGE RELOAD
// ============================================================================

chrome.tabs.onUpdated.addListener(
  async (tabId, changeInfo, tab) => {

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
      'deletePlatform',
      'unlimitedDeletion'
    ]);

    const activePlatformId =
      data.currentPlatform ||
      data.deletePlatform ||
      'facebook';

    // Only resume Facebook deletion.
    //
    // unlimitedDeletion is true for paid users.
    if (
      !data.isDeleting ||
      activePlatformId !== 'facebook' ||
      data.unlimitedDeletion !== true
    ) {
      return;
    }

    console.log(
      '[ZeroTrace] Paid Facebook user page loaded/reloaded while deletion is active. ' +
      'Resuming cleanup...'
    );

    setTimeout(async () => {
      try {

        // ------------------------------------------------------------
        // Inject Facebook platform module
        // ------------------------------------------------------------

        await chrome.scripting.executeScript({
          target: {
            tabId: tabId
          },
          files: [
            'platforms/facebook.js'
          ]
        });

        // ------------------------------------------------------------
        // Start Facebook cleanup
        // ------------------------------------------------------------

        await chrome.scripting.executeScript({
          target: {
            tabId: tabId
          },
          func: (
            type,
            excludeOwnPosts
          ) => {

            if (
              typeof FacebookPlatform !==
              'undefined'
            ) {

              const cleanupFunc =
                FacebookPlatform
                  .getCleanupFunction();

              cleanupFunc(
                type,
                excludeOwnPosts
              );

            } else {

              console.error(
                '[ZeroTrace] FacebookPlatform object not found after injection.'
              );
            }
          },
          args: [
            data.deleteType ||
              'comments',

            data.excludeOwnPosts ||
              false
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
  }
);
