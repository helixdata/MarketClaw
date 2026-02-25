/**
 * MarketClaw Browser Extension - Background Service Worker
 * 
 * Connects to MarketClaw via WebSocket and executes browser automation commands.
 */

const WS_URL = 'ws://localhost:7890';
const RECONNECT_INTERVAL = 5000;

let ws = null;
let isConnected = false;
let currentProfile = 'Default';

// Available primitive actions
const PRIMITIVES = [
  'click',      // Click an element
  'type',       // Type text into an element
  'find',       // Find elements matching selector
  'getText',    // Get text content of element
  'getAttribute', // Get attribute value
  'setAttribute', // Set attribute value
  'scroll',     // Scroll page or element
  'hover',      // Hover over element
  'focus',      // Focus an element
  'select',     // Select option in dropdown
  'setChecked', // Check/uncheck checkbox
  'wait',       // Wait for element to appear
  'waitGone',   // Wait for element to disappear
  'delay',      // Wait for specified time
  'pageInfo',   // Get page info (url, title, dimensions)
  'evaluate'    // Execute arbitrary JavaScript
];

// Platform configurations
const PLATFORMS = {
  twitter: {
    patterns: ['twitter.com', 'x.com'],
    contentScript: 'content-scripts/twitter.js',
    postUrl: 'https://twitter.com/compose/tweet'
  },
  linkedin: {
    patterns: ['linkedin.com'],
    contentScript: 'content-scripts/linkedin.js',
    postUrl: 'https://www.linkedin.com/feed/'
  },
  instagram: {
    patterns: ['instagram.com'],
    contentScript: 'content-scripts/instagram.js',
    postUrl: 'https://www.instagram.com/'
  },
  reddit: {
    patterns: ['reddit.com', 'old.reddit.com'],
    contentScript: 'content-scripts/reddit.js',
    postUrl: 'https://www.reddit.com/submit'
  },
  hackernews: {
    patterns: ['news.ycombinator.com'],
    contentScript: 'content-scripts/hackernews.js',
    postUrl: 'https://news.ycombinator.com/submit'
  },
  producthunt: {
    patterns: ['producthunt.com'],
    contentScript: 'content-scripts/producthunt.js',
    postUrl: 'https://www.producthunt.com/posts/new'
  },
  facebook: {
    patterns: ['facebook.com'],
    contentScript: 'content-scripts/facebook.js',
    postUrl: 'https://www.facebook.com/'
  },
  threads: {
    patterns: ['threads.net'],
    contentScript: 'content-scripts/threads.js',
    postUrl: 'https://www.threads.net/'
  },
  bluesky: {
    patterns: ['bsky.app'],
    contentScript: 'content-scripts/bluesky.js',
    postUrl: 'https://bsky.app/'
  },
  youtube: {
    patterns: ['youtube.com'],
    contentScript: 'content-scripts/youtube.js',
    postUrl: 'https://www.youtube.com/'
  }
};

/**
 * Load profile name from storage
 */
async function loadProfile() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['profileName'], (result) => {
      currentProfile = result.profileName || 'Default';
      resolve(currentProfile);
    });
  });
}

/**
 * Send handshake with current profile
 */
function sendHandshake() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'handshake',
      client: 'marketclaw-extension',
      version: '0.4.2',
      profile: currentProfile,
      capabilities: {
        platforms: Object.keys(PLATFORMS),
        primitives: PRIMITIVES
      }
    }));
  }
}

/**
 * Connect to MarketClaw WebSocket server
 */
async function connect() {
  // Load profile before connecting
  await loadProfile();
  
  try {
    ws = new WebSocket(WS_URL);
    updateBadge('...', '#f59e0b'); // Yellow while connecting
    
    ws.onopen = () => {
      console.log('[MarketClaw] Connected to server');
      isConnected = true;
      updateBadge('✓', '#22c55e'); // Green checkmark when connected
      
      // Send handshake with profile
      sendHandshake();
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
      updateBadge('✗', '#ef4444'); // Red X when disconnected
      
      // Reconnect after delay
      setTimeout(connect, RECONNECT_INTERVAL);
    };
    
    ws.onerror = (err) => {
      console.error('[MarketClaw] WebSocket error:', err);
      isConnected = false;
      updateBadge('!', '#ef4444'); // Red exclamation on error
    };
    
  } catch (err) {
    console.error('[MarketClaw] Connection error:', err);
    isConnected = false;
    updateBadge('✗', '#ef4444'); // Red X on connection failure
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
      return { 
        success: true, 
        connected: isConnected, 
        platforms: Object.keys(PLATFORMS),
        primitives: PRIMITIVES,
        version: '0.4.2'
      };
      
    case 'post':
      return await handlePost(platform, params);
      
    case 'navigate':
      return await handleNavigate(params.url);
      
    case 'getTabs':
      return await handleGetTabs(platform);
      
    case 'execute':
      return await handleExecute(params.tabId, params.script);
    
    // Generic primitives
    case 'click':
    case 'type':
    case 'find':
    case 'getText':
    case 'getAttribute':
    case 'setAttribute':
    case 'scroll':
    case 'hover':
    case 'focus':
    case 'select':
    case 'setChecked':
    case 'wait':
    case 'waitGone':
    case 'delay':
    case 'pageInfo':
    case 'evaluate':
      return await handlePrimitive(params.tabId, { action, ...params });
      
    default:
      return { success: false, error: `Unknown action: ${action}` };
  }
}

