/**
 * MarketClaw - Facebook Content Script
 * 
 * Handles posting to Facebook via browser automation.
 * Supports: posts, comments, page posts.
 */

console.log('[MarketClaw] Facebook content script loaded');

// Prevent duplicate execution
let isPosting = false;

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
 * Click the "What's on your mind?" to open composer
 */
async function openComposer() {
  console.log('[MarketClaw] Attempting to open Facebook composer...');
  
  // Look for the composer trigger - can be a span with the text or the containing div
  const allSpans = document.querySelectorAll('span');
  for (const span of allSpans) {
    if (span.textContent?.includes("What's on your mind")) {
      // Click the span or its clickable parent
      const clickable = span.closest('div[role="button"]') || span.closest('div[tabindex]') || span;
      console.log('[MarketClaw] Found composer trigger via span');
      clickable.click();
      await delay(1000);
      return true;
    }
  }
  
  // Try aria-label selectors
  const composerSelectors = [
    '[aria-label="Create a post"]',
    '[aria-label*="What\'s on your mind"]',
    '[data-pagelet="FeedComposer"] div[role="button"]'
  ];
  
  for (const selector of composerSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      console.log('[MarketClaw] Found composer trigger via selector:', selector);
      el.click();
      await delay(1000);
      return true;
    }
  }
  
  console.log('[MarketClaw] Could not find composer trigger');
  return false;
}

/**
 * Create a new post
 */
async function createPost(content) {
  if (isPosting) {
    console.log('[MarketClaw] Already posting, ignoring duplicate request');
    return { success: false, error: 'Already posting' };
  }
  isPosting = true;
  
  try {
    // Try to open composer if not already open
    const composerOpen = document.querySelector('[aria-label="Create post"], div[role="dialog"]');
    if (!composerOpen) {
      const opened = await openComposer();
      if (!opened) {
        return { success: false, error: 'Could not open post composer' };
      }
    }
    
    await delay(500);
    
    // Find the text input area (Facebook uses Lexical editor)
    const textAreaSelectors = [
      'div[contenteditable="true"][data-lexical-editor="true"]',
      'div[contenteditable="true"][aria-placeholder*="What\'s on your mind"]',
      'div[contenteditable="true"][role="textbox"]',
      'div[data-contents="true"]',
      'div[contenteditable="true"]'
    ];
    
    let textArea = null;
    for (const selector of textAreaSelectors) {
      const candidates = document.querySelectorAll(selector);
      // Pick the one in a dialog if multiple exist
      for (const el of candidates) {
        const inDialog = el.closest('div[role="dialog"]');
        if (inDialog) {
          textArea = el;
          break;
        }
      }
      if (textArea) break;
      // Fallback to first match
      if (candidates.length > 0) {
        textArea = candidates[0];
        break;
      }
    }
    
    if (!textArea) {
      return { success: false, error: 'Could not find post input area' };
    }
    
    // Focus the text area
    textArea.focus();
    await delay(200);
    
    // Check if there's already content (from previous attempt)
    const existingText = textArea.textContent?.trim();
    if (existingText && existingText.length > 0) {
      console.log('[MarketClaw] Composer already has content, clearing first');
      // Select all and delete
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(textArea);
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand('delete', false, null);
      await delay(200);
    }
    
    // Type the content character-by-character simulation via insertText
    textArea.focus();
    document.execCommand('insertText', false, content);
    await delay(300);
    
    console.log('[MarketClaw] Typed content into Facebook composer');
    
    // Find post button
    const postButtonSelectors = [
      'div[aria-label="Post"][role="button"]',
      'button[name="Post"]',
      'div[role="button"]:has-text("Post")'
    ];
    
    let postButton = null;
    
    // Find by aria-label or text
    const buttons = document.querySelectorAll('div[role="button"], button');
    for (const btn of buttons) {
      const label = btn.getAttribute('aria-label');
      const text = btn.textContent?.trim();
      if (label === 'Post' || text === 'Post') {
        // Make sure it's not disabled
        if (!btn.getAttribute('aria-disabled') || btn.getAttribute('aria-disabled') === 'false') {
          postButton = btn;
          break;
        }
      }
    }
    
    if (postButton) {
      postButton.click();
      await delay(2000);
      isPosting = false;
      return { success: true, message: 'Posted to Facebook successfully' };
    } else {
      isPosting = false;
      return { success: false, error: 'Could not find Post button' };
    }
    
  } catch (err) {
    isPosting = false;
    return { success: false, error: err.message };
  }
}

