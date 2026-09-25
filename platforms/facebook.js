/**
 * Facebook Platform Implementation
 *
 * ZeroTrace
 * Handles deletion of Facebook posts, comments, and reactions.
 */

window.FacebookPlatform = window.FacebookPlatform || {
  id: 'facebook',
  name: 'Facebook',
  domain: 'facebook.com',

  async getUrls(tab) {
    return {
      posts: null,
      comments:
        'https://www.facebook.com/me/allactivity?activity_history=false&category_key=COMMENTSCLUSTER',
      reactions:
        'https://www.facebook.com/me/allactivity?activity_history=false&category_key=LIKEDPOSTS'
    };
  },

  async navigateToPosts(tab) {
    if (!tab || !tab.id) {
      throw new Error('Could not find active tab');
    }

    console.log(
      '[ZeroTrace] Navigating to Facebook profile...'
    );

    const previousUrl = tab.url || '';

    await chrome.tabs.update(tab.id, {
      url: 'https://www.facebook.com/me'
    });

    console.log(
      '[ZeroTrace] Waiting for Facebook profile to load...'
    );

    for (let i = 0; i < 30; i++) {
      try {
        const currentTab =
          await chrome.tabs.get(tab.id);

        const urlChanged =
          !previousUrl ||
          currentTab.url !== previousUrl;

        const looksLikeFacebook =
          !!currentTab.url &&
          currentTab.url.includes('facebook.com');

        if (
          currentTab.status === 'complete' &&
          urlChanged &&
          looksLikeFacebook
        ) {
          break;
        }
      } catch (error) {
        console.warn(
          '[ZeroTrace] Could not check Facebook tab status:',
          error
        );
      }

      await new Promise(resolve =>
        setTimeout(resolve, 500)
      );
    }

    await new Promise(resolve =>
      setTimeout(resolve, 2000)
    );

    console.log(
      '[ZeroTrace] Facebook profile navigation complete. Ready for individual post deletion.'
    );

    return true;
  },

  getPageDetection() {
    return {
      posts: url =>
        url.includes('facebook.com') &&
        !url.includes('allactivity'),

      comments: url =>
        url.includes('facebook.com') &&
        url.includes('allactivity') &&
        url.includes('COMMENTSCLUSTER'),

      reactions: url =>
        url.includes('facebook.com') &&
        url.includes('allactivity') &&
        url.includes('LIKEDPOSTS'),

      anyActivity: url =>
        url.includes('facebook.com') &&
        url.includes('allactivity'),

      onSite: url =>
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
    return async function cleanupActivities(
      type,
      excludeOwnPosts
    ) {
      console.log(
        '[ZeroTrace] ===== FACEBOOK CLEANUP FUNCTION STARTED =====',
        {
          type,
          excludeOwnPosts
        }
      );

      const initialStorage =
        await chrome.storage.local.get([
          'deleteCounter',
          'unlimitedDeletion'
        ]);

      let deletedCount =
        initialStorage.deleteCounter || 0;

      const unlimitedDeletion =
        initialStorage.unlimitedDeletion === true;

      console.log(
        '[ZeroTrace] Facebook deletion mode:',
        unlimitedDeletion
          ? 'PAID / UNLIMITED'
          : 'FREE / ONE BATCH'
      );

      let noChangeCount = 0;
      const maxNoChangeAttempts = 20;

      window.stopDeleting = false;

      const wait = ms =>
        new Promise(resolve =>
          setTimeout(resolve, ms)
        );

      function updatePopup(
        count,
        finished = false
      ) {
        try {
          chrome.runtime.sendMessage({
            type: finished
              ? 'finished'
              : 'updateCounter',
            count
          });
        } catch (e) {}
      }

      function isVisible(element) {
        if (!element) {
          return false;
        }

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

      function clickElement(element) {
        if (!element) {
          return false;
        }

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

      function normalizeText(value) {
        return (value || '')
          .trim()
          .replace(/\s+/g, ' ')
          .toLowerCase();
      }

      function findSelectAllCheckbox() {
        const checkbox =
          document.querySelector(
            'input[name="comet_activity_log_select_all_checkbox"]'
          );

        if (
          checkbox &&
          isVisible(checkbox)
        ) {
          return checkbox;
        }

        const checkboxes =
          Array.from(
            document.querySelectorAll(
              'input[type="checkbox"]'
            )
          );

        for (
          const candidate of checkboxes
        ) {
          if (!isVisible(candidate)) {
            continue;
          }

          const ariaLabel =
            (
              candidate.getAttribute(
                'aria-label'
              ) || ''
            ).toLowerCase();

          const parentText =
            (
              candidate.parentElement?.textContent ||
              ''
            )
              .trim()
              .toLowerCase();

          if (
            ariaLabel === 'all' ||
            ariaLabel.includes(
              'select all'
            ) ||
            parentText === 'all'
          ) {
            return candidate;
          }
        }

        return null;
      }

      function findVisibleRemoveControls() {
        const candidates =
          Array.from(
            document.querySelectorAll(
              '[role="button"], button, [tabindex="0"]'
            )
          );

        return candidates.filter(
          element => {
            if (!isVisible(element)) {
              return false;
            }

            const text =
              normalizeText(
                element.textContent
              );

            return (
              text === 'remove' ||
              text === 'delete'
            );
          }
        );
      }

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

      async function finishDeletion(
        message
      ) {
        await chrome.storage.local.set({
          isDeleting: false
        });

        updatePopup(
          deletedCount,
          true
        );

        console.log(
          `[ZeroTrace] ${message}`
        );

        alert(
          `Completed! Deleted ${deletedCount} ${type}.`
        );
      }

      /*
       * EXISTING COMMENTS DELETION
       */
      async function bulkDeleteComments() {
        console.log(
          'ZeroTrace: Starting Facebook bulk comment deletion'
        );

        while (
          !window.stopDeleting
        ) {
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
              await finishDeletion(
                'No more Facebook comments found.'
              );

              return;
            }

            await wait(1500);
            continue;
          }

          noChangeCount = 0;

          if (!checkbox.checked) {
            console.log(
              'ZeroTrace: Clicking All'
            );

            if (
              !clickElement(
                checkbox
              )
            ) {
              await wait(1000);
              continue;
            }

            const checked =
              await waitForCheckboxChecked(
                checkbox
              );

            if (!checked) {
              await wait(1000);
              continue;
            }
          }

          const removeButtons =
            findVisibleRemoveControls();

          if (
            removeButtons.length === 0
          ) {
            await wait(1500);
            continue;
          }

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

          const confirmButtons =
            findVisibleRemoveControls();

          if (
            confirmButtons.length === 0
          ) {
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
            deleteCounter:
              deletedCount
          });

          if (
            !unlimitedDeletion
          ) {
            await finishDeletion(
              'Completed one free Facebook comment deletion batch. Stopping.'
            );

            return;
          }

          window.location.reload();

          return;
        }

        alert(
          `Deletion stopped. Completed ${deletedCount} bulk removal operations.`
        );
      }

      /*
       * EXISTING REACTIONS DELETION
       */
      async function bulkDeleteReactions() {
        console.log(
          'ZeroTrace: Starting Facebook BULK reaction deletion'
        );

        while (
          !window.stopDeleting
        ) {
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
              await finishDeletion(
                'No more Facebook reactions found.'
              );

              return;
            }

            await wait(1500);
            continue;
          }

          noChangeCount = 0;

          if (!checkbox.checked) {
            console.log(
              'ZeroTrace: Selecting ALL reactions'
            );

            if (
              !clickElement(
                checkbox
              )
            ) {
              await wait(1000);
              continue;
            }

            const checked =
              await waitForCheckboxChecked(
                checkbox,
                6000
              );

            if (!checked) {
              await wait(1000);
              continue;
            }
          }

          await wait(1000);

          const removeButtons =
            findVisibleRemoveControls();

          if (
            removeButtons.length === 0
          ) {
            await wait(1500);
            continue;
          }

          console.log(
            'ZeroTrace: Clicking bulk Remove for reactions'
          );

          if (
            !clickElement(
              removeButtons[0]
            )
          ) {
            await wait(1000);
            continue;
          }

          await wait(1500);

          const confirmButtons =
            findVisibleRemoveControls();

          if (
            confirmButtons.length === 0
          ) {
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
            await wait(1000);
            continue;
          }

          await wait(3000);

          deletedCount++;

          updatePopup(
            deletedCount
          );

          await chrome.storage.local.set({
            deleteCounter:
              deletedCount
          });

          if (
            !unlimitedDeletion
          ) {
            await finishDeletion(
              'Completed one free Facebook reaction deletion batch. Stopping.'
            );

            return;
          }

          window.location.reload();

          return;
        }

        alert(
          `Deletion stopped. Completed ${deletedCount} bulk removal operations.`
        );
      }

      /*
       * FACEBOOK POSTS
       *
       * FLOW:
       *
       * View Posts
       *   ->
       * Start Deleting
       *   ->
       * three dots
       *   ->
       * Move to trash
       *   ->
       * wait for post to disappear
       *   ->
       * next post
       *
       * IMPORTANT:
       *
       * Posts do NOT use:
       * - Manage Posts
       * - Select All
       * - Next
       * - Delete Posts
       * - Posted By filter
       * - Done confirmation
       */
      async function bulkDeletePosts() {
        console.log(
          'ZeroTrace: Starting Facebook INDIVIDUAL post deletion'
        );

        function findPostMenuButtons() {
          const candidates =
            Array.from(
              document.querySelectorAll(
                '[role="button"], button, [aria-label], div[tabindex="0"]'
              )
            );

          const results = [];

          for (
            const element of candidates
          ) {
            if (!isVisible(element)) {
              continue;
            }

            const ariaLabel =
              normalizeText(
                element.getAttribute(
                  'aria-label'
                )
              );

            const title =
              normalizeText(
                element.getAttribute(
                  'title'
                )
              );

            const label =
              ariaLabel || title;

            // Avoid generic "More" / "More options" buttons, which also
            // appear in the profile navigation (All, About, Friends, etc.).
            // The post action control has a post-specific accessible label.
            const isMenuLabel =
              label.includes(
                'actions for this post'
              );

            if (!isMenuLabel) {
              continue;
            }

            const article =
              element.closest(
                'article, [role="article"]'
              );

            results.push({
              button: element,
              article
            });
          }

          results.sort((a, b) => {
            const rectA =
              a.button.getBoundingClientRect();

            const rectB =
              b.button.getBoundingClientRect();

            if (
              Math.abs(
                rectA.top -
                rectB.top
              ) > 10
            ) {
              return (
                rectA.top -
                rectB.top
              );
            }

            return (
              rectA.left -
              rectB.left
            );
          });

          return results;
        }

        function findMoveToTrash() {
          const candidates =
            Array.from(
              document.querySelectorAll(
                '[role="menuitem"], [role="button"], button, div[tabindex="0"], span'
              )
            );

          const matches =
            candidates.filter(
              element => {
                if (!isVisible(element)) {
                  return false;
                }

                const text =
                  normalizeText(
                    element.textContent
                  );

                const ariaLabel =
                  normalizeText(
                    element.getAttribute(
                      'aria-label'
                    )
                  );

                return (
                  text ===
                    'move to trash' ||
                  ariaLabel ===
                    'move to trash'
                );
              }
            );

          if (!matches.length) {
            return null;
          }

          matches.sort((a, b) => {
            const score =
              element => {
                const tag =
                  element.tagName
                    ? element.tagName.toLowerCase()
                    : '';

                const role =
                  element.getAttribute
                    ? element.getAttribute(
                        'role'
                      )
                    : '';

                if (
                  role ===
                  'menuitem'
                ) {
                  return 0;
                }

                if (
                  role ===
                    'button' ||
                  tag === 'button'
                ) {
                  return 1;
                }

                return 2;
              };

            return (
              score(a) -
              score(b)
            );
          });

          return matches[0];
        }

        function findHideFromProfile() {
          const candidates = Array.from(
            document.querySelectorAll(
              '[role="menuitem"], [role="button"], button, div[tabindex="0"], span'
            )
          );

          return candidates.find(element =>
            isVisible(element) && (
              normalizeText(element.textContent) === 'hide from profile' ||
              normalizeText(element.getAttribute('aria-label')) === 'hide from profile'
            )
          ) || null;
        }

        function findMoveConfirmation() {
          const dialogs = Array.from(
            document.querySelectorAll(
              '[role="dialog"], [aria-modal="true"]'
            )
          ).filter(isVisible);

          for (const dialog of dialogs) {
            const dialogText = normalizeText(
              dialog.textContent
            );

            if (!dialogText.includes('move to your trash')) {
              continue;
            }

            const moveButton = Array.from(
              dialog.querySelectorAll(
                '[role="button"], button, [tabindex="0"]'
              )
            ).find(element =>
              isVisible(element) &&
              normalizeText(element.textContent) === 'move'
            );

            if (moveButton) {
              return moveButton;
            }
          }

          return null;
        }

        function clickPostAction(element) {
          if (!element) {
            return false;
          }

          try {
            element.scrollIntoView({
              behavior: 'instant',
              block: 'center',
              inline: 'center'
            });
          } catch (e) {}

          const rect =
            element.getBoundingClientRect();

          if (
            rect.width <= 0 ||
            rect.height <= 0
          ) {
            return false;
          }

          const x =
            rect.left +
            rect.width / 2;

          const y =
            rect.top +
            rect.height / 2;

          let hitTarget =
            document.elementFromPoint(
              x,
              y
            );

          if (
            !hitTarget ||
            !element.contains(
              hitTarget
            )
          ) {
            hitTarget = element;
          }

          try {
            hitTarget.dispatchEvent(
              new PointerEvent(
                'pointerover',
                {
                  bubbles: true,
                  cancelable: true,
                  composed: true,
                  view: window,
                  clientX: x,
                  clientY: y,
                  pointerId: 1,
                  pointerType: 'mouse',
                  isPrimary: true,
                  button: -1,
                  buttons: 0
                }
              )
            );

            hitTarget.dispatchEvent(
              new MouseEvent(
                'mouseover',
                {
                  bubbles: true,
                  cancelable: true,
                  composed: true,
                  view: window,
                  clientX: x,
                  clientY: y
                }
              )
            );

            hitTarget.dispatchEvent(
              new PointerEvent(
                'pointerdown',
                {
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
                  buttons: 1
                }
              )
            );

            hitTarget.dispatchEvent(
              new MouseEvent(
                'mousedown',
                {
                  bubbles: true,
                  cancelable: true,
                  composed: true,
                  view: window,
                  clientX: x,
                  clientY: y,
                  button: 0,
                  buttons: 1
                }
              )
            );

            hitTarget.dispatchEvent(
              new MouseEvent(
                'mouseup',
                {
                  bubbles: true,
                  cancelable: true,
                  composed: true,
                  view: window,
                  clientX: x,
                  clientY: y,
                  button: 0,
                  buttons: 0
                }
              )
            );

            hitTarget.dispatchEvent(
              new PointerEvent(
                'pointerup',
                {
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
                  buttons: 0
                }
              )
            );

            hitTarget.dispatchEvent(
              new MouseEvent(
                'click',
                {
                  bubbles: true,
                  cancelable: true,
                  composed: true,
                  view: window,
                  clientX: x,
                  clientY: y,
                  button: 0,
                  buttons: 0
                }
              )
            );

            return true;
          } catch (error) {
            console.warn(
              'ZeroTrace: Facebook action click sequence failed:',
              error
            );

            try {
              hitTarget.click();
              return true;
            } catch (fallbackError) {
              return false;
            }
          }
        }

        async function waitForPostToDisappear(
          article,
          menuButton,
          timeout = 8000
        ) {
          const start =
            Date.now();

          while (
            Date.now() - start <
            timeout
          ) {
            // Facebook's profile feed sometimes renders the post actions
            // button outside an <article> / [role="article"] wrapper. In
            // that case, use the menu button itself as the observable target
            // instead of treating a missing article as an immediate success.
            if (article && (
              !document.contains(article) ||
              !isVisible(article)
            )) {
              return true;
            }

            if (!article && (
              !menuButton ||
              !document.contains(menuButton) ||
              !isVisible(menuButton)
            )) {
              return true;
            }

            await wait(300);
          }

          return false;
        }

        async function startTrashCleanup(reason) {
          console.log(
            `[ZeroTrace] Starting Facebook Trash cleanup after ${reason}.`
          );

          try {
            await chrome.runtime.sendMessage({
              type: 'startFacebookTrashCleanup'
            });
          } catch (error) {
            console.error(
              '[ZeroTrace] Could not start Facebook Trash cleanup:',
              error
            );
          }
        }

        while (
          !window.stopDeleting
        ) {
          const postMenus =
            findPostMenuButtons();

          console.log(
            `ZeroTrace: Found ${postMenus.length} visible Facebook post menu(s).`
          );

          if (
            postMenus.length === 0
          ) {
            noChangeCount++;

            console.log(
              `ZeroTrace: No visible post menu found (${noChangeCount}/${maxNoChangeAttempts}).`
            );

            if (
              noChangeCount >=
              maxNoChangeAttempts
            ) {
              await startTrashCleanup(
                'all visible posts were processed'
              );

              await finishDeletion(
                'No more Facebook posts found.'
              );

              return;
            }

            await wait(1500);
            continue;
          }

          noChangeCount = 0;

          const post =
            postMenus[0];

          console.log(
            'ZeroTrace: Clicking three dots for first visible Facebook post.'
          );

          if (
            !clickPostAction(
              post.button
            )
          ) {
            console.log(
              'ZeroTrace: Failed to click Facebook post three-dot menu.'
            );

            await wait(1000);
            continue;
          }

          let moveToTrash = null;

          for (
            let attempt = 0;
            attempt < 20 &&
            !moveToTrash;
            attempt++
          ) {
            moveToTrash =
              findMoveToTrash();

            if (!moveToTrash) {
              await wait(300);
            }
          }

          let menuAction = moveToTrash;
          let actionIsHideFromProfile = false;

          if (!menuAction) {
            menuAction = findHideFromProfile();
            actionIsHideFromProfile = !!menuAction;
          }

          if (!menuAction) {
            console.log(
              'ZeroTrace: Neither "Move to trash" nor "Hide from profile" was found.'
            );

            try {
              document.dispatchEvent(
                new KeyboardEvent(
                  'keydown',
                  {
                    key: 'Escape',
                    code: 'Escape',
                    bubbles: true,
                    cancelable: true
                  }
                )
              );
            } catch (e) {}

            await wait(700);
            continue;
          }

          console.log(
            actionIsHideFromProfile
              ? 'ZeroTrace: "Move to trash" was unavailable; clicking "Hide from profile".'
              : 'ZeroTrace: Clicking "Move to trash".'
          );

          if (
            !clickPostAction(
              menuAction
            )
          ) {
            console.log(
              `ZeroTrace: Failed to click "${actionIsHideFromProfile ? 'Hide from profile' : 'Move to trash'}".`
            );

            await wait(1000);
            continue;
          }

          if (!actionIsHideFromProfile) {
            let confirmMove = null;

            for (
              let attempt = 0;
              attempt < 20 &&
              !confirmMove;
              attempt++
            ) {
              confirmMove = findMoveConfirmation();

              if (!confirmMove) {
                await wait(300);
              }
            }

            if (!confirmMove) {
              console.log(
                'ZeroTrace: Facebook trash confirmation dialog or its "Move" button was not found.'
              );

              await wait(1000);
              continue;
            }

            console.log(
              'ZeroTrace: Confirming post trash by clicking "Move".'
            );

            if (!clickPostAction(confirmMove)) {
              console.log(
                'ZeroTrace: Failed to click Facebook trash confirmation "Move" button.'
              );

              await wait(1000);
              continue;
            }
          }

          console.log(
            'ZeroTrace: Waiting for post to disappear.'
          );

            const disappeared =
              await waitForPostToDisappear(
                post.article,
                post.button,
                8000
              );

          if (!disappeared) {
            console.log(
              'ZeroTrace: Post did not disappear after Move to trash. Not counting it as deleted.'
            );

            await wait(1000);
            continue;
          }

          deletedCount++;

          console.log(
            `ZeroTrace: Successfully moved 1 Facebook post to trash. Total deleted: ${deletedCount}`
          );

          updatePopup(
            deletedCount
          );

          await chrome.storage.local.set({
            deleteCounter:
              deletedCount
          });

          if (
            !unlimitedDeletion
          ) {
            await finishDeletion(
              'Completed one free Facebook post deletion. Stopping.'
            );

            return;
          }

          await wait(800);
        }

        await startTrashCleanup(
          'deletion was stopped'
        );

        updatePopup(
          deletedCount,
          true
        );

        await chrome.storage.local.set({
          isDeleting: false,
          deleteCounter: deletedCount
        });

        console.log(
          `ZeroTrace: Deletion stopped. Completed ${deletedCount} Facebook posts.`
        );
      }

      console.log(
        '[ZeroTrace] ===== FACEBOOK CLEANUP DISPATCH =====',
        { type }
      );

      if (
        type === 'comments'
      ) {
        bulkDeleteComments().catch(
          err => {
            console.error(
              'ZeroTrace Facebook bulk comment deletion error:',
              err
            );

            alert(
              `Error occurred: ${err.message}`
            );
          }
        );
      } else if (
        type === 'reactions'
      ) {
        bulkDeleteReactions().catch(
          err => {
            console.error(
              'ZeroTrace Facebook bulk reaction deletion error:',
              err
            );

            alert(
              `Error occurred: ${err.message}`
            );
          }
        );
      } else if (
        type === 'posts'
      ) {
        bulkDeletePosts().catch(
          err => {
            console.error(
              'ZeroTrace Facebook individual post deletion error:',
              err
            );

            alert(
              `Error occurred: ${err.message}`
            );
          }
        );
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

if (
  typeof PlatformRegistry !== 'undefined'
) {
  PlatformRegistry.register(
    window.FacebookPlatform
  );
}
