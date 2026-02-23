/**
 * MarketClaw Browser Extension - Background Service Worker
 * 
 * Connects to MarketClaw via WebSocket and executes browser automation commands.
 */

const WS_URL = 'ws://localhost:7890';
const RECONNECT_INTERVAL = 5000;

let ws = null;
let isConnected = false;

// Platform configurations
const PLATFORMS = {
  twitter: {
    patterns: ['twitter.com', 'x.com'],
    contentScript: 'content-scripts/twitter.js'
  },
  linkedin: {
    patterns: ['linkedin.com'],
    contentScript: 'content-scripts/linkedin.js'
  },
  instagram: {
    patterns: ['instagram.com'],
    contentScript: 'content-scripts/instagram.js'
  }
};

/**
 * Connect to MarketClaw WebSocket server
 */
function connect() {
  try {
    ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
      console.log('[MarketClaw] Connected to server');
      isConnected = true;
      updateBadge('ON', '#22c55e');
      
      // Send handshake
      ws.send(JSON.stringify({
        type: 'handshake',
        client: 'marketclaw-extension',
        version: '0.1.0',
        capabilities: ['twitter', 'linkedin', 'instagram']
      }));
    };
    
    ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('[MarketClaw] Received:', message);
        
        const result = await handleCommand(message);
        
        if (message.id) {
          ws.send(JSON.stringify({
            type: 'response',
            id: message.id,
            ...result
          }));
        }
      } catch (err) {
        console.error('[MarketClaw] Error handling message:', err);
      }
    };
    
    ws.onclose = () => {
      console.log('[MarketClaw] Disconnected');
      isConnected = false;
      updateBadge('OFF', '#ef4444');
      
      // Reconnect after delay
      setTimeout(connect, RECONNECT_INTERVAL);
    };
    
    ws.onerror = (err) => {
      console.error('[MarketClaw] WebSocket error:', err);
    };
    
  } catch (err) {
    console.error('[MarketClaw] Connection error:', err);
    setTimeout(connect, RECONNECT_INTERVAL);
  }
}

/**
 * Update extension badge
 */
function updateBadge(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

/**
 * Handle incoming commands
 */
async function handleCommand(message) {
  const { action, platform, ...params } = message;
  
  switch (action) {
    case 'ping':
      return { success: true, pong: true };
      
    case 'status':
      return { success: true, connected: isConnected, platforms: Object.keys(PLATFORMS) };
      
    case 'post':
      return await handlePost(platform, params);
      
    case 'navigate':
      return await handleNavigate(params.url);
      
    case 'getTabs':
      return await handleGetTabs(platform);
      
    case 'execute':
      return await handleExecute(params.tabId, params.script);
      
    default:
      return { success: false, error: `Unknown action: ${action}` };
  }
}

/**
 * Handle post command
 */
async function handlePost(platform, params) {
  const { content, mediaUrls } = params;
  
  if (!PLATFORMS[platform]) {
    return { success: false, error: `Unknown platform: ${platform}` };
  }
  
  // Find or create tab for platform
  const tab = await findOrCreateTab(platform);
  if (!tab) {
    return { success: false, error: `Could not open ${platform}` };
  }
  
  // Wait for page to be ready
  await waitForTab(tab.id);
  
  // Execute posting script
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: postContent,
      args: [platform, content, mediaUrls || []]
    });
    
    return results[0]?.result || { success: false, error: 'No result from content script' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Find existing tab or create new one for platform
 */
async function findOrCreateTab(platform) {
  const config = PLATFORMS[platform];
  const tabs = await chrome.tabs.query({});
  
  // Find existing tab
  for (const tab of tabs) {
    if (config.patterns.some(p => tab.url?.includes(p))) {
      await chrome.tabs.update(tab.id, { active: true });
      return tab;
    }
  }
  
  // Create new tab
  const urls = {
    twitter: 'https://twitter.com/compose/tweet',
    linkedin: 'https://www.linkedin.com/feed/',
    instagram: 'https://www.instagram.com/'
  };
  
  return await chrome.tabs.create({ url: urls[platform] || `https://${config.patterns[0]}` });
}

/**
 * Wait for tab to finish loading
 */
function waitForTab(tabId, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkTab = async () => {
      const tab = await chrome.tabs.get(tabId);
      
      if (tab.status === 'complete') {
        resolve(tab);
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('Tab load timeout'));
      } else {
        setTimeout(checkTab, 200);
      }
    };
    
    checkTab();
  });
}

/**
 * Handle navigate command
 */
async function handleNavigate(url) {
  try {
    const tab = await chrome.tabs.create({ url, active: true });
    await waitForTab(tab.id);
    return { success: true, tabId: tab.id };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Get tabs for a platform
 */
async function handleGetTabs(platform) {
  const tabs = await chrome.tabs.query({});
  
  if (platform && PLATFORMS[platform]) {
    const config = PLATFORMS[platform];
    const filtered = tabs.filter(t => config.patterns.some(p => t.url?.includes(p)));
    return { success: true, tabs: filtered.map(t => ({ id: t.id, url: t.url, title: t.title })) };
  }
  
  return { success: true, tabs: tabs.map(t => ({ id: t.id, url: t.url, title: t.title })) };
}

/**
 * Execute arbitrary script in tab
 */
async function handleExecute(tabId, script) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: new Function(script)
    });
    return { success: true, result: results[0]?.result };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Content posting function (injected into page)
 */
function postContent(platform, content, mediaUrls) {
  return new Promise((resolve) => {
    // This will be overridden by platform-specific content scripts
    // For now, dispatch a custom event that content scripts listen to
    const event = new CustomEvent('marketclaw:post', {
      detail: { platform, content, mediaUrls }
    });
    
    window.dispatchEvent(event);
    
    // Listen for response
    const handler = (e) => {
      window.removeEventListener('marketclaw:postResult', handler);
      resolve(e.detail);
    };
    window.addEventListener('marketclaw:postResult', handler);
    
    // Timeout after 30 seconds
    setTimeout(() => {
      window.removeEventListener('marketclaw:postResult', handler);
      resolve({ success: false, error: 'Post timeout' });
    }, 30000);
  });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'getStatus') {
    sendResponse({ connected: isConnected });
  }
  return true;
});

// Start connection
connect();

console.log('[MarketClaw] Extension loaded');
