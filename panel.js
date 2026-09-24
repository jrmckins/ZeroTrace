/**
 * ZeroTrace - Main Popup Script
 * Uses modular platform architecture for Facebook and Twitter/X.
 */

import { verifyAndTrackUsage } from './usageChecker.bundle.js';

let currentPlatform = 'facebook';

// ============================================================================
// UI Helper Functions
// ============================================================================

function showStatus(message, type) {

  const status =
    document.getElementById('statusMessage');

  if (!status) {
    console.log(`[ZeroTrace] ${message}`);
    return;
  }

  status.textContent = message;

  status.className = `status-msg ${type || ''}`;
}

function showPageStatus(message, isOnPage) {

  // popup.html currently does not contain pageStatus.
  // Keep this function safe in case it is added later.

  const pageStatus =
    document.getElementById('pageStatus');

  if (!pageStatus) {
    return;
  }

  pageStatus.textContent = message;

  pageStatus.className = isOnPage
    ? 'page-status on-page'
    : 'page-status not-on-page';

  pageStatus.style.display = 'flex';
}

function hidePageStatus() {

  const pageStatus =
    document.getElementById('pageStatus');

  if (pageStatus) {
    pageStatus.style.display = 'none';
  }
}

// ============================================================================
// Paywall Modal
// ============================================================================

function showPaywallModal() {

  console.log('[ZeroTrace] SHOWING PAYWALL MODAL');

  const existing =
    document.getElementById(
      'zeroTracePaywallModal'
    );

  if (existing) {
    existing.remove();
  }

  const overlay =
    document.createElement('div');

  overlay.id =
    'zeroTracePaywallModal';

  overlay.innerHTML = `
    <div class="paywall-modal">

      <div class="paywall-title">
        Your free trial has expired
      </div>

      <div class="paywall-message">
        You've used your free trial for this activity.
        Purchase ZeroTrace to continue deleting your activity.
      </div>

      <div class="paywall-buttons">

        <button
          id="paywallBuyNow"
          class="paywall-buy-button"
          type="button"
        >
          Buy Now
        </button>

        <button
          id="paywallCancel"
          class="paywall-cancel-button"
          type="button"
        >
          Cancel
        </button>

      </div>

    </div>
  `;

  document.body.appendChild(overlay);

  document
    .getElementById('paywallBuyNow')
    .addEventListener(
      'click',
      () => {

        window.open(
          'https://dockerplaybooks.dpdns.org/ZeroTrace/',
          '_blank'
        );

        overlay.remove();
      }
    );

  document
    .getElementById('paywallCancel')
    .addEventListener(
      'click',
      () => {
        overlay.remove();
      }
    );

  overlay.addEventListener(
    'click',
    (event) => {

      if (event.target === overlay) {
        overlay.remove();
      }

    }
  );
}

// ============================================================================
// Start / Stop Deletion UI
// ============================================================================

function updateDeletionUI(isDeleting) {

  const startButton =
    document.getElementById('startDeletion');

  const stopButton =
    document.getElementById('stopDeletion');

  if (startButton) {

    startButton.classList.toggle(
      'hidden',
      isDeleting
    );

    startButton.disabled =
      isDeleting;
  }

  if (stopButton) {

    stopButton.classList.toggle(
      'hidden',
      !isDeleting
    );

    stopButton.disabled =
      !isDeleting;
  }
}

// ============================================================================
// Platform UI
// ============================================================================

