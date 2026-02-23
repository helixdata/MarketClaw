/**
 * MarketClaw - YouTube Content Script
 * 
 * Handles commenting on YouTube via browser automation.
 * Supports: comments, replies, likes.
 * Note: Video uploading requires YouTube Studio and is not supported here.
 */

console.log('[MarketClaw] YouTube content script loaded');

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
 * Scroll to comments section
 */
async function scrollToComments() {
  // YouTube lazy-loads comments, need to scroll down
  const commentsSection = document.querySelector('#comments');
  if (commentsSection) {
    commentsSection.scrollIntoView({ behavior: 'smooth' });
    await delay(1500); // Wait for comments to load
    return true;
  }
  
  // Try scrolling down to trigger load
  window.scrollBy(0, 500);
  await delay(1500);
  return !!document.querySelector('#comments');
}

/**
 * Post a comment on a video
 */
async function postComment(content) {
  try {
    // Make sure we're on a video page
    if (!window.location.pathname.includes('/watch')) {
      return { success: false, error: 'Must be on a video page to comment' };
    }
    
    // Scroll to comments if needed
    await scrollToComments();
    
    // Find comment input placeholder
    const placeholderSelectors = [
      '#placeholder-area',
      '#simplebox-placeholder',
      'yt-formatted-string#placeholder-area',
      '#contenteditable-root'
    ];
    
    let placeholder = null;
    for (const selector of placeholderSelectors) {
      placeholder = document.querySelector(selector);
      if (placeholder) break;
    }
    
    if (placeholder) {
      placeholder.click();
      await delay(500);
    }
    
    // Find the actual input
    const inputSelectors = [
      '#contenteditable-root',
      'div[contenteditable="true"]#contenteditable-root',
      '#contenteditable-textarea'
    ];
    
    let commentBox = null;
    for (const selector of inputSelectors) {
      commentBox = document.querySelector(selector);
      if (commentBox) break;
    }
    
    if (!commentBox) {
      return { success: false, error: 'Could not find comment box. Make sure you are logged in.' };
    }
    
    // Focus and type
    commentBox.focus();
    commentBox.click();
    await delay(200);
    
    // Clear and type
    commentBox.textContent = '';
    document.execCommand('insertText', false, content);
    commentBox.dispatchEvent(new Event('input', { bubbles: true }));
    await delay(500);
    
    // Find submit button
    const submitSelectors = [
      '#submit-button',
      'ytd-button-renderer#submit-button',
      'button[aria-label="Comment"]',
      '#submit-button button'
    ];
    
    let submitBtn = null;
    for (const selector of submitSelectors) {
      submitBtn = document.querySelector(selector);
      if (submitBtn) break;
    }
    
    // Try finding by button inside submit-button
    if (!submitBtn) {
      const submitContainer = document.querySelector('#submit-button');
      if (submitContainer) {
        submitBtn = submitContainer.querySelector('button') || submitContainer;
      }
    }
    
    if (submitBtn) {
      submitBtn.click();
      await delay(2000);
      return { success: true, message: 'Comment posted successfully' };
    } else {
      return { success: false, error: 'Could not find Comment button' };
    }
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Reply to a comment
 */
async function replyToComment(content) {
  try {
    // Find reply button for the first/focused comment
    const replyBtns = document.querySelectorAll('#reply-button-end button, button[aria-label*="Reply"]');
    
    if (replyBtns.length > 0) {
      replyBtns[0].click();
      await delay(500);
    }
    
    // Find reply input
    const replyBox = document.querySelector('#contenteditable-root');
    
    if (!replyBox) {
      return { success: false, error: 'Could not find reply input. Click on a comment first.' };
    }
    
    // Type reply
    replyBox.focus();
    replyBox.click();
    await delay(100);
    
    replyBox.textContent = '';
    document.execCommand('insertText', false, content);
    replyBox.dispatchEvent(new Event('input', { bubbles: true }));
    await delay(500);
    
    // Find and click reply submit button
    const submitContainer = document.querySelector('#submit-button');
    const submitBtn = submitContainer?.querySelector('button') || submitContainer;
    
    if (submitBtn) {
      submitBtn.click();
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
 * Like a video
 */
async function likeVideo() {
  try {
    // Find like button
    const likeSelectors = [
      'button[aria-label*="like this video"]',
      '#top-level-buttons-computed button:first-child',
      'ytd-toggle-button-renderer#button:first-child button',
      'like-button-view-model button'
    ];
    
    let likeBtn = null;
    
    // Find by aria-label
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const label = btn.getAttribute('aria-label')?.toLowerCase() || '';
      if (label.includes('like') && !label.includes('dislike') && !label.includes('unlike')) {
        likeBtn = btn;
        break;
      }
    }
    
    if (!likeBtn) {
      for (const selector of likeSelectors) {
        likeBtn = document.querySelector(selector);
        if (likeBtn) break;
      }
    }
    
    if (likeBtn) {
      likeBtn.click();
      await delay(500);
      return { success: true, message: 'Liked video successfully' };
    } else {
      return { success: false, error: 'Could not find Like button' };
    }
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Subscribe to channel
 */
async function subscribe() {
  try {
    const subscribeBtns = document.querySelectorAll('#subscribe-button button, button[aria-label*="Subscribe"]');
    
    for (const btn of subscribeBtns) {
      const label = btn.getAttribute('aria-label')?.toLowerCase() || '';
      const text = btn.textContent?.toLowerCase() || '';
      if (label.includes('subscribe') || text.includes('subscribe')) {
        // Make sure it's not already subscribed
        if (!label.includes('unsubscribe') && !text.includes('subscribed')) {
          btn.click();
          await delay(500);
          return { success: true, message: 'Subscribed successfully' };
        } else {
          return { success: false, error: 'Already subscribed' };
        }
      }
    }
    
    return { success: false, error: 'Could not find Subscribe button' };
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Get video info
 */
function getVideoInfo() {
  const title = document.querySelector('h1.ytd-video-primary-info-renderer, h1.ytd-watch-metadata')?.textContent?.trim();
  const channel = document.querySelector('#channel-name a, #owner-name a')?.textContent?.trim();
  const views = document.querySelector('.view-count')?.textContent?.trim();
  const likes = document.querySelector('#top-level-buttons-computed button:first-child')?.getAttribute('aria-label');
  
  return {
    title,
    channel,
    views,
    likes,
    url: window.location.href
  };
}

/**
 * Main handler
 */
async function postToYouTube(content, options = {}) {
  const { action = 'comment' } = options;
  
  switch (action) {
    case 'comment':
      return await postComment(content);
    case 'reply':
      return await replyToComment(content);
    case 'like':
      return await likeVideo();
    case 'subscribe':
      return await subscribe();
    case 'info':
      return { success: true, result: getVideoInfo() };
    default:
      return { success: false, error: `Unknown action: ${action}` };
  }
}

/**
 * Listen for commands
 */
window.addEventListener('marketclaw:post', async (event) => {
  const { content, action } = event.detail;
  console.log('[MarketClaw] YouTube action:', action);
  
  const result = await postToYouTube(content, { action });
  
  window.dispatchEvent(new CustomEvent('marketclaw:postResult', {
    detail: result
  }));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'post') {
    postToYouTube(message.content, message).then(sendResponse);
    return true;
  }
});
