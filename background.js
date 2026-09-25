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

    if (message.type === 'startFacebookTrashCleanup') {
      const tabId = sender.tab && sender.tab.id;

      console.log(
        '[ZeroTrace] Received Facebook Trash cleanup request.',
        { tabId }
      );

      if (!tabId) {
        return;
      }

      chrome.storage.local.set({
        facebookTrashCleanupTabId: tabId
      }).then(() =>
        chrome.tabs.update(tabId, {
          url: 'https://www.facebook.com/me/allactivity/?activity_history=false&category_key=TRASH&manage_mode=true&should_load_landing_page=false'
        }).then(() =>
          console.log(
            '[ZeroTrace] Navigating tab to Facebook All Activity.',
            { tabId }
          )
        )
      ).then(() => {
        sendResponse({ started: true });
      }).catch(error => {
        console.error(
          '[ZeroTrace] Could not navigate to Facebook Trash:',
          error
        );
        sendResponse({
          started: false,
          error: error.message
        });
      });

      // Keep the service worker message event alive while storage and the
      // navigation request complete, so the following tab-load injection can run.
      return true;
    }

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
      'unlimitedDeletion',
      'facebookTrashCleanupTabId'
    ]);

    if (
      data.facebookTrashCleanupTabId === tabId &&
      tab.url.includes('/allactivity') &&
      tab.url.includes('category_key=TRASH')
    ) {
      console.log(
        '[ZeroTrace] Facebook All Activity loaded; injecting Trash cleanup.',
        { tabId, url: tab.url }
      );

      await chrome.storage.local.remove(
        'facebookTrashCleanupTabId'
      );

      try {
        await chrome.scripting.executeScript({
            target: { tabId },
            func: async () => {
              console.log(
                '[ZeroTrace] Facebook Trash page script started.',
                { url: location.href }
              );

              const wait = ms =>
                new Promise(resolve => setTimeout(resolve, ms));

              const normalize = value =>
                (value || '').trim().replace(/\s+/g, ' ').toLowerCase();

              const visible = element => {
                if (!element) return false;
                const rect = element.getBoundingClientRect();
                const style = getComputedStyle(element);
                return rect.width > 0 && rect.height > 0 &&
                  style.display !== 'none' && style.visibility !== 'hidden';
              };

              const click = element => {
                if (!element) return false;
                element.scrollIntoView({ behavior: 'instant', block: 'center' });

                const rect = element.getBoundingClientRect();
                const x = rect.left + rect.width / 2;
                const y = rect.top + rect.height / 2;
                const target = document.elementFromPoint(x, y);
                const hitTarget = target && element.contains(target)
                  ? target
                  : element;

                const mouse = (type, buttons = 0) =>
                  hitTarget.dispatchEvent(new MouseEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    view: window,
                    clientX: x,
                    clientY: y,
                    button: 0,
                    buttons
                  }));

                const pointer = (type, buttons = 0) =>
                  hitTarget.dispatchEvent(new PointerEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    view: window,
                    clientX: x,
                    clientY: y,
                    pointerId: 1,
                    pointerType: 'mouse',
                    isPrimary: true,
                    button: 0,
                    buttons
                  }));

                pointer('pointerover');
                mouse('mouseover');
                pointer('pointerdown', 1);
                mouse('mousedown', 1);
                mouse('mouseup');
                pointer('pointerup');
                mouse('click');
                return true;
              };

              async function findUntil(find, timeout = 20000) {
                const started = Date.now();
                while (Date.now() - started < timeout) {
                  const element = find();
                  if (element) return element;
                  await wait(300);
                }
                return null;
              }

              console.log(
                '[ZeroTrace] Opened the direct Facebook Trash URL; waiting for its controls.'
              );

              const allCheckbox = await findUntil(() => {
                const named = document.querySelector(
                  'input[name="comet_activity_log_select_all_checkbox"]'
                );
                if (named) return named;

                const checkbox = Array.from(document.querySelectorAll(
                  'input[type="checkbox"]'
                )).find(input => {
                  const label = normalize(input.getAttribute('aria-label'));
                  const parentText = normalize(input.parentElement?.textContent);
                  return label === 'all' || label.includes('select all') || parentText === 'all';
                });

                if (checkbox) {
                  return visible(checkbox)
                    ? checkbox
                    : checkbox.labels?.[0] || checkbox.parentElement;
                }

                const allLabel = Array.from(
                  document.querySelectorAll('span, [aria-label]')
                ).find(element =>
                  visible(element) && (
                    normalize(element.textContent) === 'all' ||
                    normalize(element.getAttribute('aria-label')) === 'all'
                  )
                );

                if (!allLabel) return null;

                return allLabel.closest(
                  '[role="checkbox"], label, [role="button"], button, [tabindex="0"]'
                ) || allLabel;
              });

              if (!allCheckbox) {
                console.error('[ZeroTrace] Facebook Trash "All" checkbox was not found.');
                return;
              }

              console.log('[ZeroTrace] Found the Facebook Trash "All" checkbox.');

              const isChecked = element => {
                if (element.checked === true) return true;

                const control = element.control ||
                  element.querySelector?.('input[type="checkbox"]') ||
                  element.querySelector?.('[role="checkbox"]');

                return control?.checked === true ||
                  control?.getAttribute('aria-checked') === 'true' ||
                  element.getAttribute('aria-checked') === 'true';
              };

              if (!isChecked(allCheckbox)) {
                const nativeCheckbox = allCheckbox.matches?.(
                  'input[type="checkbox"]'
                )
                  ? allCheckbox
                  : allCheckbox.control ||
                    allCheckbox.querySelector?.('input[type="checkbox"]');

                if (nativeCheckbox) {
                  nativeCheckbox.click();
                } else {
                  click(allCheckbox);
                }
              }

              const checkboxChecked = await findUntil(() =>
                isChecked(allCheckbox) ? allCheckbox : null
              );

              if (!checkboxChecked) {
                console.error('[ZeroTrace] Could not select all Facebook Trash items.');
                return;
              }

              const deleteButton = await findUntil(() =>
                Array.from(document.querySelectorAll(
                  '[role="button"], button, [tabindex="0"]'
                )).find(element =>
                  visible(element) && normalize(element.textContent) === 'delete'
                )
              );

              if (!deleteButton || !click(deleteButton)) {
                console.error('[ZeroTrace] Facebook Trash "Delete" button was not found.');
                return;
              }

              const deleteConfirmation = await findUntil(() => {
                const dialogs = Array.from(document.querySelectorAll(
                  '[role="dialog"], [aria-modal="true"]'
                )).filter(visible);

                for (const dialog of dialogs) {
                  const text = normalize(dialog.textContent);
                  if (!text.includes('items you delete can\'t be restored')) {
                    continue;
                  }

                  const confirmButton = Array.from(dialog.querySelectorAll(
                    '[role="button"], button, [tabindex="0"]'
                  )).find(element =>
                    visible(element) &&
                    normalize(element.textContent) === 'delete'
                  );

                  if (confirmButton) return confirmButton;
                }

                return null;
              });

              if (!deleteConfirmation) {
                console.error('[ZeroTrace] Facebook permanent-delete confirmation was not found.');
                return;
              }

              if (!click(deleteConfirmation)) {
                console.error('[ZeroTrace] Could not click the Facebook permanent-delete confirmation.');
                return;
              }

              console.log('[ZeroTrace] Confirmed permanent deletion of selected Facebook Trash items.');
            }
        });

        console.log(
          '[ZeroTrace] Facebook Trash page script injection completed.',
          { tabId }
        );
      } catch (error) {
        console.error('[ZeroTrace] Facebook Trash cleanup failed:', error);
      }

      return;
    }

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
