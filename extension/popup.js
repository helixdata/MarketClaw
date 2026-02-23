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
    
    // Send message to content script
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'post',
      content,
      platform
    }, (response) => {
      if (response?.success) {
        postContent.value = '';
        postButton.textContent = 'Posted! ✓';
        setTimeout(() => {
          postButton.textContent = 'Post';
          postButton.disabled = false;
        }, 2000);
      } else {
        postButton.textContent = 'Failed: ' + (response?.error || 'Unknown error');
        setTimeout(() => {
          postButton.textContent = 'Post';
          postButton.disabled = false;
        }, 3000);
      }
    });
  } catch (err) {
    postButton.textContent = 'Error: ' + err.message;
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
