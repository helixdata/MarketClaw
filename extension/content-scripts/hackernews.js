/**
 * MarketClaw - Hacker News Content Script
 * 
 * Handles posting and commenting on Hacker News via browser automation.
 * Supports: submitting links, submitting text posts, commenting on posts.
 */

console.log('[MarketClaw] Hacker News content script loaded');

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
  // HN shows "login" link if not logged in
  const loginLink = document.querySelector('a[href="login?goto=news"]');
  return !loginLink;
}

/**
 * Submit a new story (link or text)
 */
async function submitStory(content, options = {}) {
  const { title, url } = options;
  
  try {
    // Check if we're on submit page
    if (!window.location.pathname.includes('/submit')) {
      window.location.href = 'https://news.ycombinator.com/submit';
      await delay(1500);
    }
    
    // Check login status
    if (!isLoggedIn()) {
      return { success: false, error: 'Not logged in to Hacker News' };
    }
    
    // Find title input
    const titleInput = document.querySelector('input[name="title"]');
    if (titleInput && title) {
      titleInput.value = title;
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      await delay(200);
    } else if (!title) {
      return { success: false, error: 'Title is required for HN submissions' };
    }
    
    // Find URL input (for link posts)
    const urlInput = document.querySelector('input[name="url"]');
    if (urlInput && url) {
      urlInput.value = url;
      urlInput.dispatchEvent(new Event('input', { bubbles: true }));
      await delay(200);
    }
    
    // Find text input (for text posts / Ask HN / Show HN)
    const textInput = document.querySelector('textarea[name="text"]');
    if (textInput && content && !url) {
      // Text posts (Ask HN, Show HN, etc.)
      textInput.value = content;
      textInput.dispatchEvent(new Event('input', { bubbles: true }));
      await delay(200);
    }
    
    // Find submit button
    const submitButton = document.querySelector('input[type="submit"][value="submit"]');
    if (submitButton) {
      submitButton.click();
      await delay(2000);
      
      // Check for errors
      const errorText = document.body.innerText;
      if (errorText.includes('Unknown or expired link') || errorText.includes('rate limit')) {
        return { success: false, error: 'Submission failed - possible rate limit or duplicate' };
      }
      
      return { success: true, message: 'Story submitted to Hacker News' };
    } else {
      return { success: false, error: 'Could not find submit button' };
    }
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Comment on a post or reply to a comment
 */
async function postComment(content) {
  try {
    // Check login status
    if (!isLoggedIn()) {
      return { success: false, error: 'Not logged in to Hacker News' };
    }
    
    // Find comment textarea
    const commentBox = document.querySelector('textarea[name="text"]');
    if (!commentBox) {
      return { success: false, error: 'Could not find comment box. Make sure you are on a post page.' };
    }
    
    // Type comment
    commentBox.value = content;
    commentBox.dispatchEvent(new Event('input', { bubbles: true }));
    await delay(300);
    
    // Find submit button (could be "add comment" or "reply")
    const submitButton = document.querySelector('input[type="submit"][value="add comment"]') ||
                         document.querySelector('input[type="submit"][value="reply"]') ||
                         document.querySelector('input[type="submit"]');
    
    if (submitButton) {
      submitButton.click();
      await delay(2000);
      
      // Check for rate limit
      const errorText = document.body.innerText;
      if (errorText.includes('rate limit') || errorText.includes('slow down')) {
        return { success: false, error: 'Rate limited - please wait before commenting again' };
      }
      
      return { success: true, message: 'Comment posted to Hacker News' };
    } else {
      return { success: false, error: 'Could not find submit button' };
    }
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Upvote a post or comment
 */
async function upvote() {
  try {
    // Check login status
    if (!isLoggedIn()) {
      return { success: false, error: 'Not logged in to Hacker News' };
    }
    
    // Find upvote link/button
    const upvoteLink = document.querySelector('a[id^="up_"]') ||
                       document.querySelector('.votearrow');
    
    if (upvoteLink) {
      upvoteLink.click();
      await delay(500);
      return { success: true, message: 'Upvoted successfully' };
    } else {
      return { success: false, error: 'Could not find upvote button' };
    }
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Get post info from current page
 */
function getPostInfo() {
  const titleEl = document.querySelector('.titleline a');
  const scoreEl = document.querySelector('.score');
  const authorEl = document.querySelector('.hnuser');
  const commentsEl = document.querySelector('a[href*="item?id="]:last-of-type');
  
  return {
    title: titleEl?.textContent,
    url: titleEl?.href,
    score: scoreEl?.textContent,
    author: authorEl?.textContent,
    comments: commentsEl?.textContent
  };
}

/**
 * Main post handler
 */
async function postToHN(content, options = {}) {
  const { action = 'comment', title, url } = options;
  
  switch (action) {
    case 'submit':
    case 'post':
      return await submitStory(content, { title, url });
    case 'comment':
    case 'reply':
      return await postComment(content);
    case 'upvote':
      return await upvote();
    case 'info':
      return { success: true, result: getPostInfo() };
    default:
      return { success: false, error: `Unknown action: ${action}` };
  }
}

/**
 * Listen for post commands from background script
 */
window.addEventListener('marketclaw:post', async (event) => {
  const { content, action, title, url } = event.detail;
  
  console.log('[MarketClaw] HN action:', action);
  
  const result = await postToHN(content, { action, title, url });
  
  window.dispatchEvent(new CustomEvent('marketclaw:postResult', {
    detail: result
  }));
});

// Also listen for direct messages from extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'post') {
    postToHN(message.content, message).then(sendResponse);
    return true;
  }
});
