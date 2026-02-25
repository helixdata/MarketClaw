/**
 * MarketClaw - Instagram Content Script
 * 
 * Handles posting to Instagram via browser automation.
 * Note: Instagram web has limited posting capabilities (no image upload via web automation).
 * Best for: comments, DMs, stories (with limitations).
 */

console.log('[MarketClaw] Instagram content script loaded');

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
 * Click the create post button to open composer
 */
async function openCreateModal() {
  // Find the create/new post button
  const createSelectors = [
    'svg[aria-label="New post"]',
    'a[href="/create/select/"]',
    '[aria-label="New post"]',
    'svg[aria-label="New Post"]'
  ];
  
  for (const selector of createSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      // Click the parent if it's an SVG
      const clickTarget = el.closest('a') || el.closest('button') || el.parentElement || el;
      clickTarget.click();
      await delay(1000);
      return true;
    }
  }
  
  return false;
}

/**
 * Post a comment on the current post
 */
async function postComment(content) {
  try {
    // Find comment textarea
    const commentSelectors = [
      'textarea[placeholder*="Add a comment"]',
      'textarea[aria-label*="Add a comment"]',
      'form textarea',
      '[contenteditable="true"]'
    ];
    
    let commentBox = null;
    for (const selector of commentSelectors) {
      commentBox = document.querySelector(selector);
      if (commentBox) break;
    }
    
    if (!commentBox) {
      // Try clicking the comment icon first
      const commentIcon = document.querySelector('svg[aria-label*="Comment"]');
      if (commentIcon) {
        const clickTarget = commentIcon.closest('button') || commentIcon.parentElement;
        clickTarget?.click();
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
    
    // Focus and type
    commentBox.focus();
    commentBox.click();
    await delay(100);
    
    // Clear and type content
    commentBox.value = '';
    
    // Instagram uses contenteditable, need to trigger properly
    for (const char of content) {
      commentBox.value += char;
      commentBox.dispatchEvent(new Event('input', { bubbles: true }));
      await delay(20); // Type slowly to avoid detection
    }
    
    await delay(500);
    
    // Find post button
    const postButtonSelectors = [
      'button[type="submit"]',
      
      'button:contains("Post")'
    ];
    
    let postButton = null;
    
    // Find button with "Post" text
    const buttons = document.querySelectorAll('button, div[role="button"]');
    for (const btn of buttons) {
      if (btn.textContent?.trim().toLowerCase() === 'post' && !btn.disabled) {
        postButton = btn;
        break;
      }
    }
    
    // Also check for submit button in form
    if (!postButton) {
      const form = commentBox.closest('form');
      if (form) {
        postButton = form.querySelector('button[type="submit"]');
      }
    }
    
    if (postButton) {
      postButton.click();
      await delay(1500);
      return { success: true, message: 'Comment posted successfully' };
    } else {
      return { success: false, error: 'Could not find post button' };
    }
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Send a DM
 */
async function sendDM(content, username) {
  try {
    // Navigate to DMs if not already there
    if (!window.location.pathname.includes('/direct/')) {
      window.location.href = 'https://www.instagram.com/direct/inbox/';
      await delay(2000);
    }
    
    // If username provided, try to find/open that conversation
    if (username) {
      // Look for new message button
      const newMsgBtn = document.querySelector('svg[aria-label="New message"]');
      if (newMsgBtn) {
        const clickTarget = newMsgBtn.closest('button') || newMsgBtn.parentElement;
        clickTarget?.click();
        await delay(1000);
        
        // Find user search input
        const searchInput = document.querySelector('input[placeholder*="Search"]');
        if (searchInput) {
          searchInput.focus();
          searchInput.value = username;
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          await delay(1500);
          
          // Click first result
          const result = document.querySelector('div[role="dialog"] button');
          if (result) {
            result.click();
            await delay(500);
          }
        }
      }
    }
    
    // Find message input
    const msgInputSelectors = [
      'textarea[placeholder*="Message"]',
      'div[role="textbox"]',
      '[contenteditable="true"]'
    ];
    
    let msgInput = null;
    for (const selector of msgInputSelectors) {
      msgInput = document.querySelector(selector);
      if (msgInput) break;
    }
    
    if (!msgInput) {
      return { success: false, error: 'Could not find message input' };
    }
    
    msgInput.focus();
    msgInput.click();
    await delay(100);
    
    // Type message
    if (msgInput.tagName === 'TEXTAREA') {
      msgInput.value = content;
    } else {
      document.execCommand('insertText', false, content);
    }
    msgInput.dispatchEvent(new Event('input', { bubbles: true }));
    await delay(500);
    
    // Find send button
    const sendBtn = document.querySelector('button:contains("Send"), div[role="button"]:contains("Send")');
    const buttons = document.querySelectorAll('button, div[role="button"]');
    let actualSendBtn = null;
    for (const btn of buttons) {
      if (btn.textContent?.trim().toLowerCase() === 'send') {
        actualSendBtn = btn;
        break;
      }
    }
    
    if (actualSendBtn) {
      actualSendBtn.click();
      await delay(1000);
      return { success: true, message: 'DM sent successfully' };
    } else {
      return { success: false, error: 'Could not find send button' };
    }
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Create a new post (limited - Instagram web requires mobile-like experience)
 * Note: This opens the create flow, but image upload is tricky via automation
 */
async function createPost(content, options = {}) {
  try {
    // Instagram web posting is limited
    // We can try to open the create modal
    const opened = await openCreateModal();
    
    if (!opened) {
      return { 
        success: false, 
        error: 'Instagram web posting requires the mobile web experience or app. Use browser_navigate to go to a post and use "comment" action instead.' 
      };
    }
    
    // If modal opened, we'd need to handle image selection
    // This is complex as it requires file input interaction
    return { 
      success: false, 
      error: 'Instagram web image posting requires file upload. Use mobile API or comment on existing posts.' 
    };
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Main post handler
 */
async function postToInstagram(content, options = {}) {
  const { action = 'comment', username } = options;
  
  switch (action) {
    case 'comment':
      return await postComment(content);
    case 'dm':
      return await sendDM(content, username);
    case 'post':
      return await createPost(content, options);
    default:
      return { success: false, error: `Unknown action: ${action}` };
  }
}

/**
 * Listen for post commands from background script
 */
window.addEventListener('marketclaw:post', async (event) => {
  const { content, action, username } = event.detail;
  
  console.log('[MarketClaw] Instagram action:', action);
  
  const result = await postToInstagram(content, { action, username });
  
  window.dispatchEvent(new CustomEvent('marketclaw:postResult', {
    detail: result
  }));
});

// Also listen for direct messages from extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'post') {
    postToInstagram(message.content, message).then(sendResponse);
    return true;
  }
});