function updatePlatformUI() {

  const step2Title =
    document.getElementById('step2Title');

  // ADDED: Reference to the top Facebook Posts button.
  const postsButton =
    document.getElementById('navigatePosts');

  const commentsButton =
    document.getElementById('navigateComments');

  const reactionsButton =
    document.getElementById('navigateReactions');

  const repliesButton =
    document.getElementById('navigateReplies');

  const repostsButton =
    document.getElementById('navigateReposts');

  const navigationNote =
    document.getElementById('navigationNote');

  if (currentPlatform === 'twitter') {

    if (step2Title) {

      step2Title.textContent =
        'If not already logged in to Twitter, log in.';
    }

    // ADDED: Hide the top "View Posts" button on Twitter.
    if (postsButton) {
      postsButton.classList.add('hidden');
    }

    if (commentsButton) {

      commentsButton.textContent =
        'View Posts';
    }

    if (reactionsButton) {

      reactionsButton.textContent =
        'View Likes';
    }

    if (repliesButton) {

      repliesButton.classList.remove(
        'hidden'
      );
    }

    if (repostsButton) {

      repostsButton.classList.remove(
        'hidden'
      );
    }

    if (navigationNote) {

      navigationNote.innerHTML =
        '<span class="icon icon-alert"></span>';
    }

  } else {

    if (step2Title) {

      step2Title.textContent =
        'If not already logged in to Facebook, log in.';
    }

    // ADDED: Show the Facebook "View Posts" button again.
    if (postsButton) {
      postsButton.classList.remove('hidden');
    }

    if (commentsButton) {

      commentsButton.textContent =
        'View Comments';
    }

    if (reactionsButton) {

      reactionsButton.textContent =
        'View Reactions';
    }

    if (repliesButton) {

      repliesButton.classList.add(
        'hidden'
      );
    }

    if (repostsButton) {

      repostsButton.classList.add(
        'hidden'
      );
    }

    if (navigationNote) {

      navigationNote.innerHTML =
        '<span class="icon icon-alert"></span> ';
    }

  }
}

// ============================================================================
// Platform Management
// ============================================================================

function setPlatform(platformId) {

  if (!PlatformRegistry.has(platformId)) {

    console.error(
      `[ZeroTrace] Platform ${platformId} not found`
    );

    return;
  }

  currentPlatform =
    platformId;

  chrome.storage.local.set({
    currentPlatform: platformId
  });

  document.body.className =
    `theme-${platformId}`;

  const platformSelector =
    document.getElementById(
      'platformSelector'
    );

  if (platformSelector) {

    platformSelector.value =
      platformId;
  }

  updatePlatformUI();

  checkCurrentPage();
}

function getCurrentPlatform() {
  return PlatformRegistry.get(
    currentPlatform
  );
}

// ============================================================================
// Page Detection
// ============================================================================

async function checkCurrentPage() {

  const [tab] =
    await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

  if (!tab || !tab.url) {
    return;
  }

  const platform =
    getCurrentPlatform();

  if (!platform) {
    return;
  }

  const detection =
    platform.getPageDetection();

  if (
    detection.comments(tab.url)
  ) {

    showPageStatus(
      `✓ You are on the ${platform.name} Comments page`,
      true
    );

  } else if (
    detection.reactions(tab.url)
  ) {

    showPageStatus(
      `✓ You are on the ${platform.name} Reactions page`,
      true
    );

  } else if (
    detection.replies &&
    detection.replies(tab.url)
  ) {

    showPageStatus(
      `✓ You are on the ${platform.name} Replies page`,
      true
    );

  } else if (
    detection.reposts &&
    detection.reposts(tab.url)
  ) {

    showPageStatus(
      `✓ You are on the ${platform.name} Reposts page`,
      true
    );

  } else if (
    detection.anyActivity(tab.url)
  ) {

    showPageStatus(
      `✓ You are on a ${platform.name} activity page`,
      true
    );

  } else if (
    detection.onSite(tab.url)
  ) {

    showPageStatus(
      'Navigate using Step 3',
      false
    );

  } else {

    showPageStatus(
      `Not on ${platform.name}`,
      false
    );
  }
}

// ============================================================================
// Navigation
// ============================================================================

