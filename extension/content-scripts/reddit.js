/**
 * MarketClaw - Reddit Content Script
 * 
 * Handles posting to Reddit via browser automation.
 * Supports both new Reddit and old Reddit.
 */

console.log('[MarketClaw] Reddit content script loaded');

// Prevent duplicate execution
let isPosting = false;

/**
 * Generate a UUID v4
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Convert plain text to Reddit's Lexical richText format
 */
function textToRichText(text) {
  if (!text) {
    return JSON.stringify({ document: [{ e: 'par', c: [{ e: 'text', t: '' }] }] });
  }
  
  // Split by newlines and create paragraphs
  const paragraphs = text.split('\n').map(line => ({
    e: 'par',
    c: [{ e: 'text', t: line }]
  }));
  
  return JSON.stringify({ document: paragraphs });
}

/**
 * Get reCAPTCHA token from Reddit's page
 */
async function getRecaptchaToken() {
  const REDDIT_RECAPTCHA_KEY = '6LfirrMoAAAAAHZOipvza4kpp_VtTwLNuXVwURNQ';
  
  try {
    // Try to use Reddit's grecaptcha instance if available
    if (typeof grecaptcha !== 'undefined' && grecaptcha.enterprise) {
      return await grecaptcha.enterprise.execute(REDDIT_RECAPTCHA_KEY, { action: 'submit' });
    }
    if (window.grecaptcha?.enterprise) {
      return await window.grecaptcha.enterprise.execute(REDDIT_RECAPTCHA_KEY, { action: 'submit' });
    }
    // Not required for logged-in users, so empty string is fine
    return '';
  } catch (err) {
    return '';
  }
}

/**
 * Post via Reddit's GraphQL API directly (bypasses UI)
 */
async function postViaAPI(title, body, subreddit) {
  try {
    // Get CSRF token from cookies
    const csrfToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrf_token='))
      ?.split('=')[1];
    
    if (!csrfToken) {
      return { success: false, error: 'No CSRF token found' };
    }
    
    // Get subreddit from URL if not provided
    let sr = subreddit;
    if (!sr) {
      const urlMatch = window.location.pathname.match(/\/r\/([^\/]+)/);
      sr = urlMatch ? urlMatch[1] : null;
    }
    
    if (!sr) {
      return { success: false, error: 'No subreddit specified' };
    }
    
    // Try to get a reCAPTCHA token (not required for logged-in users)
    const recaptchaToken = await getRecaptchaToken();
    
    // Build the GraphQL request
    const requestBody = {
      operation: 'CreatePost',
      variables: {
        input: {
          isNsfw: false,
          isSpoiler: false,
          content: { richText: textToRichText(body) },
          title: title,
          isCommercialCommunication: false,
          targetLanguage: '',
          recaptchaToken: recaptchaToken,
          subredditName: sr,
          correlationId: generateUUID()
        }
      },
      csrf_token: csrfToken
    };
    
    const response = await fetch('https://www.reddit.com/svc/shreddit/graphql', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'text/vnd.reddit.partial+html, application/json',
        'Content-Type': 'application/json',
        'Origin': 'https://www.reddit.com',
        'Referer': `https://www.reddit.com/r/${sr}/submit/`,
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }
    
    const responseText = await response.text();
    
    // Try to parse as JSON
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      return response.ok 
        ? { success: true, message: 'Post submitted' }
        : { success: false, error: 'Invalid response' };
    }
    
    // Check for errors
    if (result.errors?.length > 0) {
      return { success: false, error: result.errors.map(e => e.message || JSON.stringify(e)).join(', ') };
    }
    
    // Check for successful post
    const postData = result.data?.createSubredditPost || result.data?.createPost;
    if (postData?.ok || postData?.post?.id) {
      const permalink = postData?.post?.permalink;
      const url = permalink ? `https://www.reddit.com${permalink}` : null;
      return { success: true, message: 'Posted to Reddit!', url };
    }
    
    return { success: false, error: 'Unknown response format' };
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

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
  if (isPosting) {
    return { success: false, error: 'Already posting' };
  }
  isPosting = true;
  
  const { subreddit, title } = options;
  
  // Title is required for Reddit posts
  if (!title) {
    isPosting = false;
    return { success: false, error: 'Title is required for Reddit posts' };
  }
  
  // Use GraphQL API (UI automation doesn't work for Lexical editor)
  const apiResult = await postViaAPI(title, content, subreddit);
  isPosting = false;
  return apiResult;
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
if (!window._marketClawRedditListenerRegistered) {
  window._marketClawRedditListenerRegistered = true;
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[MarketClaw] Reddit received message:', message);
    if (message.action === 'post') {
      postToReddit(message.content, message).then(sendResponse);
      return true;
    }
  });
}
