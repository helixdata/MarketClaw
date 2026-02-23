/**
 * MarketClaw - Product Hunt Content Script
 * 
 * Handles interaction with Product Hunt via browser automation.
 * Supports: upvoting, commenting, and viewing product info.
 * Note: Launching products requires the official PH process.
 */

console.log('[MarketClaw] Product Hunt content script loaded');

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
 * Check if user is logged in
 */
function isLoggedIn() {
  // PH shows avatar/profile if logged in
  const profileMenu = document.querySelector('[data-test="user-menu"]') ||
                      document.querySelector('img[alt*="avatar"]') ||
                      document.querySelector('[aria-label*="profile"]');
  return !!profileMenu;
}

/**
 * Upvote a product
 */
async function upvoteProduct() {
  try {
    // Find upvote button
    const upvoteSelectors = [
      'button[data-test="vote-button"]',
      '[data-test="upvote-button"]',
      'button:has(svg[data-test="chevron-up-icon"])',
      'button:contains("UPVOTE")',
      '[aria-label*="Upvote"]'
    ];
    
    let upvoteBtn = null;
    
    // Try selectors
    for (const selector of upvoteSelectors) {
      upvoteBtn = document.querySelector(selector);
      if (upvoteBtn) break;
    }
    
    // Also look for buttons with upvote-like content
    if (!upvoteBtn) {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const text = btn.textContent?.toUpperCase() || '';
        const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
        if (text.includes('UPVOTE') || ariaLabel.includes('upvote') || ariaLabel.includes('vote')) {
          upvoteBtn = btn;
          break;
        }
      }
    }
    
    if (upvoteBtn) {
      upvoteBtn.click();
      await delay(1000);
      
      // Check if we need to log in
      const loginModal = document.querySelector('[data-test="login-modal"]') ||
                         document.querySelector('div[role="dialog"]:contains("Log in")');
      if (loginModal) {
        return { success: false, error: 'Login required to upvote' };
      }
      
      return { success: true, message: 'Upvoted product successfully' };
    } else {
      return { success: false, error: 'Could not find upvote button' };
    }
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Post a comment on a product
 */
async function postComment(content) {
  try {
    // Find comment input
    const commentSelectors = [
      'textarea[placeholder*="comment"]',
      'div[contenteditable="true"]',
      '[data-test="comment-input"]',
      'textarea[data-test="comment-textarea"]'
    ];
    
    let commentBox = null;
    for (const selector of commentSelectors) {
      commentBox = document.querySelector(selector);
      if (commentBox) break;
    }
    
    // Try clicking "Add a comment" if no comment box found
    if (!commentBox) {
      const addCommentBtn = document.querySelector('button:contains("Add a comment")') ||
                            document.querySelector('[placeholder*="Add a comment"]');
      
      // Find by text content
      const buttons = document.querySelectorAll('button, div[role="button"]');
      for (const btn of buttons) {
        if (btn.textContent?.toLowerCase().includes('add a comment') ||
            btn.textContent?.toLowerCase().includes('write a comment')) {
          btn.click();
          await delay(500);
          break;
        }
      }
      
      // Try finding comment box again
      for (const selector of commentSelectors) {
        commentBox = document.querySelector(selector);
        if (commentBox) break;
      }
    }
    
    if (!commentBox) {
      return { success: false, error: 'Could not find comment input' };
    }
    
    // Focus and type
    commentBox.focus();
    commentBox.click();
    await delay(100);
    
    if (commentBox.tagName === 'TEXTAREA') {
      commentBox.value = content;
    } else {
      // Contenteditable
      commentBox.textContent = '';
      document.execCommand('insertText', false, content);
    }
    
    commentBox.dispatchEvent(new Event('input', { bubbles: true }));
    await delay(500);
    
    // Find submit button
    const submitSelectors = [
      'button[type="submit"]',
      'button:contains("Post")',
      'button:contains("Comment")',
      '[data-test="submit-comment"]'
    ];
    
    let submitBtn = null;
    
    // Try selectors
    for (const selector of submitSelectors) {
      submitBtn = document.querySelector(selector);
      if (submitBtn) break;
    }
    
    // Find by text
    if (!submitBtn) {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const text = btn.textContent?.toLowerCase() || '';
        if ((text === 'post' || text === 'comment' || text === 'submit') && !btn.disabled) {
          submitBtn = btn;
          break;
        }
      }
    }
    
    if (submitBtn) {
      submitBtn.click();
      await delay(1500);
      return { success: true, message: 'Comment posted successfully' };
    } else {
      return { success: false, error: 'Could not find submit button' };
    }
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Reply to a specific comment
 */
async function replyToComment(content, parentCommentId) {
  try {
    // Find the reply button for the specific comment
    let replyBtn = null;
    
    if (parentCommentId) {
      const parentComment = document.querySelector(`[data-comment-id="${parentCommentId}"]`) ||
                            document.getElementById(parentCommentId);
      if (parentComment) {
        replyBtn = parentComment.querySelector('button:contains("Reply")');
      }
    }
    
    // If no specific comment, find the first reply button
    if (!replyBtn) {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent?.toLowerCase().includes('reply')) {
          replyBtn = btn;
          break;
        }
      }
    }
    
    if (replyBtn) {
      replyBtn.click();
      await delay(500);
    }
    
    // Now post the comment as normal
    return await postComment(content);
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Get product info from current page
 */
function getProductInfo() {
  const titleEl = document.querySelector('h1') ||
                  document.querySelector('[data-test="product-name"]');
  const taglineEl = document.querySelector('[data-test="product-tagline"]') ||
                    document.querySelector('h1 + p');
  const votesEl = document.querySelector('[data-test="vote-count"]') ||
                  document.querySelector('button[data-test="vote-button"] span');
  const makerEls = document.querySelectorAll('[data-test="maker-name"]');
  
  return {
    title: titleEl?.textContent?.trim(),
    tagline: taglineEl?.textContent?.trim(),
    votes: votesEl?.textContent?.trim(),
    makers: Array.from(makerEls).map(el => el.textContent?.trim())
  };
}

/**
 * Main post handler
 */
async function postToPH(content, options = {}) {
  const { action = 'comment', commentId } = options;
  
  switch (action) {
    case 'upvote':
      return await upvoteProduct();
    case 'comment':
      return await postComment(content);
    case 'reply':
      return await replyToComment(content, commentId);
    case 'info':
      return { success: true, result: getProductInfo() };
    default:
      return { success: false, error: `Unknown action: ${action}` };
  }
}

/**
 * Listen for post commands from background script
 */
window.addEventListener('marketclaw:post', async (event) => {
  const { content, action, commentId } = event.detail;
  
  console.log('[MarketClaw] Product Hunt action:', action);
  
  const result = await postToPH(content, { action, commentId });
  
  window.dispatchEvent(new CustomEvent('marketclaw:postResult', {
    detail: result
  }));
});

// Also listen for direct messages from extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'post') {
    postToPH(message.content, message).then(sendResponse);
    return true;
  }
});
