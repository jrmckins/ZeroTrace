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

    // Capture the tab's current URL BEFORE navigating so we can tell
    // whether chrome.tabs.get is still reporting stale status from the
    // previous page (a common race right after tabs.update fires).
    let previousUrl = tab.url || '';

    await chrome.tabs.update(tab.id, {
      url: 'https://www.facebook.com/me'
    });

    console.log(
      '[ZeroTrace] Waiting for Facebook profile to load...'
    );

    // Wait for the tab to finish loading. We require BOTH status ===
    // 'complete' AND a URL that has actually changed away from the
    // pre-navigation URL (or already points at /me), so we don't fall
    // through on stale status from the page we just left.
    for (let i = 0; i < 30; i++) {

      try {

        const currentTab =
          await chrome.tabs.get(tab.id);

        const urlChanged =
          !previousUrl ||
          currentTab.url !== previousUrl;

        const looksLikeProfile =
          !!currentTab.url &&
          currentTab.url.includes('facebook.com');

        if (
          currentTab.status === 'complete' &&
          urlChanged &&
          looksLikeProfile
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

    // Give Facebook's React interface time to render.
    await new Promise(resolve =>
      setTimeout(resolve, 2000)
    );

    // Look for Manage posts repeatedly because Facebook
    // may render it after the initial page load.
    for (
      let attempt = 0;
      attempt < 30;
      attempt++
    ) {

      try {

        const results =
          await chrome.scripting.executeScript({

            target: {
              tabId: tab.id
            },

            func: () => {

              function cleanText(value) {

                return (value || '')
                  .trim()
                  .replace(/\s+/g, ' ')
                  .toLowerCase();
              }

              // A match is either:
              //  - visible text that STARTS WITH "manage post" (tolerates
              //    trailing hidden a11y text Facebook sometimes appends
              //    inside the same element, e.g. "Manage postsSee all..."), or
              //  - an aria-label containing "manage post" (Facebook often
              //    sets this even when visible text also exists).
              function isManagePostsMatch(element) {

                const text =
                  cleanText(
                    element.textContent
                  );

                if (
                  text.startsWith('manage post')
                ) {
                  return true;
                }

                const ariaLabel =
                  cleanText(
                    element.getAttribute
                      ? element.getAttribute('aria-label')
                      : ''
                  );

                return ariaLabel.includes(
                  'manage post'
                );
              }

              const elements =
                Array.from(
                  document.querySelectorAll(
                    'span, div, button, a, [role="button"], [role="menuitem"], [aria-label]'
                  )
                );

              const candidates =
                elements.filter(element => {

                  const rect =
                    element.getBoundingClientRect();

                  const style =
                    window.getComputedStyle(
                      element
                    );

                  const visible =
                    rect.width > 0 &&
                    rect.height > 0 &&
                    style.display !== 'none' &&
                    style.visibility !== 'hidden';

                  return (
                    visible &&
                    isManagePostsMatch(element)
                  );
                });

              // Prefer the SMALLEST matching element (most likely the
              // innermost text/label node), since matching on
              // startsWith/includes can pick up large ancestor
              // containers too.
              candidates.sort((a, b) => {

                const areaA =
                  a.getBoundingClientRect().width *
                  a.getBoundingClientRect().height;

                const areaB =
                  b.getBoundingClientRect().width *
                  b.getBoundingClientRect().height;

                return areaA - areaB;
              });

              const textElement =
                candidates[0];

              if (!textElement) {

                return {
                  found: false,
                  clicked: false
                };
              }

              console.log(
                '[ZeroTrace] Found visible Facebook "Manage posts" text.'
              );

              // The span containing "Manage posts" may not itself
              // be the clickable element. Walk upward until we find
              // the Facebook control that owns the text.
              let clickable =
                textElement;

              for (
                let level = 0;
                level < 10;
                level++
              ) {

                if (!clickable) {
                  break;
                }

                const tag =
                  clickable.tagName
                    ? clickable.tagName.toLowerCase()
                    : '';

                const role =
                  clickable.getAttribute
                    ? clickable.getAttribute('role')
                    : '';

                const tabIndex =
                  clickable.getAttribute
                    ? clickable.getAttribute('tabindex')
                    : null;

                if (
                  tag === 'button' ||
                  tag === 'a' ||
                  role === 'button' ||
                  role === 'menuitem' ||
                  tabIndex === '0'
                ) {
                  break;
                }

                clickable =
                  clickable.parentElement;
              }

              if (!clickable) {

                return {
                  found: true,
                  clicked: false
                };
              }

              console.log(
                '[ZeroTrace] Facebook clickable Manage Posts element:',
                clickable
              );

              clickable.scrollIntoView({
                behavior: 'instant',
                block: 'center'
              });

              // Trigger the same basic pointer/mouse sequence
              // a real user interaction would generate.
              try {

                clickable.dispatchEvent(
                  new PointerEvent(
                    'pointerover',
                    {
                      bubbles: true,
                      cancelable: true,
                      view: window
                    }
                  )
                );

                clickable.dispatchEvent(
                  new PointerEvent(
                    'pointerdown',
                    {
                      bubbles: true,
                      cancelable: true,
                      view: window,
                      button: 0,
                      buttons: 1
                    }
                  )
                );

                clickable.dispatchEvent(
                  new MouseEvent(
                    'mousedown',
                    {
                      bubbles: true,
                      cancelable: true,
                      view: window,
                      button: 0,
                      buttons: 1
                    }
                  )
                );

                clickable.dispatchEvent(
                  new MouseEvent(
                    'mouseup',
                    {
                      bubbles: true,
                      cancelable: true,
                      view: window,
                      button: 0,
                      buttons: 0
                    }
                  )
                );

                clickable.dispatchEvent(
                  new PointerEvent(
                    'pointerup',
                    {
                      bubbles: true,
                      cancelable: true,
                      view: window,
                      button: 0,
                      buttons: 0
                    }
                  )
                );

              } catch (pointerError) {

                console.log(
                  '[ZeroTrace] Pointer events unavailable, using click().'
                );
              }

              clickable.click();

              return {
                found: true,
                clicked: true,
                tag: clickable.tagName,
                role: clickable.getAttribute('role'),
                text: cleanText(
                  clickable.textContent
                )
              };
            }
          });

        const result =
          results &&
          results[0] &&
          results[0].result;

        console.log(
          '[ZeroTrace] Manage Posts search result:',
          result
        );

        if (
          result &&
          result.found &&
          result.clicked
        ) {

          console.log(
            '[ZeroTrace] Successfully clicked Facebook "Manage posts".'
          );

          return true;
        }

      } catch (error) {

        console.warn(
          '[ZeroTrace] Error looking for Facebook "Manage posts":',
          error
        );
      }

      console.log(
        `[ZeroTrace] Waiting for Facebook "Manage posts"... attempt ${attempt + 1}/30`
      );

      await new Promise(resolve =>
        setTimeout(resolve, 1000)
      );
    }

    console.error(
      '[ZeroTrace] Could not find Facebook "Manage posts".'
    );

    return false;
  },

  getPageDetection() {

    return {

      posts: (url) =>
        url.includes('facebook.com') &&
        !url.includes('allactivity'),

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

    return async function cleanupActivities(
      type,
      excludeOwnPosts
    ) {

      const initialStorage =
        await chrome.storage.local.get([
          'deleteCounter'
        ]);

      let deletedCount =
        initialStorage.deleteCounter || 0;

      let noChangeCount = 0;

      const maxNoChangeAttempts = 20;

      window.stopDeleting = false;

      const wait = (ms) =>
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

            count: count
          });

        } catch (e) {}
      }

      function isVisible(element) {

        if (!element) return false;

        const rect =
          element.getBoundingClientRect();

        const style =
          window.getComputedStyle(
            element
          );

        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden'
        );
      }

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
            new MouseEvent(
              'mousedown',
              {
                bubbles: true,
                cancelable: true,
                view: window
              }
            )
          );

          element.dispatchEvent(
            new MouseEvent(
              'mouseup',
              {
                bubbles: true,
                cancelable: true,
                view: window
              }
            )
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
              ) ||
              ''
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
              element.textContent
                .trim()
                .replace(/\s+/g, ' ')
                .toLowerCase();

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

              console.log(
                'ZeroTrace: All checkbox did not become checked'
              );

              await wait(1000);

              continue;
            }
          }

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
            deleteCounter:
              deletedCount
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

          if (!checkbox.checked) {

            console.log(
              'ZeroTrace: Selecting ALL reactions'
            );

            if (
              !clickElement(
                checkbox
              )
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

          await wait(1000);

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

          await wait(3000);

          deletedCount++;

          updatePopup(
            deletedCount
          );

          await chrome.storage.local.set({
            deleteCounter:
              deletedCount
          });

          console.log(
            `ZeroTrace: Completed bulk reaction removal operation #${deletedCount}`
          );

          console.log(
            'ZeroTrace: Reloading Facebook reactions page...'
          );

          window.location.reload();

          return;
        }

        alert(
          `Deletion stopped. Completed ${deletedCount} bulk removal operations.`
        );
      }

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
