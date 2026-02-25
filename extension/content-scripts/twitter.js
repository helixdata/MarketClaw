/**
 * MarketClaw - Twitter/X Content Script
 * 
 * Handles posting tweets via browser automation.
 */

console.log('[MarketClaw] Twitter content script loaded');

// Prevent duplicate posts
let lastPostContent = '';
let lastPostTime = 0;

/**
 * Wait for an element to appear
 */
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = () => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Element not found: ${selector}`));
      } else {
        setTimeout(check, 200);
      }
    };
    
    check();
  });
}

/**
 * Wait for a short delay
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Type text into an element naturally
 */
async function typeText(element, text) {
  element.focus();
  await delay(100);
  
  // Clear existing content first
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
  
  // Delete any existing content
  document.execCommand('delete', false, null);
  await delay(50);
  
  // Insert text using execCommand (works with Draft.js)
  // Don't dispatch extra events - let Draft.js handle it
  document.execCommand('insertText', false, text);
}

/**
 * Dismiss any modal dialogs (like "You've unlocked more on X")
 */
async function dismissModals() {
  const modalSelectors = [
    '[data-testid="sheetDialog"] button', // Generic sheet dialog
    '[role="dialog"] button[type="button"]', // Dialog buttons
    'div[data-testid="confirmationSheetConfirm"]', // Confirmation buttons
  ];
  
  for (const selector of modalSelectors) {
    try {
      const buttons = document.querySelectorAll(selector);
      for (const btn of buttons) {
        const text = btn.textContent?.toLowerCase() || '';
        if (text.includes('got it') || text.includes('dismiss') || text.includes('close') || text.includes('not now')) {
          console.log('[MarketClaw] Dismissing modal:', text);
          btn.click();
          await delay(500);
          return true;
        }
      }
    } catch (e) {
      console.warn('[MarketClaw] Invalid selector:', selector);
    }
  }
  
  // Also check all buttons for dismissal text
  const allButtons = document.querySelectorAll('button');
  for (const btn of allButtons) {
    const text = btn.textContent?.toLowerCase() || '';
    if (text === 'got it' || text === 'dismiss' || text === 'not now') {
      console.log('[MarketClaw] Dismissing modal via button text:', text);
      btn.click();
      await delay(500);
      return true;
    }
  }
  
  // Try aria-label approach
  const closeButtons = document.querySelectorAll('[aria-label="Close"], [aria-label="Dismiss"]');
  for (const btn of closeButtons) {
    btn.click();
    await delay(500);
    return true;
  }
  
  return false;
}

/**
 * Post a tweet
 */
async function postTweet(content, mediaUrls = []) {
  try {
    // Prevent duplicate posts (same content within 5 seconds)
    const now = Date.now();
    if (content === lastPostContent && now - lastPostTime < 5000) {
      console.log('[MarketClaw] Ignoring duplicate post request');
      return { success: false, error: 'Duplicate post request ignored' };
    }
    lastPostContent = content;
    lastPostTime = now;
    
    // First, dismiss any modals that might be in the way
    await dismissModals();
    
    // Check if we're on compose page or need to open composer
    const isComposePage = window.location.pathname.includes('/compose/tweet');
    
    if (!isComposePage) {
      // Look for the tweet button to open composer
      const tweetButton = document.querySelector('[data-testid="SideNav_NewTweet_Button"]') ||
                          document.querySelector('a[href="/compose/tweet"]');
      
      if (tweetButton) {
        tweetButton.click();
        await delay(1000);
      }
    }
    
    // Wait for the tweet composer
    const composerSelectors = [
      '[data-testid="tweetTextarea_0"]',
      '[data-testid="tweetTextarea_0_label"]',
      '[role="textbox"][data-testid="tweetTextarea_0"]',
      '.public-DraftEditor-content',
      '[data-contents="true"]'
    ];
    
    let composer = null;
    for (const selector of composerSelectors) {
      try {
        composer = await waitForElement(selector, 5000);
        break;
      } catch {
        continue;
      }
    }
    
    if (!composer) {
      return { success: false, error: 'Could not find tweet composer' };
    }
    
    // Find the actual editable element
    const editableDiv = composer.querySelector('[contenteditable="true"]') || 
                        composer.closest('[contenteditable="true"]') ||
                        composer;
    
    // Click to focus
    editableDiv.click();
    await delay(300);
    
    // Type the content
    await typeText(editableDiv, content);
    await delay(500);
    
    // Find and click the post button
    const postButtonSelectors = [
      '[data-testid="tweetButton"]',
      '[data-testid="tweetButtonInline"]',
      'button[type="submit"]'
    ];
    
    let postButton = null;
    for (const selector of postButtonSelectors) {
      postButton = document.querySelector(selector);
      if (postButton && !postButton.disabled) break;
    }
    
    if (!postButton) {
      return { success: false, error: 'Could not find post button' };
    }
    
    if (postButton.disabled) {
      return { success: false, error: 'Post button is disabled - tweet may be empty or invalid' };
    }
    
    // Click post button
    postButton.click();
    
    // Wait for confirmation
    await delay(2000);
    
    // Dismiss any post-submit modals (like "You've unlocked more on X")
    await dismissModals();
    await delay(500);
    
    // Check if composer closed (indicates success)
    const composerStillOpen = document.querySelector('[data-testid="tweetTextarea_0"]');
    
    if (!composerStillOpen || isComposePage) {
      return { success: true, message: 'Tweet posted successfully' };
    } else {
      // Check for error messages
      const errorEl = document.querySelector('[data-testid="toast"]') ||
                      document.querySelector('[role="alert"]');
      
      if (errorEl) {
        return { success: false, error: errorEl.textContent };
      }
      
      return { success: true, message: 'Tweet likely posted (composer may still be visible)' };
    }
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Listen for post commands from background script (prevent duplicate registration)
 */
if (!window._marketClawTwitterEventRegistered) {
  window._marketClawTwitterEventRegistered = true;
  
  window.addEventListener('marketclaw:post', async (event) => {
    const { content, mediaUrls } = event.detail;
    
    console.log('[MarketClaw] Posting tweet:', content.length, 'chars:', content.substring(0, 100) + (content.length > 100 ? '...' : ''));
    
    const result = await postTweet(content, mediaUrls);
    
    // Send result back
    window.dispatchEvent(new CustomEvent('marketclaw:postResult', {
      detail: result
    }));
  });
}

// Also listen for direct messages from extension (prevent duplicate registration)
if (!window._marketClawTwitterListenerRegistered) {
  window._marketClawTwitterListenerRegistered = true;
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'post') {
      postTweet(message.content, message.mediaUrls).then(sendResponse);
      return true; // Async response
    }
  });
}
