/**
 * Facebook Platform Implementation
 *
 * ZeroTrace
 * Handles bulk deletion of Facebook comments and reactions.
 */

window.FacebookPlatform = window.FacebookPlatform || {
  id: 'facebook',
  name: 'Facebook',
  domain: 'facebook.com',

  getUrls() {
    return {
      comments:
        'https://www.facebook.com/me/allactivity?activity_history=false&category_key=COMMENTSCLUSTER',

      reactions:
        'https://www.facebook.com/me/allactivity?activity_history=false&category_key=LIKEDPOSTS'
    };
  },

  getPageDetection() {
    return {
      comments: (url) =>
        url.includes('facebook.com') &&
        url.includes('allactivity') &&
        url.includes('COMMENTSCLUSTER'),

      reactions: (url) =>
        url.includes('facebook.com') &&
        url.includes('allactivity') &&
        url.includes('LIKEDPOSTS'),

      anyActivity: (url) =>
        url.includes('facebook.com') &&
        url.includes('allactivity'),

      onSite: (url) =>
        url.includes('facebook.com')
    };
  },

  requiresManualNavigation() {
    return false;
  },

  getManualNavigationInstructions(type) {
    return '';
  },

  getCleanupFunction() {
    return async function cleanupActivities(type, excludeOwnPosts) {

      const initialStorage =
        await chrome.storage.local.get(['deleteCounter']);

      let deletedCount =
        initialStorage.deleteCounter || 0;

      let noChangeCount = 0;

      const maxNoChangeAttempts = 20;

      window.stopDeleting = false;

      const wait = (ms) =>
        new Promise(resolve => setTimeout(resolve, ms));

      // ============================================================
      // POPUP COMMUNICATION
      // ============================================================

      function updatePopup(count, finished = false) {
        try {
          chrome.runtime.sendMessage({
            type: finished
              ? 'finished'
              : 'updateCounter',

            count: count
          });
        } catch (e) {}
      }

      // ============================================================
      // VISIBILITY
      // ============================================================

      function isVisible(element) {
        if (!element) return false;

        const rect =
          element.getBoundingClientRect();

        const style =
          window.getComputedStyle(element);

        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden'
        );
      }

      // ============================================================
      // CLICK HELPER
      // ============================================================

      function clickElement(element) {
        if (!element) return false;

        try {
          element.scrollIntoView({
            behavior: 'instant',
            block: 'center'
          });
        } catch (e) {}

        try {
          element.dispatchEvent(
            new MouseEvent('mousedown', {
              bubbles: true,
              cancelable: true,
              view: window
            })
          );

          element.dispatchEvent(
            new MouseEvent('mouseup', {
              bubbles: true,
              cancelable: true,
              view: window
            })
          );

          element.click();

          return true;

        } catch (e) {

          try {
            element.click();
            return true;
          } catch (e2) {
            return false;
          }
        }
      }

      // ============================================================
      // FIND FACEBOOK "ALL" CHECKBOX
      // ============================================================

      function findSelectAllCheckbox() {

        // Primary Facebook selector
        const checkbox =
          document.querySelector(
            'input[name="comet_activity_log_select_all_checkbox"]'
          );

        if (checkbox && isVisible(checkbox)) {
          return checkbox;
        }

        // Fallback: look for visible checkbox inputs
        const checkboxes =
          Array.from(
            document.querySelectorAll(
              'input[type="checkbox"]'
            )
          );

        for (const candidate of checkboxes) {

          if (!isVisible(candidate)) {
            continue;
          }

          const ariaLabel =
            (
              candidate.getAttribute('aria-label') ||
              ''
            ).toLowerCase();

          const parentText =
            (
              candidate.parentElement?.textContent ||
              ''
            ).trim().toLowerCase();

          if (
            ariaLabel === 'all' ||
            ariaLabel.includes('select all') ||
            parentText === 'all'
          ) {
            return candidate;
          }
        }

        return null;
      }

      // ============================================================
      // FIND BULK REMOVE BUTTON
      // ============================================================

      function findVisibleRemoveControls() {

        const candidates =
          Array.from(
            document.querySelectorAll(
              '[role="button"], button, [tabindex="0"]'
            )
          );

        return candidates.filter(element => {

          if (!isVisible(element)) {
            return false;
          }

          const text =
            element.textContent
              .trim()
              .replace(/\s+/g, ' ')
              .toLowerCase();

          return (
            text === 'remove' ||
            text === 'delete'
          );
        });
      }

      // ============================================================
      // WAIT FOR CHECKBOX STATE
      // ============================================================

      async function waitForCheckboxChecked(
        checkbox,
        timeout = 5000
      ) {

        const start =
          Date.now();

        while (
          Date.now() - start <
          timeout
        ) {

          if (
            checkbox &&
            checkbox.checked
          ) {
            return true;
          }

          await wait(250);
        }

        return false;
      }

      // ============================================================
      // BULK DELETE COMMENTS
      // ============================================================

      async function bulkDeleteComments() {

        console.log(
          'ZeroTrace: Starting Facebook bulk comment deletion'
        );

        while (!window.stopDeleting) {

          const checkbox =
            findSelectAllCheckbox();

          if (!checkbox) {

            noChangeCount++;

            console.log(
              `ZeroTrace: "All" checkbox not found (${noChangeCount}/${maxNoChangeAttempts})`
            );

            if (
              noChangeCount >=
              maxNoChangeAttempts
            ) {

              updatePopup(
                deletedCount,
                true
              );

              await chrome.storage.local.set({
                isDeleting: false
              });

              alert(
                `Completed! Deleted ${deletedCount} comments.`
              );

              return;
            }

            await wait(1500);

            continue;
          }

          noChangeCount = 0;

          // --------------------------------------------------------
          // SELECT ALL
          // --------------------------------------------------------

          if (!checkbox.checked) {

            console.log(
              'ZeroTrace: Clicking All'
            );

            if (
              !clickElement(checkbox)
            ) {

              await wait(1000);
              continue;
            }

            const checked =
              await waitForCheckboxChecked(
                checkbox
              );

            if (!checked) {

              console.log(
                'ZeroTrace: All checkbox did not become checked'
              );

              await wait(1000);
              continue;
            }
          }

          // --------------------------------------------------------
          // FIND REMOVE
          // --------------------------------------------------------

          const removeButtons =
            findVisibleRemoveControls();

          console.log(
            `ZeroTrace: Found ${removeButtons.length} visible Remove control(s)`
          );

          if (
            removeButtons.length === 0
          ) {

            await wait(1500);
            continue;
          }

          // --------------------------------------------------------
          // CLICK BULK REMOVE
          // --------------------------------------------------------

          console.log(
            'ZeroTrace: Clicking bulk Remove'
          );

          if (
            !clickElement(
              removeButtons[0]
            )
          ) {

            await wait(1000);
            continue;
          }

          await wait(1200);

          // --------------------------------------------------------
          // CONFIRM REMOVE
          // --------------------------------------------------------

          const confirmButtons =
            findVisibleRemoveControls();

          if (
            confirmButtons.length === 0
          ) {

            console.log(
              'ZeroTrace: Confirmation Remove not found'
            );

            await wait(1000);
            continue;
          }

          const confirmButton =
            confirmButtons[
              confirmButtons.length - 1
            ];

          console.log(
            'ZeroTrace: Clicking confirmation Remove'
          );

          if (
            !clickElement(
              confirmButton
            )
          ) {

            await wait(1000);
            continue;
          }

          await wait(2500);

          deletedCount++;

          updatePopup(
            deletedCount
          );

          await chrome.storage.local.set({
            deleteCounter: deletedCount
          });

          console.log(
            `ZeroTrace: Completed bulk comment removal operation #${deletedCount}. Reloading page...`
          );

          window.location.reload();

          return;
        }

        alert(
          `Deletion stopped. Completed ${deletedCount} bulk removal operations.`
        );
      }

      // ============================================================
      // BULK DELETE REACTIONS
      //
      // Facebook's Likes and reactions page has the same
      // "All" selection mechanism. We deliberately do NOT
      // process individual "More options" menus anymore.
      // ============================================================

      async function bulkDeleteReactions() {

        console.log(
          'ZeroTrace: Starting Facebook BULK reaction deletion'
        );

        while (!window.stopDeleting) {

          // --------------------------------------------------------
          // FIND "ALL"
          // --------------------------------------------------------

          const checkbox =
            findSelectAllCheckbox();

          if (!checkbox) {

            noChangeCount++;

            console.log(
              `ZeroTrace: Reaction "All" checkbox not found (${noChangeCount}/${maxNoChangeAttempts})`
            );

            if (
              noChangeCount >=
              maxNoChangeAttempts
            ) {

              updatePopup(
                deletedCount,
                true
              );

              await chrome.storage.local.set({
                isDeleting: false
              });

              alert(
                `Completed! Deleted ${deletedCount} reactions.`
              );

              return;
            }

            await wait(1500);

            continue;
          }

          noChangeCount = 0;

          // --------------------------------------------------------
          // SELECT ALL REACTIONS
          // --------------------------------------------------------

          if (!checkbox.checked) {

            console.log(
              'ZeroTrace: Selecting ALL reactions'
            );

            if (
              !clickElement(checkbox)
            ) {

              console.log(
                'ZeroTrace: Failed to click All checkbox'
              );

              await wait(1000);
              continue;
            }

            const checked =
              await waitForCheckboxChecked(
                checkbox,
                6000
              );

            if (!checked) {

              console.log(
                'ZeroTrace: All reactions checkbox did not become checked'
              );

              await wait(1000);
              continue;
            }

            console.log(
              'ZeroTrace: ALL reactions selected'
            );
          }

          // Give Facebook time to update
          // the bulk action toolbar.
          await wait(1000);

          // --------------------------------------------------------
          // FIND BULK REMOVE
          // --------------------------------------------------------

          const removeButtons =
            findVisibleRemoveControls();

          console.log(
            `ZeroTrace: Found ${removeButtons.length} Remove control(s) after selecting ALL`
          );

          if (
            removeButtons.length === 0
          ) {

            console.log(
              'ZeroTrace: Bulk Remove button has not appeared yet'
            );

            await wait(1500);
            continue;
          }

          // --------------------------------------------------------
          // CLICK BULK REMOVE
          // --------------------------------------------------------

          console.log(
            'ZeroTrace: Clicking bulk Remove for reactions'
          );

          if (
            !clickElement(
              removeButtons[0]
            )
          ) {

            console.log(
              'ZeroTrace: Failed to click bulk Remove'
            );

            await wait(1000);
            continue;
          }

          await wait(1500);

          // --------------------------------------------------------
          // CONFIRM REMOVE
          // --------------------------------------------------------

          const confirmButtons =
            findVisibleRemoveControls();

          if (
            confirmButtons.length === 0
          ) {

            console.log(
              'ZeroTrace: Reaction confirmation Remove not found'
            );

            await wait(1000);
            continue;
          }

          const confirmButton =
            confirmButtons[
              confirmButtons.length - 1
            ];

          console.log(
            'ZeroTrace: Clicking reaction confirmation Remove'
          );

          if (
            !clickElement(
              confirmButton
            )
          ) {

            console.log(
              'ZeroTrace: Failed to click reaction confirmation'
            );

            await wait(1000);
            continue;
          }

          // --------------------------------------------------------
          // WAIT FOR FACEBOOK TO PROCESS
          // --------------------------------------------------------

          await wait(3000);

          deletedCount++;

          updatePopup(
            deletedCount
          );

          await chrome.storage.local.set({
            deleteCounter: deletedCount
          });

          console.log(
            `ZeroTrace: Completed bulk reaction removal operation #${deletedCount}`
          );

          // Facebook rebuilds the activity list after
          // bulk deletion. Reload to get the next batch.
          console.log(
            'ZeroTrace: Reloading Facebook reactions page...'
          );

          window.location.reload();

          return;
        }

        alert(
          `Deletion stopped. Completed ${deletedCount} bulk reaction operations.`
        );
      }

      // ============================================================
      // START CLEANUP
      // ============================================================

      if (type === 'comments') {

        bulkDeleteComments().catch(err => {

          console.error(
            'ZeroTrace Facebook bulk comment deletion error:',
            err
          );

          alert(
            `Error occurred: ${err.message}`
          );
        });

      } else if (type === 'reactions') {

        // IMPORTANT:
        // Reactions now use Facebook's "All" option.
        // They are NOT deleted individually.

        bulkDeleteReactions().catch(err => {

          console.error(
            'ZeroTrace Facebook bulk reaction deletion error:',
            err
          );

          alert(
            `Error occurred: ${err.message}`
          );
        });

      } else {

        console.error(
          `ZeroTrace: Unknown Facebook cleanup type: ${type}`
        );

        alert(
          `Unknown cleanup type: ${type}`
        );
      }
    };
  }
};
// Register Facebook with the ZeroTrace platform registry
if (typeof PlatformRegistry !== 'undefined') {
  PlatformRegistry.register(window.FacebookPlatform);
}
