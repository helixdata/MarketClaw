/**
 * MarketClaw - Threads Content Script
 * 
 * Handles posting to Threads (Meta) via browser automation.
 * Supports: posts, replies.
 */

console.log('[MarketClaw] Threads content script loaded');

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
 * Open the compose modal
 */
async function openComposer() {
  // Threads has a compose button, usually a + icon or "New thread"
  const composerSelectors = [
    '[aria-label="Create"]',
    '[aria-label="New thread"]',
    'a[href="/create"]',
    'svg[aria-label="New thread"]'
  ];
  
  for (const selector of composerSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      const clickTarget = el.closest('a') || el.closest('button') || el.closest('div[role="button"]') || el;
      clickTarget.click();
      await delay(1000);
      return true;
    }
  }
  
  return false;
}

/**
 * Create a new thread
 */
async function createThread(content) {
  try {
    // Check if we need to open composer
    let textArea = document.querySelector('div[contenteditable="true"]');
    
    if (!textArea) {
      const opened = await openComposer();
      if (!opened) {
        return { success: false, error: 'Could not open thread composer. Make sure you are logged in.' };
      }
      await delay(500);
    }
    
    // Find text input
    const textAreaSelectors = [
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"][aria-label*="thread"]',
      'div[contenteditable="true"]',
      'p[data-text="true"]'
    ];
    
    textArea = null;
    for (const selector of textAreaSelectors) {
      textArea = document.querySelector(selector);
      if (textArea) break;
    }
    
    if (!textArea) {
      return { success: false, error: 'Could not find thread input' };
    }
    
    // Focus and type
    textArea.focus();
    textArea.click();
    await delay(200);
    
    // Type content
    textArea.textContent = '';
    document.execCommand('insertText', false, content);
    textArea.dispatchEvent(new Event('input', { bubbles: true }));
    await delay(500);
    
    // Find post button
    const postButton = await findPostButton();
    
    if (postButton) {
      postButton.click();
      await delay(2000);
      return { success: true, message: 'Thread posted successfully' };
    } else {
      return { success: false, error: 'Could not find Post button' };
    }
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Find the post/submit button
 */
async function findPostButton() {
  // Look for Post button
  const buttons = document.querySelectorAll('div[role="button"], button');
  for (const btn of buttons) {
    const text = btn.textContent?.trim().toLowerCase();
    if (text === 'post' || text === 'reply') {
      return btn;
    }
  }
  
  // Try aria-label
  for (const btn of buttons) {
    const label = btn.getAttribute('aria-label')?.toLowerCase();
    if (label?.includes('post') || label?.includes('reply')) {
      return btn;
    }
  }
  
  return null;
}

/**
 * Reply to a thread
 */
async function replyToThread(content) {
  try {
    // Find reply input - usually at the bottom of the thread
    const replySelectors = [
      'div[contenteditable="true"][aria-label*="Reply"]',
      'div[contenteditable="true"][aria-label*="reply"]',
      'div[contenteditable="true"][role="textbox"]'
    ];
    
    let replyBox = null;
    for (const selector of replySelectors) {
      replyBox = document.querySelector(selector);
      if (replyBox) break;
    }
    
    // Click reply button if needed
    if (!replyBox) {
      const replyBtns = document.querySelectorAll('div[role="button"], svg');
      for (const btn of replyBtns) {
        const label = btn.getAttribute('aria-label')?.toLowerCase() || '';
        if (label.includes('reply') || label.includes('comment')) {
          const clickTarget = btn.closest('div[role="button"]') || btn;
          clickTarget.click();
          await delay(500);
          break;
        }
      }
      
      // Try again
      for (const selector of replySelectors) {
        replyBox = document.querySelector(selector);
        if (replyBox) break;
      }
    }
    
    if (!replyBox) {
      return { success: false, error: 'Could not find reply input' };
    }
    
    // Type reply
    replyBox.focus();
    replyBox.click();
    await delay(100);
    
    document.execCommand('insertText', false, content);
    replyBox.dispatchEvent(new Event('input', { bubbles: true }));
    await delay(500);
    
    // Find and click post button
    const postButton = await findPostButton();
    
    if (postButton) {
      postButton.click();
      await delay(1500);
      return { success: true, message: 'Reply posted successfully' };
    } else {
      return { success: false, error: 'Could not find Reply button' };
    }
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Like a thread
 */
async function likeThread() {
  try {
    const likeSelectors = [
      'svg[aria-label="Like"]',
      '[aria-label="Like"]'
    ];
    
    let likeBtn = null;
    for (const selector of likeSelectors) {
      likeBtn = document.querySelector(selector);
      if (likeBtn) {
        const clickTarget = likeBtn.closest('div[role="button"]') || likeBtn;
        clickTarget.click();
        await delay(500);
        return { success: true, message: 'Liked thread successfully' };
      }
    }
    
    return { success: false, error: 'Could not find Like button' };
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Main handler
 */
async function postToThreads(content, options = {}) {
  const { action = 'post' } = options;
  
  switch (action) {
    case 'post':
      return await createThread(content);
    case 'reply':
    case 'comment':
      return await replyToThread(content);
    case 'like':
      return await likeThread();
    default:
      return { success: false, error: `Unknown action: ${action}` };
  }
}

/**
 * Listen for commands
 */
window.addEventListener('marketclaw:post', async (event) => {
  const { content, action } = event.detail;
  console.log('[MarketClaw] Threads action:', action);
  
  const result = await postToThreads(content, { action });
  
  window.dispatchEvent(new CustomEvent('marketclaw:postResult', {
    detail: result
  }));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'post') {
    postToThreads(message.content, message).then(sendResponse);
    return true;
  }
});