/**
 * Handle post command
 */
async function handlePost(platform, params) {
  const { content, mediaUrls, title, subreddit, action } = params;
  
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
  
  // Build options object for platform-specific params
  const options = { title, subreddit, action };
  
  // Execute posting script
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: postContent,
      args: [platform, content, mediaUrls || [], options]
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
  
  // Create new tab using platform's postUrl
  return await chrome.tabs.create({ url: config.postUrl || `https://${config.patterns[0]}` });
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
 * Handle primitive DOM commands
 * @param {number} tabId - Tab to execute in (uses active tab if not specified)
 * @param {Object} command - Primitive command object
 */
async function handlePrimitive(tabId, command) {
  try {
    // Get target tab
    let targetTabId = tabId;
    if (!targetTabId) {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab) {
        return { success: false, error: 'No active tab found' };
      }
      targetTabId = activeTab.id;
    }
    
    // Wait for tab to be ready
    await waitForTab(targetTabId);
    
    // Inject and execute primitive
    const results = await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      func: executePrimitiveInPage,
      args: [command]
    });
    
    return results[0]?.result || { success: false, error: 'No result from primitive' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Execute a primitive command in the page context
 * This function is injected into the page
 */
function executePrimitiveInPage(command) {
  const { action, selector, text, attribute, value, values, checked, ms, script, timeout, options = {} } = command;
  
  // Helper functions
  const waitForElement = (sel, time = 10000) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const check = () => {
        const el = document.querySelector(sel);
        if (el) resolve(el);
        else if (Date.now() - startTime > time) reject(new Error(`Element not found: ${sel}`));
        else setTimeout(check, 100);
      };
      check();
    });
  };
  
  const delay = (milliseconds) => new Promise(r => setTimeout(r, milliseconds));
  
  // Execute the command
  return (async () => {
    try {
      switch (action) {
        case 'click': {
          const el = await waitForElement(selector, timeout || 10000);
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await delay(100);
          el.focus();
          el.click();
          return { success: true, result: { clicked: true, selector } };
        }
        
        case 'type': {
          const el = await waitForElement(selector, timeout || 10000);
          el.focus();
          el.click();
          await delay(50);
          if (options.clear !== false) {
            document.execCommand('selectAll', false, null);
          }
          document.execCommand('insertText', false, text);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true, result: { typed: true, selector, length: text.length } };
        }
        
        case 'find': {
          const elements = document.querySelectorAll(selector);
          const limit = options.limit || 10;
          const results = [];
          for (let i = 0; i < Math.min(elements.length, limit); i++) {
            const el = elements[i];
            const rect = el.getBoundingClientRect();
            results.push({
              index: i,
              tagName: el.tagName.toLowerCase(),
              text: el.textContent?.substring(0, 100)?.trim(),
              visible: rect.width > 0 && rect.height > 0,
              id: el.id,
              className: el.className
            });
          }
          return { success: true, result: { count: elements.length, elements: results } };
        }
        
        case 'getText': {
          const el = await waitForElement(selector, timeout || 10000);
          return { success: true, result: { text: el.textContent?.trim(), selector } };
        }
        
        case 'getAttribute': {
          const el = await waitForElement(selector, timeout || 10000);
          return { success: true, result: { attribute, value: el.getAttribute(attribute), selector } };
        }
        
        case 'setAttribute': {
          const el = await waitForElement(selector, timeout || 10000);
          el.setAttribute(attribute, value);
          return { success: true, result: { attribute, value, selector } };
        }
        
        case 'scroll': {
          const dir = options.direction || 'down';
          const amount = options.amount || 300;
          switch (dir) {
            case 'down': window.scrollBy({ top: amount, behavior: 'smooth' }); break;
            case 'up': window.scrollBy({ top: -amount, behavior: 'smooth' }); break;
            case 'top': window.scrollTo({ top: 0, behavior: 'smooth' }); break;
            case 'bottom': window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); break;
          }
          return { success: true, result: { scrolled: true, direction: dir } };
        }
        
        case 'hover': {
          const el = await waitForElement(selector, timeout || 10000);
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await delay(100);
          el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          return { success: true, result: { hovered: true, selector } };
        }
        
        case 'focus': {
          const el = await waitForElement(selector, timeout || 10000);
          el.focus();
          return { success: true, result: { focused: true, selector } };
        }
        
        case 'select': {
          const el = await waitForElement(selector, timeout || 10000);
          const vals = Array.isArray(values) ? values : [values];
          for (const opt of el.options) {
            opt.selected = vals.includes(opt.value);
          }
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true, result: { selected: true, selector, values: vals } };
        }
        
        case 'setChecked': {
          const el = await waitForElement(selector, timeout || 10000);
          if (el.checked !== checked) el.click();
          return { success: true, result: { checked: el.checked, selector } };
        }
        
        case 'wait': {
          await waitForElement(selector, timeout || 10000);
          return { success: true, result: { found: true, selector } };
        }
        
        case 'waitGone': {
          const startTime = Date.now();
          const time = timeout || 10000;
          while (Date.now() - startTime < time) {
            if (!document.querySelector(selector)) {
              return { success: true, result: { gone: true, selector } };
            }
            await delay(100);
          }
          throw new Error(`Element still present: ${selector}`);
        }
        
        case 'delay': {
          await delay(ms || 1000);
          return { success: true, result: { delayed: true, ms: ms || 1000 } };
        }
        
        case 'pageInfo': {
          return {
            success: true,
            result: {
              url: window.location.href,
              title: document.title,
              readyState: document.readyState,
              scrollY: window.scrollY,
              innerWidth: window.innerWidth,
              innerHeight: window.innerHeight
            }
          };
        }
        
        case 'evaluate': {
          const evalResult = eval(script);
          return { success: true, result: evalResult };
        }
        
        default:
          return { success: false, error: `Unknown primitive: ${action}` };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  })();
}

