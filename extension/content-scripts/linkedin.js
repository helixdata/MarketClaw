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
    // Click "Start a post" button - multiple strategies
    const startPostSelectors = [
      // New LinkedIn UI (2024+)
      'button[aria-label*="Start a post"]',
      'button[aria-label*="Create a post"]',
      '[data-view-name="share-box-feed-entry-trigger"]',
      // Legacy selectors
      '.share-box-feed-entry__trigger',
      'button.share-box-feed-entry__trigger',
      '[data-control-name="share.start"]',
      // Fallback: any button in the share box area
      '.share-box button',
      '.feed-shared-share-box button',
      // Text-based fallback
      
    ];
    
    let startButton = null;
    for (const selector of startPostSelectors) {
      try {
        startButton = document.querySelector(selector);
        if (startButton) break;
      } catch {
        // :has-text not supported, skip
        continue;
      }
    }
    
    // Fallback: find by text content
    if (!startButton) {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent?.toLowerCase().includes('start a post') ||
            btn.getAttribute('aria-label')?.toLowerCase().includes('start a post')) {
          startButton = btn;
          break;
        }
      }
    }
    
    if (startButton) {
      startButton.click();
      await delay(1500); // Longer wait for modal animation
    }
    
    // Wait for the post modal/editor - multiple strategies
    const editorSelectors = [
      // New LinkedIn UI (2024+)
      '[role="textbox"][aria-label*="share"]',
      '[role="textbox"][aria-label*="post"]',
      '[role="textbox"][contenteditable="true"]',
      '.share-creation-state__text-editor [contenteditable="true"]',
      // Quill editor (older)
      '.ql-editor[contenteditable="true"]',
      '[data-test-ql-editor="true"]',
      // Generic fallbacks
      '.editor-content [contenteditable="true"]',
      '[contenteditable="true"][data-placeholder]',
      // Modal-based
      '.share-box-modal [contenteditable="true"]',
      '[role="dialog"] [contenteditable="true"]',
    ];
    
    let editor = null;
    for (const selector of editorSelectors) {
      try {
        editor = await waitForElement(selector, 3000);
        if (editor) break;
      } catch {
        continue;
      }
    }
    
    // Fallback: find any contenteditable in a modal
    if (!editor) {
      const modal = document.querySelector('[role="dialog"]') || 
                    document.querySelector('.share-box-modal') ||
                    document.querySelector('.artdeco-modal');
      if (modal) {
        editor = modal.querySelector('[contenteditable="true"]');
      }
    }
    
    if (!editor) {
      return { success: false, error: 'Could not find LinkedIn post editor. Make sure the post dialog is open.' };
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
    
    // Find and click the post button - multiple strategies
    const postButtonSelectors = [
      // New LinkedIn UI (2024+)
      'button[aria-label*="Post"]',
      '[role="dialog"] button.artdeco-button--primary',
      '.share-box-modal button.artdeco-button--primary',
      // Legacy selectors
      '.share-actions__primary-action',
      'button.share-actions__primary-action',
      '[data-control-name="share.post"]',
      'button[type="submit"]',
      // Generic fallbacks
      '[role="dialog"] button[type="submit"]',
    ];
    
    let postButton = null;
    for (const selector of postButtonSelectors) {
      const btn = document.querySelector(selector);
      if (btn && !btn.disabled && btn.offsetParent !== null) {
        postButton = btn;
        break;
      }
    }
    
    // Fallback: find by text content
    if (!postButton) {
      const modal = document.querySelector('[role="dialog"]') || 
                    document.querySelector('.share-box-modal');
      if (modal) {
        const buttons = modal.querySelectorAll('button');
        for (const btn of buttons) {
          const text = btn.textContent?.toLowerCase() || '';
          if ((text === 'post' || text.includes('post')) && !btn.disabled) {
            postButton = btn;
            break;
          }
        }
      }
    }
    
    if (!postButton) {
      return { success: false, error: 'Could not find post button' };
    }
    
    if (postButton.disabled) {
      return { success: false, error: 'Post button is disabled - add some content first' };
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
