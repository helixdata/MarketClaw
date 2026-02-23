/**
 * MarketClaw - Facebook Content Script
 * 
 * Handles posting to Facebook via browser automation.
 * Supports: posts, comments, page posts.
 */

console.log('[MarketClaw] Facebook content script loaded');

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
  const composerSelectors = [
    '[aria-label="Create a post"]',
    '[aria-label*="What\'s on your mind"]',
    'div[role="button"]:has-text("What\'s on your mind")',
    '[data-pagelet="FeedComposer"] div[role="button"]'
  ];
  
  for (const selector of composerSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      el.click();
      await delay(1000);
      return true;
    }
  }
  
  // Try finding by text content
  const buttons = document.querySelectorAll('div[role="button"], span');
  for (const btn of buttons) {
    if (btn.textContent?.includes("What's on your mind")) {
      btn.click();
      await delay(1000);
      return true;
    }
  }
  
  return false;
}

/**
 * Create a new post
 */
async function createPost(content) {
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
    
    // Find the text input area
    const textAreaSelectors = [
      'div[contenteditable="true"][aria-label*="What\'s on your mind"]',
      'div[contenteditable="true"][role="textbox"]',
      'div[data-contents="true"]',
      'div[contenteditable="true"]'
    ];
    
    let textArea = null;
    for (const selector of textAreaSelectors) {
      textArea = document.querySelector(selector);
      if (textArea) break;
    }
    
    if (!textArea) {
      return { success: false, error: 'Could not find post input area' };
    }
    
    // Focus and type
    textArea.focus();
    textArea.click();
    await delay(200);
    
    // Clear and type content
    textArea.textContent = '';
    document.execCommand('insertText', false, content);
    textArea.dispatchEvent(new Event('input', { bubbles: true }));
    await delay(500);
    
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
      return { success: true, message: 'Posted to Facebook successfully' };
    } else {
      return { success: false, error: 'Could not find Post button' };
    }
    
  } catch (err) {
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
 * Listen for commands
 */
window.addEventListener('marketclaw:post', async (event) => {
  const { content, action } = event.detail;
  console.log('[MarketClaw] Facebook action:', action);
  
  const result = await postToFacebook(content, { action });
  
  window.dispatchEvent(new CustomEvent('marketclaw:postResult', {
    detail: result
  }));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'post') {
    postToFacebook(message.content, message).then(sendResponse);
    return true;
  }
});
