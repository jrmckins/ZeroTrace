/**
 * Twitter/X Platform Module for ZeroTrace
 * Handles automated deletion of tweets/replies and removal of likes.
 */

const TwitterPlatform = {

  id: 'twitter',

  name: 'Twitter/X',

  getPageDetection() {

    const isTwitter = (url) =>
      url &&
      (
        url.includes('twitter.com') ||
        url.includes('x.com')
      );

    return {

      onSite: isTwitter,

      anyActivity: (url) =>
        isTwitter(url) &&
        (
          url.includes('/likes') ||
          url.includes('/with_replies') ||
          url.includes('/reposts') ||
          url.includes('/profile')
        ),

      // X profile root = Posts page
      comments: (url) => {

        if (!isTwitter(url)) return false;

        try {

          const parsed = new URL(url);

          const parts =
            parsed.pathname
              .split('/')
              .filter(Boolean);

          if (parts.length !== 1) return false;

          const reservedPaths = new Set([
            'home',
            'explore',
            'notifications',
            'messages',
            'search',
            'settings',
            'compose',
            'i',
            'intent',
            'login',
            'signup',
            'share'
          ]);

          return !reservedPaths.has(
            parts[0].toLowerCase()
          );

        } catch (error) {

          return false;

        }

      },

      // X profile /likes = Likes page
      reactions: (url) =>
        isTwitter(url) &&
        url.includes('/likes'),

      // X profile /with_replies = Replies page
      replies: (url) =>
        isTwitter(url) &&
        url.includes('/with_replies'),
      // X profile /reposts = Reposts page
      reposts: (url) =>
        isTwitter(url) &&
        url.includes('/reposts')

    };

  },

  requiresManualNavigation() {

    return false;

  },

  getManualNavigationInstructions(type) {

    return `Navigate to your Twitter/X profile and open your ${type} page.`;

  },

  // ==========================================================================
  // GET ACTIVITY URLS
  // ==========================================================================
  //
  // The user is assumed to already be logged into X.
  //
  // We do NOT determine or scrape the username.
  //
  // Instead, we use X's own Profile navigation link. X knows which
  // account is logged in and sends us to that account's profile.
  //
  // Profile root = Posts
  // Profile /likes = Likes
  // Profile /with_replies = Replies
  //
  // ==========================================================================

  async getUrls(tab) {

    const result = {

      comments: null,

      reactions: null,

      replies: null,
      reposts: null

    };

    if (!tab || !tab.id) {

      return result;

    }

    const currentUrl = tab.url || '';

    const isX =
      currentUrl.includes('x.com') ||
      currentUrl.includes('twitter.com');

    if (!isX) {

      console.log(
        '[ZeroTrace] Opening X...'
      );

      await chrome.tabs.update(
        tab.id,
        {
          url: 'https://x.com/home'
        }
      );

      await new Promise(resolve =>
        setTimeout(resolve, 3000)
      );

    }

    // ------------------------------------------------------------------------
    // Use X's own Profile navigation.
    //
    // This works regardless of which X page the user is currently viewing.
    // We are NOT trying to determine the username ourselves.
    // ------------------------------------------------------------------------

    let profileUrl = null;

    for (
      let attempt = 0;
      attempt < 15;
      attempt++
    ) {

      try {

        const results =
          await chrome.scripting.executeScript({

            target: {
              tabId: tab.id
            },

            func: () => {

              const links =
                Array.from(
                  document.querySelectorAll('a[href]')
                );

              const profileLink =
                links.find(link => {

                  const testId =
                    link.getAttribute('data-testid') || '';

                  const ariaLabel =
                    link.getAttribute('aria-label') || '';

                  const text =
                    (link.textContent || '')
                      .trim()
                      .toLowerCase();

                  return (

                    testId === 'AppTabBar_Profile_Link' ||

                    testId === 'Profile_Link' ||

                    ariaLabel.toLowerCase() === 'profile' ||

                    text === 'profile'

                  );

                });

              if (!profileLink) {

                return null;

              }

              return profileLink.href || null;

            }

          });

        if (
          results &&
          results[0] &&
          results[0].result
        ) {

          profileUrl =
            results[0].result;

          break;

        }

      } catch (error) {

        console.warn(
          '[ZeroTrace] Could not access X Profile navigation:',
          error
        );

      }

      console.log(
        `[ZeroTrace] Waiting for X Profile navigation... attempt ${attempt + 1}/15`
      );

      await new Promise(resolve =>
        setTimeout(resolve, 1000)
      );

    }

    // ------------------------------------------------------------------------
    // If X's Profile link was found, use it.
    // ------------------------------------------------------------------------

    if (profileUrl) {

      // Remove any existing trailing slash.
      profileUrl =
        profileUrl.replace(/\/+$/, '');

      // Profile root = Posts
      result.comments =
        profileUrl;

      // Profile /likes = Likes
      result.reactions =
        `${profileUrl}/likes`;

      // Profile /with_replies = Replies
      result.replies =
        `${profileUrl}/with_replies`;

      // Profile /reposts = Reposts
      result.reposts =
        `${profileUrl}/reposts`;

      console.log(
        '[ZeroTrace] X Posts URL:',
        result.comments
      );

      console.log(
        '[ZeroTrace] X Likes URL:',
        result.reactions
      );

      console.log(
        '[ZeroTrace] X Replies URL:',
        result.replies
      );

      console.log(
        '[ZeroTrace] X Reposts URL:',
        result.reposts
      );

      return result;

    }

    // ------------------------------------------------------------------------
    // We could not find X's Profile navigation.
    //
    // This is NOT a username-detection failure.
    // ------------------------------------------------------------------------

    console.error(
      '[ZeroTrace] Could not find the X Profile navigation link.'
    );

    return result;

  },

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  getCleanupFunction() {

    return async function(type, excludeOwnPosts) {

      let deletedCount = 0;

      const sleep = (ms) =>
        new Promise(resolve =>
          setTimeout(resolve, ms)
        );

      const shouldContinue = async () => {
        const state =
          await chrome.storage.local.get(
            'isDeleting'
          );

        return state.isDeleting === true;
      };

      // ----------------------------------------------------------------------
      // Delete posts/replies
      // ----------------------------------------------------------------------

      async function deleteTweets() {

        while (await shouldContinue()) {

          const tweets =
            document.querySelectorAll(
              'article[data-testid="tweet"]'
            );

          if (tweets.length === 0) {

            window.scrollBy(
              0,
              window.innerHeight * 2
            );

            await sleep(2500);

            const checkTweets =
              document.querySelectorAll(
                'article[data-testid="tweet"]'
              );

            if (checkTweets.length === 0) {

              break;

            }

            continue;

          }

          let processedOne = false;

          for (const tweet of tweets) {
            if (!(await shouldContinue())) {
              return;
            }
            try {

              tweet.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
              });

              await sleep(600);

              const moreButton =
                tweet.querySelector(
                  '[data-testid="caret"]'
                );

              if (!moreButton) {

                continue;

              }

              moreButton.click();

              await sleep(600);

              const menuItems =
                document.querySelectorAll(
                  '[role="menuitem"]'
                );

              let deleteMenuItem = null;

              for (const item of menuItems) {

                const text =
                  item.textContent
                    .trim()
                    .toLowerCase();

                if (
                  text === 'delete' ||
                  text.includes('delete post')
                ) {

                  deleteMenuItem = item;

                  break;

                }

              }

              if (!deleteMenuItem) {

                document.body.click();

                await sleep(500);

                continue;

              }

              deleteMenuItem.click();

              await sleep(800);

              let confirmButton =
                document.querySelector(
                  '[data-testid="confirmationSheetConfirm"]'
                );

              if (!confirmButton) {

                const dialogButtons =
                  document.querySelectorAll(
                    'div[role="dialog"] button'
                  );

                for (const button of dialogButtons) {

                  if (
                    button.textContent
                      .trim()
                      .toLowerCase() === 'delete'
                  ) {

                    confirmButton = button;

                    break;

                  }

                }

              }

              if (!confirmButton) {

                console.log(
                  '[ZeroTrace] Delete confirmation not found.'
                );

                document.body.click();

                await sleep(500);

                continue;

              }

              confirmButton.click();

              deletedCount++;

              processedOne = true;

              console.log(
                `[ZeroTrace] Deleted Twitter/X item #${deletedCount}`
              );

              chrome.runtime.sendMessage({

                type: 'updateCounter',

                count: deletedCount

              }).catch(() => {});

              await sleep(1500);

              break;

            } catch (err) {

              console.error(
                '[ZeroTrace] Error deleting Twitter/X item:',
                err
              );

              document.body.click();

              await sleep(1000);

            }

          }

          if (!processedOne) {

            window.scrollBy(
              0,
              window.innerHeight * 2
            );

            await sleep(2500);

          }

        }

      }

      // ----------------------------------------------------------------------
      // Remove likes
      // ----------------------------------------------------------------------

      async function removeLikes() {

        while (await shouldContinue()) {

          const tweets =
            document.querySelectorAll(
              'article[data-testid="tweet"]'
            );

          if (tweets.length === 0) {

            window.scrollBy(
              0,
              window.innerHeight * 2
            );

            await sleep(2500);

            const checkTweets =
              document.querySelectorAll(
                'article[data-testid="tweet"]'
              );

            if (checkTweets.length === 0) {

              break;

            }

            continue;

          }

          let processedOne = false;

          for (const tweet of tweets) {

            if (!(await shouldContinue())) {
              return;
            }
            try {

              tweet.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
              });

              await sleep(600);

              const unlikeButton =
                tweet.querySelector(
                  '[data-testid="unlike"]'
                );

              if (!unlikeButton) {

                continue;

              }

              unlikeButton.click();

              deletedCount++;

              processedOne = true;

              console.log(
                `[ZeroTrace] Removed Twitter/X like #${deletedCount}`
              );

              chrome.runtime.sendMessage({

                type: 'updateCounter',

                count: deletedCount

              }).catch(() => {});

              await sleep(1000);

              break;

            } catch (err) {

              console.error(
                '[ZeroTrace] Error removing Twitter/X like:',
                err
              );

              await sleep(1000);

            }

          }

          if (!processedOne) {

            window.scrollBy(
              0,
              window.innerHeight * 2
            );

            await sleep(2500);

          }

        }

      }

      async function removeReposts() {
        while (await shouldContinue()) {
          const tweets =
            document.querySelectorAll(
              'article[data-testid="tweet"]'
            );
      
          if (tweets.length === 0) {
            window.scrollBy(
              0,
              window.innerHeight * 2
            );
      
            await sleep(2500);
      
            const checkTweets =
              document.querySelectorAll(
                'article[data-testid="tweet"]'
              );
      
            if (checkTweets.length === 0) {
              break;
            }
      
            continue;
          }
      
          let processedOne = false;
      
          for (const tweet of tweets) {
            if (!(await shouldContinue())) {
              return;
            }
            try {
              tweet.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
              });
      
              await sleep(600);
      
              const repostButton =
                tweet.querySelector(
                  '[data-testid="unretweet"]'
                );
      
              if (!repostButton) {
                continue;
              }
      
              repostButton.click();
      
              await sleep(600);

              const menuItems =
                document.querySelectorAll(
                  '[role="menuitem"]'
                );
      
              let undoRepostItem = null;
      
              for (const item of menuItems) {
                const text =
                  item.textContent
                    .trim()
                    .toLowerCase();
      
                if (
                  text === 'undo repost' ||
                  text.includes('undo repost')
                ) {
                  undoRepostItem = item;
                  break;
                }
              }

              if (!undoRepostItem) {
                document.body.click();
                await sleep(500);
                continue;
              }

              undoRepostItem.click();

              deletedCount++;
              processedOne = true;

              console.log(
                `[ZeroTrace] Removed Twitter/X repost #${deletedCount}`
              );
      
              chrome.runtime.sendMessage({
                type: 'updateCounter',
                count: deletedCount
              }).catch(() => {});

              await sleep(1200);

              break;

            } catch (err) {
              console.error(
                '[ZeroTrace] Error removing Twitter/X repost:',
                err
              );

              document.body.click();
              await sleep(1000);
            }
          }

          if (!processedOne) {
            window.scrollBy(
              0,
              window.innerHeight * 2
            );

            await sleep(2500);
          }
        }
      }
 
      // ----------------------------------------------------------------------
      // Run requested cleanup
      // ----------------------------------------------------------------------

      if (type === 'reactions') {
        await removeLikes();
      } else if (type === 'reposts') {
        await removeReposts();
      } else {
        await deleteTweets();
      }

      console.log(
        `[${
          'ZeroTrace'
        }] Twitter/X cleanup complete. ${deletedCount} item(s) processed.`
      );

      if (await shouldContinue()) {
        chrome.runtime.sendMessage({
          type: 'finished',
          count: deletedCount
        }).catch(() => {});
      } else {
        console.log(
          `[ZeroTrace] Twitter/X cleanup stopped. ${deletedCount} item(s) processed.`
        );
      }

    };

  }

};

// ============================================================================
// REGISTER PLATFORM
// ============================================================================

if (typeof PlatformRegistry !== 'undefined') {

  PlatformRegistry.register(TwitterPlatform);

}
