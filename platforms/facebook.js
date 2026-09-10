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

    let previousUrl = tab.url || '';

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

    await new Promise(resolve =>
      setTimeout(resolve, 2000)
    );

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
        if (!element) {
          return false;
        }

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

      function isElementDisabled(element) {

        if (!element) {
          return true;
        }

        if (element.disabled) {
          return true;
        }

        const ariaDisabled =
          element.getAttribute
            ? element.getAttribute('aria-disabled')
            : null;

        if (ariaDisabled === 'true') {
          return true;
        }

        const tabIndex =
          element.getAttribute
            ? element.getAttribute('tabindex')
            : null;

        if (tabIndex === '-1') {
          return true;
        }

        const style =
          window.getComputedStyle(
            element
          );

        if (
          style.pointerEvents === 'none' ||
          style.cursor === 'not-allowed'
        ) {
          return true;
        }

        return false;
      }

      function findVisibleButtonByText(text) {

        const candidates =
          Array.from(
            document.querySelectorAll(
              '[role="button"], button, a, div[tabindex]'
            )
          );

        return (
          candidates.find(element => {

            if (!isVisible(element)) {
              return false;
            }

            const elementText =
              element.textContent
                .trim()
                .replace(/\s+/g, ' ')
                .toLowerCase();

            return elementText === text;

          }) || null
        );
      }

      function findAndClickManagePosts() {

        function cleanText(value) {
          return (value || '')
            .trim()
            .replace(/\s+/g, ' ')
            .toLowerCase();
        }

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
          elements.filter(element =>
            isVisible(element) &&
            isManagePostsMatch(element)
          );

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
          return false;
        }

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
          return false;
        }

        return clickElement(clickable);
      }

      function findSelectAllToggle() {

        const candidates =
          Array.from(
            document.querySelectorAll(
              '[role="button"], button, a, div[tabindex]'
            )
          );

        return (
          candidates.find(element => {

            if (!isVisible(element)) {
              return false;
            }

            const elementText =
              element.textContent
                .trim()
                .replace(/\s+/g, ' ')
                .toLowerCase();

            return (
              elementText === 'select all' ||
              elementText === 'unselect all'
            );

          }) || null
        );
      }

      function findDeleteRadioControl() {

        const radios =
          Array.from(
            document.querySelectorAll(
              'input[type="radio"], [role="radio"]'
            )
          );

        for (const radio of radios) {

          if (!isVisible(radio)) {
            continue;
          }

          let container = radio;
          let rowText = '';

          for (
            let level = 0;
            level < 6 && container;
            level++
          ) {

            rowText =
              (container.textContent || '')
                .trim()
                .replace(/\s+/g, ' ')
                .toLowerCase();

            if (
              rowText.includes('delete posts')
            ) {
              break;
            }

            container =
              container.parentElement;
          }

          if (
            rowText.includes('delete posts')
          ) {
            return radio;
          }
        }

        return null;
      }

      function parseSelectedPostsCount() {

        const candidates =
          Array.from(
            document.querySelectorAll(
              'span, div'
            )
          );

        for (const element of candidates) {

          if (!isVisible(element)) {
            continue;
          }

          const elementText =
            (element.textContent || '').trim();

          const match =
            elementText.match(
              /^(\d+)\/(\d+)$/
            );

          if (match) {
            return parseInt(
              match[1],
              10
            );
          }
        }

        return 0;
      }

      async function finishDeletion(message) {

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

          if (!unlimitedDeletion) {

            await finishDeletion(
              'Completed one free Facebook comment deletion batch. Stopping.'
            );

            return;
          }

          console.log(
            `ZeroTrace: Paid user - completed bulk comment removal operation #${deletedCount}. Reloading...`
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

          if (!unlimitedDeletion) {

            await finishDeletion(
              'Completed one free Facebook reaction deletion batch. Stopping.'
            );

            return;
          }

          console.log(
            `ZeroTrace: Paid user - completed bulk reaction removal operation #${deletedCount}. Reloading...`
          );

          window.location.reload();
          return;
        }

        alert(
          `Deletion stopped. Completed ${deletedCount} bulk removal operations.`
        );
      }

      async function bulkDeletePosts() {

        console.log(
          'ZeroTrace: Starting Facebook bulk post deletion'
        );

        while (
          !window.stopDeleting
        ) {

          const selectAllToggle =
            findSelectAllToggle();

          if (!selectAllToggle) {

            const reopened =
              findAndClickManagePosts();

            if (reopened) {

              console.log(
                'ZeroTrace: Reopened "Manage posts" modal, waiting for it to render...'
              );

              await wait(2000);

            } else {

              console.log(
                'ZeroTrace: "Manage posts" control not found either'
              );
            }

            noChangeCount++;

            console.log(
              `ZeroTrace: "Select all" toggle not found (${noChangeCount}/${maxNoChangeAttempts})`
            );

            if (
              noChangeCount >=
              maxNoChangeAttempts
            ) {

              await finishDeletion(
                'No more Facebook posts found.'
              );

              return;
            }

            await wait(1500);
            continue;
          }

          noChangeCount = 0;

          const toggleText =
            selectAllToggle.textContent
              .trim()
              .toLowerCase();

          if (
            toggleText === 'select all'
          ) {

            console.log(
              'ZeroTrace: Clicking Select all'
            );

            if (
              !clickElement(
                selectAllToggle
              )
            ) {
              await wait(1000);
              continue;
            }

            await wait(1200);
          }

          const selectedCount =
            parseSelectedPostsCount();

          console.log(
            `ZeroTrace: ${selectedCount} post(s) selected`
          );

          if (
            selectedCount === 0
          ) {

            console.log(
              'ZeroTrace: No posts selected, nothing left to delete'
            );

            await finishDeletion(
              'No more Facebook posts found.'
            );

            return;
          }

          const nextButton =
            findVisibleButtonByText('next');

          if (
            !nextButton ||
            isElementDisabled(nextButton)
          ) {

            console.log(
              'ZeroTrace: Next button not ready yet'
            );

            await wait(1000);
            continue;
          }

          console.log(
            'ZeroTrace: Clicking Next'
          );

          if (
            !clickElement(nextButton)
          ) {
            await wait(1000);
            continue;
          }

          await wait(1500);

          let deleteRadio = null;

          for (
            let attempt = 0;
            attempt < 15 &&
            !deleteRadio;
            attempt++
          ) {

            deleteRadio =
              findDeleteRadioControl();

            if (!deleteRadio) {
              await wait(500);
            }
          }

          if (!deleteRadio) {

            console.log(
              'ZeroTrace: Could not find "Delete posts" radio option'
            );

            await wait(1000);
            continue;
          }

          console.log(
            'ZeroTrace: Selecting "Delete posts" option'
          );

          if (
            !clickElement(deleteRadio)
          ) {
            await wait(1000);
            continue;
          }

          await wait(800);

          let doneButton = null;

          for (
            let attempt = 0;
            attempt < 15;
            attempt++
          ) {

            const candidate =
              findVisibleButtonByText('done');

            if (
              candidate &&
              !isElementDisabled(candidate)
            ) {

              doneButton = candidate;
              break;
            }

            await wait(500);
          }

          if (!doneButton) {

            console.log(
              'ZeroTrace: "Done" button never became enabled'
            );

            await wait(1000);
            continue;
          }

          console.log(
            'ZeroTrace: Clicking Done to confirm deletion'
          );

          if (
            !clickElement(doneButton)
          ) {
            await wait(1000);
            continue;
          }

          await wait(3000);

          deletedCount += selectedCount;

          updatePopup(
            deletedCount
          );

          await chrome.storage.local.set({
            deleteCounter:
              deletedCount
          });

          if (!unlimitedDeletion) {

            await finishDeletion(
              `Deleted one free Facebook post batch of ${selectedCount} post(s). Stopping.`
            );

            return;
          }

          console.log(
            `ZeroTrace: Paid user - deleted a batch of ${selectedCount} post(s). Total: ${deletedCount}. Reloading...`
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

      } else if (
        type === 'posts'
      ) {

        bulkDeletePosts().catch(
          err => {

            console.error(
              'ZeroTrace Facebook bulk post deletion error:',
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
