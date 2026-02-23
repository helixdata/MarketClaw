/**
 * MarketClaw - Reddit Content Script
 * 
 * Handles posting to Reddit via browser automation.
 * Supports both new Reddit and old Reddit.
 */

console.log('[MarketClaw] Reddit content script loaded');

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
 * Check if we're on old Reddit
 */
function isOldReddit() {
  return window.location.hostname === 'old.reddit.com';
}

/**
 * Post to new Reddit
 */
async function postNewReddit(content, options = {}) {
  const { subreddit, title, type = 'text' } = options;
  
  try {
    // If subreddit specified, navigate to submit page
    if (subreddit) {
      const submitUrl = `https://www.reddit.com/r/${subreddit}/submit`;
      if (!window.location.href.includes(submitUrl)) {
        window.location.href = submitUrl;
        // Wait for navigation
        await delay(2000);
      }
    }
    
    // Wait for the post type selector or text area
    // New Reddit has tabs for different post types
    const textTabSelectors = [
      'button[role="tab"]:has-text("Text")',
      '[data-testid="post-composer-text-tab"]',
      'button:contains("Text")'
    ];
    
    // Try to click the Text tab if it exists
    for (const selector of textTabSelectors) {
      try {
        const tab = document.querySelector(selector);
        if (tab) {
          tab.click();
          await delay(500);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    // Find title input
    const titleSelectors = [
      'textarea[placeholder*="Title"]',
      'input[placeholder*="Title"]',
      '[data-testid="post-title-input"]',
      'textarea[name="title"]'
    ];
    
    let titleInput = null;
    for (const selector of titleSelectors) {
      titleInput = document.querySelector(selector);
      if (titleInput) break;
    }
    
    if (titleInput && title) {
      titleInput.focus();
      titleInput.value = '';
      document.execCommand('insertText', false, title);
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      await delay(300);
    }
    
    // Find content/body input
    const bodySelectors = [
      'div[contenteditable="true"][data-lexical-editor="true"]',
      'textarea[placeholder*="Text"]',
      '[data-testid="post-body-input"]',
      'div[role="textbox"]',
      '.public-DraftEditor-content',
      'textarea[name="text"]'
    ];
    
    let bodyInput = null;
    for (const selector of bodySelectors) {
      bodyInput = document.querySelector(selector);
      if (bodyInput) break;
    }
    
    if (bodyInput) {
      bodyInput.focus();
      bodyInput.click();
      await delay(100);
      
      // Clear and type content
      if (bodyInput.tagName === 'TEXTAREA') {
        bodyInput.value = '';
        document.execCommand('insertText', false, content);
      } else {
        // Contenteditable div
        bodyInput.textContent = '';
        document.execCommand('insertText', false, content);
      }
      
      bodyInput.dispatchEvent(new Event('input', { bubbles: true }));
      await delay(500);
    }
    
    // Find and click post button
    const postButtonSelectors = [
      'button[type="submit"]:has-text("Post")',
      '[data-testid="post-submit-button"]',
      'button:contains("Post")',
      'button.submit'
    ];
    
    let postButton = null;
    for (const selector of postButtonSelectors) {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent?.toLowerCase().includes('post') && !btn.disabled) {
          postButton = btn;
          break;
        }
      }
      if (postButton) break;
    }
    
    if (postButton) {
      postButton.click();
      await delay(2000);
      return { success: true, message: 'Posted to Reddit successfully' };
    } else {
      return { success: false, error: 'Could not find post button' };
    }
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Post to old Reddit
 */
async function postOldReddit(content, options = {}) {
  const { subreddit, title } = options;
  
  try {
    // Find title input
    const titleInput = document.querySelector('textarea[name="title"], input[name="title"]');
    if (titleInput && title) {
      titleInput.value = title;
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      await delay(200);
    }
    
    // Click self post tab if available
    const selfTab = document.querySelector('#text-field, .text-button, a[href*="selftext=true"]');
    if (selfTab) {
      selfTab.click();
      await delay(500);
    }
    
    // Find text area
    const textArea = document.querySelector('textarea[name="text"]');
    if (textArea) {
      textArea.value = content;
      textArea.dispatchEvent(new Event('input', { bubbles: true }));
      await delay(300);
    }
    
    // Find submit button
    const submitButton = document.querySelector('button[type="submit"], input[type="submit"]');
    if (submitButton) {
      submitButton.click();
      await delay(2000);
      return { success: true, message: 'Posted to Reddit (old) successfully' };
    } else {
      return { success: false, error: 'Could not find submit button' };
    }
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Comment on a post
 */
async function commentOnPost(content) {
  try {
    // Find comment box
    const commentSelectors = [
      'div[contenteditable="true"][data-lexical-editor="true"]',
      'textarea[placeholder*="comment"]',
      'div[data-testid="comment-composer"]',
      '.public-DraftEditor-content',
      'textarea[name="text"]'
    ];
    
    let commentBox = null;
    for (const selector of commentSelectors) {
      commentBox = document.querySelector(selector);
      if (commentBox) break;
    }
    
    if (!commentBox) {
      // Try clicking "Add a comment" button first
      const addCommentBtn = document.querySelector('button:contains("Add a comment"), [placeholder*="Add a comment"]');
      if (addCommentBtn) {
        addCommentBtn.click();
        await delay(500);
        // Try finding comment box again
        for (const selector of commentSelectors) {
          commentBox = document.querySelector(selector);
          if (commentBox) break;
        }
      }
    }
    
    if (!commentBox) {
      return { success: false, error: 'Could not find comment box' };
    }
    
    commentBox.focus();
    commentBox.click();
    await delay(100);
    
    if (commentBox.tagName === 'TEXTAREA') {
      commentBox.value = content;
    } else {
      document.execCommand('insertText', false, content);
    }
    
    commentBox.dispatchEvent(new Event('input', { bubbles: true }));
    await delay(500);
    
    // Find comment submit button
    const submitSelectors = [
      'button[type="submit"]:has-text("Comment")',
      '[data-testid="comment-submit-button"]',
      'button:contains("Comment")'
    ];
    
    let submitBtn = null;
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.textContent?.toLowerCase().includes('comment') && !btn.disabled) {
        submitBtn = btn;
        break;
      }
    }
    
    if (submitBtn) {
      submitBtn.click();
      await delay(1500);
      return { success: true, message: 'Comment posted successfully' };
    } else {
      return { success: false, error: 'Could not find comment button' };
    }
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Post to Reddit (auto-detect old vs new)
 */
async function postToReddit(content, options = {}) {
  const { action = 'post' } = options;
  
  if (action === 'comment') {
    return await commentOnPost(content);
  }
  
  if (isOldReddit()) {
    return await postOldReddit(content, options);
  } else {
    return await postNewReddit(content, options);
  }
}

/**
 * Listen for post commands from background script
 */
window.addEventListener('marketclaw:post', async (event) => {
  const { content, subreddit, title, action } = event.detail;
  
  console.log('[MarketClaw] Reddit post:', { subreddit, title, action });
  
  const result = await postToReddit(content, { subreddit, title, action });
  
  window.dispatchEvent(new CustomEvent('marketclaw:postResult', {
    detail: result
  }));
});

// Also listen for direct messages from extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'post') {
    postToReddit(message.content, message).then(sendResponse);
    return true;
  }
});