async function navigateToActivityPage(type) {

  const [tab] =
    await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

  if (!tab || !tab.id) {

    showStatus(
      'Could not find active tab',
      'error'
    );

    return;
  }

  const platform =
    getCurrentPlatform();

  if (!platform) {

    showStatus(
      'Platform not found',
      'error'
    );

    return;
  }

  // ==========================================================================
  // Facebook Posts navigation
  // ==========================================================================

  if (
    platform.id === 'facebook' &&
    type === 'posts' &&
    typeof platform.navigateToPosts === 'function'
  ) {

    showStatus(
      'Navigating to your Facebook Posts',
      'info'
    );

    try {

      const success =
        await platform.navigateToPosts(tab);

      if (success) {

        await chrome.storage.local.set({
          selectedType: type
        });

        showStatus(
          'Facebook Manage Posts opened.',
          'success'
        );

      } else {

        showStatus(
          'Could not find Facebook "Manage posts".',
          'error'
        );
      }

    } catch (error) {

      console.error(
        '[ZeroTrace] Could not open Facebook Manage Posts:',
        error
      );

      showStatus(
        'Could not open Facebook Manage Posts.',
        'error'
      );
    }

    return;
  }

  // ==========================================================================
  // Platforms that require manual navigation
  // ==========================================================================

  if (
    typeof platform.requiresManualNavigation ===
      'function' &&
    platform.requiresManualNavigation()
  ) {

    const instructions =
      platform.getManualNavigationInstructions(
        type
      );

    showStatus(
      instructions,
      'info'
    );

    showPageStatus(
      `Open ${platform.name} and navigate to your ${type}`,
      false
    );

    return;
  }

  // ==========================================================================
  // Get destination URL from platform
  // ==========================================================================

  showStatus(
    `Finding your ${platform.name} destination...`,
    'info'
  );

  let urls;

  try {

    urls =
      await platform.getUrls(tab);

  } catch (error) {

    console.error(
      '[ZeroTrace] Could not get activity URLs:',
      error
    );

    showStatus(
      `Could not determine ${platform.name} destination.`,
      'error'
    );

    return;
  }

  const activityUrl =
    urls[type];

  if (!activityUrl) {

    showStatus(
      `${type} page not configured for ${platform.name}`,
      'error'
    );

    return;
  }

  // ==========================================================================
  // Navigate
  // ==========================================================================

  let navigationMessage =
    `Navigating to ${platform.name}...`;

  if (platform.id === 'facebook') {

    if (type === 'posts') {

      navigationMessage =
        'Navigating to your Facebook Posts';

    } else if (type === 'comments') {

      navigationMessage =
        'Navigating to your Facebook Comments';

    } else if (type === 'reactions') {

      navigationMessage =
        'Navigating to your Facebook Reactions';
    }
  }

  if (platform.id === 'twitter') {

    if (type === 'comments') {

      navigationMessage =
        'Navigating to your Twitter Posts';

    } else if (type === 'reactions') {

      navigationMessage =
        'Navigating to your Twitter Likes';

    } else if (type === 'replies') {

      navigationMessage =
        'Navigating to your Twitter Replies';

    } else if (type === 'reposts') {

      navigationMessage =
        'Navigating to your Twitter Reposts';
    }
  }

  showStatus(
    navigationMessage,
    'info'
  );

  console.log(
    `[ZeroTrace] ${platform.name} ${type} → ${activityUrl}`
  );

  await chrome.tabs.update(
    tab.id,
    {
      url: activityUrl
    }
  );

  await chrome.storage.local.set({
    selectedType: type
  });
}

// ============================================================================
// Deletion Process
// ============================================================================

async function startDeletion() {

  const [tab] =
    await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

  if (!tab || !tab.id) {

    showStatus(
      'Could not find active tab',
      'error'
    );

    return;
  }

  const platform =
    getCurrentPlatform();

  if (!platform) {

    showStatus(
      'Platform not found',
      'error'
    );

    return;
  }

  const storage =
    await chrome.storage.local.get([
      'selectedType'
    ]);

  const type =
    storage.selectedType || 'comments';

  console.log(
    '[ZeroTrace] Selected cleanup type:',
    type
  );

  const detection =
    platform.getPageDetection();

  let onCorrectPage =
    false;

  if (type === 'posts') {

    onCorrectPage =
      detection.posts &&
      detection.posts(tab.url);

  } else if (type === 'comments') {

    onCorrectPage =
      detection.comments(tab.url);

  } else if (type === 'reactions') {

    onCorrectPage =
      detection.reactions(tab.url);

  } else if (type === 'replies') {

    onCorrectPage =
      detection.replies &&
      detection.replies(tab.url);

  } else if (type === 'reposts') {

    onCorrectPage =
      detection.reposts &&
      detection.reposts(tab.url);
  }

  if (
    !tab.url ||
    !onCorrectPage
  ) {

    let pageName =
      'Posts/Comments';

    if (type === 'posts') {

      pageName =
        'Manage Posts';

    } else if (type === 'reactions') {

      pageName =
        'Likes';

    } else if (type === 'replies') {

      pageName =
        'Replies';

    } else if (type === 'reposts') {

      pageName =
        'Reposts';
    }

    showStatus(
      `Please navigate to the ${pageName} page first using Step 3!`,
      'error'
    );

    return;
  }

  const usageResult =
    await verifyAndTrackUsage(type);

  console.log(
    '[ZeroTrace] Usage verification result:',
    usageResult
  );

  if (!usageResult.allowed) {

    if (
      usageResult.reason ===
      'paywall_required'
    ) {

      showPaywallModal();

    } else {

      showStatus(
        'Could not verify usage. Please try again.',
        'error'
      );
    }

    return;
  }

  const checkbox =
    document.getElementById(
      'excludeOwnPosts'
    );

  const excludeOwnPosts =
    checkbox
      ? checkbox.checked
      : false;

  console.log(
    '[ZeroTrace] Starting cleanup:',
    {
      platform: platform.id,
      type: type,
      tabId: tab.id
    }
  );

  await chrome.storage.local.set({

    isDeleting: true,

    deleteType: type,

    excludeOwnPosts:
      excludeOwnPosts,

    deleteCounter: 0,

    deletePlatform:
      currentPlatform,

    unlimitedDeletion:
      usageResult.paid === true
  });

  // Switch from Start Deleting to Stop Deleting.
  updateDeletionUI(true);

  showStatus(
    'Deleting items... Keep tab open!',
    'info'
  );

  await executeCleanup(
    type,
    tab.id,
    excludeOwnPosts,
    platform
  );
}

