/**
 * MarketClaw - Bluesky Content Script
 * 
 * Handles posting to Bluesky via browser automation.
 * Supports: posts, replies, likes, reposts.
 */

console.log('[MarketClaw] Bluesky content script loaded');

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
  // Bluesky has a floating compose button
  const composerSelectors = [
    '[aria-label="New post"]',
    '[aria-label="Compose post"]',
    'button[aria-label*="post"]',
    '[data-testid="composeFAB"]'
  ];
  
  for (const selector of composerSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      el.click();
      await delay(800);
      return true;
    }
  }
  
  // Try finding the floating action button
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) {
    const label = btn.getAttribute('aria-label')?.toLowerCase() || '';
    if (label.includes('new post') || label.includes('compose')) {
      btn.click();
      await delay(800);
      return true;
    }
  }
  
  return false;
}

/**
 * Create a new post (skeet)
 */
async function createPost(content) {
  try {
    // Check if composer is open
    let textArea = document.querySelector('[data-testid="composerTextInput"]') ||
                   document.querySelector('div[contenteditable="true"]');
    
    if (!textArea) {
      const opened = await openComposer();
      if (!opened) {
        return { success: false, error: 'Could not open composer. Make sure you are logged in.' };
      }
      await delay(500);
      
      textArea = document.querySelector('[data-testid="composerTextInput"]') ||
                 document.querySelector('div[contenteditable="true"]');
    }
    
    if (!textArea) {
      return { success: false, error: 'Could not find post input' };
    }
    
    // Focus and type
    textArea.focus();
    textArea.click();
    await delay(200);
    
    // Type content
    if (textArea.tagName === 'TEXTAREA' || textArea.tagName === 'INPUT') {
      textArea.value = content;
      textArea.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      // Contenteditable
      textArea.textContent = '';
      document.execCommand('insertText', false, content);
      textArea.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    await delay(500);
    
    // Find post button
    const postSelectors = [
      '[data-testid="composerPublishBtn"]',
      'button:has-text("Post")',
      'button[aria-label*="Publish"]'
    ];
    
    let postButton = null;
    
    // Find button by text
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const text = btn.textContent?.trim();
      if (text === 'Post' || text === 'Reply') {
        postButton = btn;
        break;
      }
    }
    
    // Try by data-testid
    if (!postButton) {
      postButton = document.querySelector('[data-testid="composerPublishBtn"]');
    }
    
    if (postButton && !postButton.disabled) {
      postButton.click();
      await delay(2000);
      return { success: true, message: 'Posted to Bluesky successfully' };
    } else {
      return { success: false, error: 'Could not find or click Post button' };
    }
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Reply to a post
 */
async function replyToPost(content) {
  try {
    // Find reply button and click it
    const replyBtns = document.querySelectorAll('[aria-label*="Reply"], [data-testid*="reply"]');
    if (replyBtns.length > 0) {
      replyBtns[0].click();
      await delay(800);
    }
    
    // Find reply input
    const textArea = document.querySelector('[data-testid="composerTextInput"]') ||
                     document.querySelector('div[contenteditable="true"]');
    
    if (!textArea) {
      return { success: false, error: 'Could not find reply input' };
    }
    
    // Type reply
    textArea.focus();
    textArea.click();
    await delay(100);
    
    if (textArea.tagName === 'TEXTAREA' || textArea.tagName === 'INPUT') {
      textArea.value = content;
    } else {
      document.execCommand('insertText', false, content);
    }
    textArea.dispatchEvent(new Event('input', { bubbles: true }));
    await delay(500);
    
    // Find and click reply/post button
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const text = btn.textContent?.trim();
      if ((text === 'Reply' || text === 'Post') && !btn.disabled) {
        btn.click();
        await delay(1500);
        return { success: true, message: 'Reply posted successfully' };
      }
    }
    
    return { success: false, error: 'Could not find Reply button' };
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Like a post
 */
async function likePost() {
  try {
    const likeBtns = document.querySelectorAll('[aria-label*="Like"], [data-testid*="like"]');
    
    for (const btn of likeBtns) {
      const label = btn.getAttribute('aria-label') || '';
      // Skip if already liked (usually says "Unlike")
      if (label.toLowerCase().includes('like') && !label.toLowerCase().includes('unlike')) {
        btn.click();
        await delay(500);
        return { success: true, message: 'Liked post successfully' };
      }
    }
    
    return { success: false, error: 'Could not find Like button' };
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Repost (retweet equivalent)
 */
async function repost() {
  try {
    const repostBtns = document.querySelectorAll('[aria-label*="Repost"], [data-testid*="repost"]');
    
    for (const btn of repostBtns) {
      btn.click();
      await delay(500);
      
      // Click "Repost" option in menu
      const menuItems = document.querySelectorAll('[role="menuitem"], button');
      for (const item of menuItems) {
        if (item.textContent?.trim() === 'Repost') {
          item.click();
          await delay(500);
          return { success: true, message: 'Reposted successfully' };
        }
      }
    }
    
    return { success: false, error: 'Could not find Repost button' };
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Main handler
 */
async function postToBluesky(content, options = {}) {
  const { action = 'post' } = options;
  
  switch (action) {
    case 'post':
      return await createPost(content);
    case 'reply':
    case 'comment':
      return await replyToPost(content);
    case 'like':
      return await likePost();
    case 'repost':
      return await repost();
    default:
      return { success: false, error: `Unknown action: ${action}` };
  }
}

/**
 * Listen for commands
 */
window.addEventListener('marketclaw:post', async (event) => {
  const { content, action } = event.detail;
  console.log('[MarketClaw] Bluesky action:', action);
  
  const result = await postToBluesky(content, { action });
  
  window.dispatchEvent(new CustomEvent('marketclaw:postResult', {
    detail: result
  }));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'post') {
    postToBluesky(message.content, message).then(sendResponse);
    return true;
  }
});
