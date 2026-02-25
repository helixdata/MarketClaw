/**
 * MarketClaw Extension Popup
 */

const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const postButton = document.getElementById('postButton');
const postContent = document.getElementById('postContent');
const platformSelect = document.getElementById('platformSelect');
const profileName = document.getElementById('profileName');
const profileBadge = document.getElementById('profileBadge');
const saveProfileBtn = document.getElementById('saveProfile');

// Load saved profile name
chrome.storage.local.get(['profileName'], (result) => {
  const name = result.profileName || 'Default';
  profileName.value = name;
  profileBadge.textContent = name;
});

// Save profile name
saveProfileBtn.addEventListener('click', () => {
  const name = profileName.value.trim() || 'Default';
  chrome.storage.local.set({ profileName: name }, () => {
    profileBadge.textContent = name;
    saveProfileBtn.textContent = 'Saved!';
    
    // Notify background script to update handshake
    chrome.runtime.sendMessage({ type: 'updateProfile', profile: name });
    
    setTimeout(() => {
      saveProfileBtn.textContent = 'Save';
    }, 1500);
  });
});

// Check connection status
chrome.runtime.sendMessage({ type: 'getStatus' }, (response) => {
  if (response?.connected) {
    statusDot.classList.add('connected');
    statusText.textContent = 'Connected to MarketClaw';
    postButton.disabled = false;
  } else {
    statusText.textContent = 'Disconnected - Start MarketClaw server';
  }
});

// Platform URL patterns for validation
const PLATFORM_PATTERNS = {
  twitter: ['twitter.com', 'x.com'],
  linkedin: ['linkedin.com'],
  instagram: ['instagram.com'],
  reddit: ['reddit.com'],
  hackernews: ['news.ycombinator.com'],
  producthunt: ['producthunt.com'],
  facebook: ['facebook.com', 'web.facebook.com'],
  threads: ['threads.net'],
  bluesky: ['bsky.app'],
  youtube: ['youtube.com']
};

// Handle post button
postButton.addEventListener('click', async () => {
  const content = postContent.value.trim();
  const platform = platformSelect.value;
  
  if (!content) return;
  
  postButton.disabled = true;
  postButton.textContent = 'Posting...';
  
  try {
    // Find the right tab and post
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    
    if (!tab?.url) {
      throw new Error('No active tab found');
    }
    
    // Check if current tab matches the selected platform
    const patterns = PLATFORM_PATTERNS[platform];
    const isCorrectPlatform = patterns?.some(p => tab.url.includes(p));
    
    if (!isCorrectPlatform) {
      const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
      throw new Error(`Navigate to ${platformName} first`);
    }
    
    // Send message to content script
    chrome.tabs.sendMessage(tab.id, {
      action: 'post',
      content,
      platform
    }, (response) => {
      // Check for Chrome runtime error (no content script listening)
      if (chrome.runtime.lastError) {
        console.error('[MarketClaw] sendMessage error:', chrome.runtime.lastError);
        postButton.textContent = 'Failed: Reload the page';
        setTimeout(() => {
          postButton.textContent = 'Post';
          postButton.disabled = false;
        }, 3000);
        return;
      }
      
      if (response?.success) {
        postContent.value = '';
        postButton.textContent = 'Posted! ✓';
        setTimeout(() => {
          postButton.textContent = 'Post';
          postButton.disabled = false;
        }, 2000);
      } else {
        postButton.textContent = 'Failed: ' + (response?.error || 'No response from page');
        setTimeout(() => {
          postButton.textContent = 'Post';
          postButton.disabled = false;
        }, 3000);
      }
    });
  } catch (err) {
    postButton.textContent = 'Failed: ' + err.message;
    setTimeout(() => {
      postButton.textContent = 'Post';
      postButton.disabled = false;
    }, 3000);
  }
});

// Enable post button when content is entered
postContent.addEventListener('input', () => {
  postButton.disabled = !postContent.value.trim();
});

// Handle Enter key in profile input
profileName.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    saveProfileBtn.click();
  }
});