/**
 * Comment on a post
 */
async function postComment(content) {
  try {
    // Find comment input
    const commentSelectors = [
      'div[contenteditable="true"][aria-label*="Write a comment"]',
      'div[contenteditable="true"][aria-label*="comment"]',
      'div[role="textbox"][aria-label*="comment"]'
    ];
    
    let commentBox = null;
    for (const selector of commentSelectors) {
      commentBox = document.querySelector(selector);
      if (commentBox) break;
    }
    
    // Try clicking comment button first
    if (!commentBox) {
      const commentBtns = document.querySelectorAll('div[role="button"]');
      for (const btn of commentBtns) {
        if (btn.textContent?.toLowerCase().includes('comment')) {
          btn.click();
          await delay(500);
          break;
        }
      }
      
      // Try again
      for (const selector of commentSelectors) {
        commentBox = document.querySelector(selector);
        if (commentBox) break;
      }
    }
    
    if (!commentBox) {
      return { success: false, error: 'Could not find comment input' };
    }
    
    // Type comment
    commentBox.focus();
    commentBox.click();
    await delay(100);
    
    document.execCommand('insertText', false, content);
    commentBox.dispatchEvent(new Event('input', { bubbles: true }));
    await delay(300);
    
    // Press Enter or find submit button
    commentBox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
    await delay(1000);
    
    return { success: true, message: 'Comment posted successfully' };
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Like a post
 */
async function likePost() {
  try {
    const likeSelectors = [
      'div[aria-label="Like"][role="button"]',
      'span[aria-label="Like"]'
    ];
    
    let likeBtn = null;
    for (const selector of likeSelectors) {
      likeBtn = document.querySelector(selector);
      if (likeBtn) break;
    }
    
    // Find by aria-label
    if (!likeBtn) {
      const buttons = document.querySelectorAll('div[role="button"], span');
      for (const btn of buttons) {
        if (btn.getAttribute('aria-label') === 'Like') {
          likeBtn = btn;
          break;
        }
      }
    }
    
    if (likeBtn) {
      likeBtn.click();
      await delay(500);
      return { success: true, message: 'Liked post successfully' };
    } else {
      return { success: false, error: 'Could not find Like button' };
    }
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Main handler
 */
async function postToFacebook(content, options = {}) {
  const { action = 'post' } = options;
  
  switch (action) {
    case 'post':
      return await createPost(content);
    case 'comment':
      return await postComment(content);
    case 'like':
      return await likePost();
    default:
      return { success: false, error: `Unknown action: ${action}` };
  }
}

/**
 * Listen for commands (WebSocket flow)
 */
if (!window._marketClawEventListenerRegistered) {
  window._marketClawEventListenerRegistered = true;
  
  window.addEventListener('marketclaw:post', async (event) => {
    const { content, action } = event.detail;
    console.log('[MarketClaw] Facebook action:', action);
    
    const result = await postToFacebook(content, { action });
    
    window.dispatchEvent(new CustomEvent('marketclaw:postResult', {
      detail: result
    }));
  });
}

// Track if listener is already registered (prevents duplicate registration)
if (!window._marketClawListenerRegistered) {
  window._marketClawListenerRegistered = true;
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[MarketClaw] Facebook received message:', message, 'at', Date.now());
    if (message.action === 'post') {
      postToFacebook(message.content, message)
        .then(result => {
          console.log('[MarketClaw] Facebook post result:', result);
          sendResponse(result);
        })
        .catch(err => {
          console.error('[MarketClaw] Facebook post error:', err);
          sendResponse({ success: false, error: err.message });
        });
      return true;
    }
  });
}