// ============================================================================
// Stop Deletion
// ============================================================================

async function stopDeletion() {

  console.log(
    '[ZeroTrace] Stop deletion requested.'
  );

  await chrome.storage.local.set({
    isDeleting: false
  });

  // Stop any currently running cleanup script in the active tab.
  try {

    const [tab] =
      await chrome.tabs.query({
        active: true,
        currentWindow: true
      });

    if (tab && tab.id) {

      await chrome.scripting.executeScript({

        target: {
          tabId: tab.id
        },

        func: () => {
          window.stopDeleting = true;
        }

      });
    }

  } catch (error) {

    console.log(
      '[ZeroTrace] Could not signal cleanup script to stop:',
      error
    );
  }

  // Switch back to Start Deleting.
  updateDeletionUI(false);

  showStatus(
    'Cleanup stopped.',
    'info'
  );
}

// ============================================================================
// Execute Platform Cleanup
// ============================================================================

async function executeCleanup(
  type,
  tabId,
  excludeOwnPosts,
  platform
) {

  console.log(
    '[ZeroTrace] executeCleanup:',
    {
      platformId: platform.id,
      type: type,
      tabId: tabId
    }
  );

  try {

    const cleanupFunc =
      platform.getCleanupFunction();

    if (
      typeof cleanupFunc !== 'function'
    ) {

      throw new Error(
        `${platform.name} cleanup function is not available`
      );
    }

    console.log(
      `[ZeroTrace] Starting ${platform.name} cleanup: ${type}`
    );

    await chrome.scripting.executeScript({

      target: {
        tabId: tabId
      },

      func: cleanupFunc,

      args: [
        type,
        excludeOwnPosts
      ]

    });

    console.log(
      `[ZeroTrace] ${platform.name} cleanup script injected successfully.`
    );
    console.log('[ZeroTrace] Waiting for Facebook cleanup script to report back...');

  } catch (error) {

    console.error(
      '[ZeroTrace] Script injection error:',
      error
    );

    showStatus(
      `Error: ${error.message}`,
      'error'
    );

    await chrome.storage.local.set({
      isDeleting: false
    });

    // Make sure the UI returns to Start Deleting.
    updateDeletionUI(false);
  }
}

// ============================================================================
// Runtime Messages
// ============================================================================

chrome.runtime.onMessage.addListener(

  (message, sender, sendResponse) => {

    if (
      message.type === 'finished'
    ) {

      showStatus(
        `Completed! Processed ${message.count} items.`,
        'success'
      );

      chrome.storage.local.set({
        isDeleting: false
      });

      // Deletion finished, so return to Start Deleting.
      updateDeletionUI(false);

      return;
    }
  }
);

// ============================================================================
// Event Listeners
// ============================================================================

