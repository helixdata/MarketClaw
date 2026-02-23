/**
 * MarketClaw - LinkedIn Content Script
 * 
 * Handles posting to LinkedIn via browser automation.
 */

console.log('[MarketClaw] LinkedIn content script loaded');

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
 * Post to LinkedIn
 */
async function postToLinkedIn(content, mediaUrls = []) {
  try {
    // Click "Start a post" button
    const startPostSelectors = [
      '.share-box-feed-entry__trigger',
      'button.share-box-feed-entry__trigger',
      '[data-control-name="share.start"]',
      '.artdeco-card button'
    ];
    
    let startButton = null;
    for (const selector of startPostSelectors) {
      startButton = document.querySelector(selector);
      if (startButton) break;
    }
    
    if (startButton) {
      startButton.click();
      await delay(1000);
    }
    
    // Wait for the post modal/editor
    const editorSelectors = [
      '.ql-editor',
      '[data-test-ql-editor="true"]',
      '.share-creation-state__text-editor .ql-editor',
      '[contenteditable="true"]'
    ];
    
    let editor = null;
    for (const selector of editorSelectors) {
      try {
        editor = await waitForElement(selector, 5000);
        break;
      } catch {
        continue;
      }
    }
    
    if (!editor) {
      return { success: false, error: 'Could not find LinkedIn post editor' };
    }
    
    // Click to focus
    editor.click();
    await delay(300);
    
    // Clear and type content
    editor.innerHTML = '';
    editor.focus();
    
    // Insert text with proper formatting
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      document.execCommand('insertText', false, lines[i]);
      if (i < lines.length - 1) {
        document.execCommand('insertLineBreak', false, null);
      }
    }
    
    // Trigger events
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    await delay(500);
    
    // Find and click the post button
    const postButtonSelectors = [
      '.share-actions__primary-action',
      'button.share-actions__primary-action',
      '[data-control-name="share.post"]',
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
      return { success: false, error: 'Post button is disabled' };
    }
    
    // Click post
    postButton.click();
    await delay(2000);
    
    // Check for success
    const modal = document.querySelector('.share-box-modal');
    if (!modal) {
      return { success: true, message: 'LinkedIn post published successfully' };
    }
    
    // Check for errors
    const errorEl = document.querySelector('.artdeco-toast-item--error') ||
                    document.querySelector('[role="alert"]');
    
    if (errorEl) {
      return { success: false, error: errorEl.textContent };
    }
    
    return { success: true, message: 'LinkedIn post likely published' };
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Listen for post commands
 */
window.addEventListener('marketclaw:post', async (event) => {
  const { content, mediaUrls } = event.detail;
  
  console.log('[MarketClaw] Posting to LinkedIn:', content.substring(0, 50) + '...');
  
  const result = await postToLinkedIn(content, mediaUrls);
  
  window.dispatchEvent(new CustomEvent('marketclaw:postResult', {
    detail: result
  }));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'post') {
    postToLinkedIn(message.content, message.mediaUrls).then(sendResponse);
    return true;
  }
});