/**
 * Content posting function (injected into page)
 */
function postContent(platform, content, mediaUrls, options = {}) {
  return new Promise((resolve) => {
    // This will be overridden by platform-specific content scripts
    // For now, dispatch a custom event that content scripts listen to
    const { title, subreddit, action } = options;
    const event = new CustomEvent('marketclaw:post', {
      detail: { platform, content, mediaUrls, title, subreddit, action }
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
    sendResponse({ connected: isConnected, profile: currentProfile });
  } else if (message.type === 'updateProfile') {
    currentProfile = message.profile || 'Default';
    // Re-send handshake with new profile
    sendHandshake();
    sendResponse({ success: true, profile: currentProfile });
  }
  return true;
});

// ============================================
// KEEPALIVE - Prevent MV3 service worker sleep
// ============================================

const KEEPALIVE_ALARM = 'marketclaw-keepalive';
const KEEPALIVE_INTERVAL_MINUTES = 0.4; // ~24 seconds (must be >= 0.4 for alarms)

/**
 * Set up keepalive alarm to prevent service worker from sleeping
 */
async function setupKeepalive() {
  // Clear any existing alarm
  await chrome.alarms.clear(KEEPALIVE_ALARM);
  
  // Create recurring alarm (minimum interval is ~24 seconds / 0.4 minutes)
  chrome.alarms.create(KEEPALIVE_ALARM, {
    periodInMinutes: KEEPALIVE_INTERVAL_MINUTES
  });
  
  console.log('[MarketClaw] Keepalive alarm set');
}

// Handle alarm events
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM) {
    // Just touching the service worker keeps it alive
    console.log('[MarketClaw] Keepalive ping', new Date().toISOString());
    
    // If WebSocket died, reconnect
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.log('[MarketClaw] WebSocket dead, reconnecting...');
      isConnected = false;
      updateBadge('✗', '#ef4444'); // Show disconnected while reconnecting
      connect();
    }
  }
});

// Also keep alive when tab is updated (user is active)
chrome.tabs.onUpdated.addListener(() => {
  // Touch the service worker
});

// Set initial badge state (disconnected until we connect)
updateBadge('✗', '#ef4444'); // Red X = not connected

// Start connection and keepalive
setupKeepalive();
connect();

console.log('[MarketClaw] Extension loaded with keepalive');