function setupEventListeners() {

  // --------------------------------------------------------------------------
  // Platform selector
  // --------------------------------------------------------------------------

  const platformSelector =
    document.getElementById(
      'platformSelector'
    );

  if (platformSelector) {

    platformSelector.addEventListener(
      'change',
      () => {

        setPlatform(
          platformSelector.value
        );

      }
    );
  }

  // --------------------------------------------------------------------------
  // Facebook Posts navigation
  // --------------------------------------------------------------------------

  const postsButton =
    document.getElementById(
      'navigatePosts'
    );

  if (postsButton) {

    postsButton.addEventListener(
      'click',
      async () => {

        hidePageStatus();

        await navigateToActivityPage(
          'posts'
        );

      }
    );
  }

  // --------------------------------------------------------------------------
  // Comments / Posts navigation
  // --------------------------------------------------------------------------

  const commentsButton =
    document.getElementById(
      'navigateComments'
    );

  if (commentsButton) {

    commentsButton.addEventListener(
      'click',
      async () => {

        hidePageStatus();

        await navigateToActivityPage(
          'comments'
        );

      }
    );
  }

  // --------------------------------------------------------------------------
  // Reactions / Likes navigation
  // --------------------------------------------------------------------------

  const reactionsButton =
    document.getElementById(
      'navigateReactions'
    );

  if (reactionsButton) {

    reactionsButton.addEventListener(
      'click',
      async () => {

        hidePageStatus();

        await navigateToActivityPage(
          'reactions'
        );

      }
    );
  }

  // --------------------------------------------------------------------------
  // Replies navigation
  // --------------------------------------------------------------------------

  const repliesButton =
    document.getElementById(
      'navigateReplies'
    );

  if (repliesButton) {

    repliesButton.addEventListener(
      'click',
      async () => {

        hidePageStatus();

        await navigateToActivityPage(
          'replies'
        );

      }
    );
  }

  // --------------------------------------------------------------------------
  // Reposts navigation
  // --------------------------------------------------------------------------

  const repostsButton =
    document.getElementById(
      'navigateReposts'
    );

  if (repostsButton) {

    repostsButton.addEventListener(
      'click',
      async () => {

        hidePageStatus();

        await navigateToActivityPage(
          'reposts'
        );

      }
    );
  }

  // --------------------------------------------------------------------------
  // Start deletion
  // --------------------------------------------------------------------------

  const startButton =
    document.getElementById(
      'startDeletion'
    );

  if (startButton) {

    startButton.addEventListener(
      'click',
      startDeletion
    );
  }

  // --------------------------------------------------------------------------
  // Stop deletion
  // --------------------------------------------------------------------------

  const stopButton =
    document.getElementById(
      'stopDeletion'
    );

  if (stopButton) {

    stopButton.addEventListener(
      'click',
      stopDeletion
    );
  }
}

// ============================================================================
// Restore State
// ============================================================================

async function restoreState() {

  const {
    isDeleting,
    deleteType,
    excludeOwnPosts,
    currentPlatform: savedPlatform
  } = await chrome.storage.local.get([
    'isDeleting',
    'deleteType',
    'excludeOwnPosts',
    'currentPlatform'
  ]);

  // --------------------------------------------------------------------------
  // Restore platform
  // --------------------------------------------------------------------------

  if (
    savedPlatform &&
    PlatformRegistry.has(savedPlatform)
  ) {

    currentPlatform =
      savedPlatform;

    document.body.className =
      `theme-${savedPlatform}`;

    const platformSelector =
      document.getElementById(
        'platformSelector'
      );

    if (platformSelector) {

      platformSelector.value =
        savedPlatform;
    }
  }

  // --------------------------------------------------------------------------
  // Restore platform-specific UI
  // --------------------------------------------------------------------------

  updatePlatformUI();

  // --------------------------------------------------------------------------
  // Restore checkbox if present
  // --------------------------------------------------------------------------

  if (
    excludeOwnPosts !== undefined
  ) {

    const checkbox =
      document.getElementById(
        'excludeOwnPosts'
      );

    if (checkbox) {

      checkbox.checked =
        excludeOwnPosts;
    }
  }

  // --------------------------------------------------------------------------
  // Restore deletion state
  // --------------------------------------------------------------------------

  // Popup opens in the normal Start Deleting state.

  updateDeletionUI(false);
}

// ============================================================================
// Initialization
// ============================================================================

async function initialize() {

  try {

    await restoreState();

    await checkCurrentPage();

    setupEventListeners();

    console.log(
      '[ZeroTrace] Popup initialized.'
    );

  } catch (error) {

    console.error(
      '[ZeroTrace] Popup initialization error:',
      error
    );

    showStatus(
      `Initialization error: ${error.message}`,
      'error'
    );
  }
}

initialize();
