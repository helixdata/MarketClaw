# MarketClaw Browser Extension

Chrome extension for automated social media posting and browser automation via MarketClaw.

## Features

- 🌐 **10 Platforms** — Twitter, LinkedIn, Reddit, Instagram, HN, Product Hunt, Facebook, Threads, Bluesky, YouTube
- 🔧 **Generic Primitives** — Low-level DOM automation for any website
- 👤 **Profile Support** — Target specific browser profiles for multi-account management
- 🔌 **WebSocket** — Real-time communication with MarketClaw

## Installation (Developer Mode)

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select this folder (`extension/`)
5. The extension icon should appear in your toolbar

## Quick Start

1. Start MarketClaw server (`pm2 restart marketclaw`)
2. Extension auto-connects to `ws://localhost:7890`
3. Name your profile in the popup (for multi-account support)
4. Use MarketClaw tools to automate!

---

## Supported Platforms (10)

| Platform | Actions | Notes |
|----------|---------|-------|
| 🐦 **Twitter/X** | `post` | Full posting support |
| 💼 **LinkedIn** | `post` | Full posting support |
| 🤖 **Reddit** | `post`, `comment` | Supports old + new Reddit |
| 📸 **Instagram** | `comment`, `dm` | Web posting limited |
| 🔶 **Hacker News** | `submit`, `comment`, `upvote` | Link + text submissions |
| 🚀 **Product Hunt** | `upvote`, `comment`, `reply` | |
| 📘 **Facebook** | `post`, `comment`, `like` | Feed posts |
| 🧵 **Threads** | `post`, `reply`, `like` | Meta's Twitter alternative |
| 🦋 **Bluesky** | `post`, `reply`, `like`, `repost` | Full support |
| ▶️ **YouTube** | `comment`, `reply`, `like`, `subscribe` | Comments only |

---

## MarketClaw Tools (18)

### Generic Browser Tools

| Tool | Description |
|------|-------------|
| `browser_post` | Post to any platform (supports all 10) |
| `browser_status` | Check connection status and connected profiles |
| `browser_navigate` | Open a URL in new tab |
| `browser_click` | Click element by CSS selector |
| `browser_type` | Type text into element |
| `browser_find` | Find elements matching selector |
| `browser_wait` | Wait for element to appear |
| `browser_page_info` | Get page URL, title, dimensions |
| `browser_scroll` | Scroll page up/down/top/bottom |
| `browser_get_text` | Get text content of element |

### Platform-Specific Tools (Tier 1)

| Tool | Platform | Actions |
|------|----------|---------|
| `reddit_post` | Reddit | `post`, `comment` |
| `hn_submit` | Hacker News | `submit`, `comment`, `upvote` |
| `ph_interact` | Product Hunt | `upvote`, `comment`, `reply` |
| `instagram_interact` | Instagram | `comment`, `dm` |

### Platform-Specific Tools (Tier 2)

| Tool | Platform | Actions |
|------|----------|---------|
| `facebook_post` | Facebook | `post`, `comment`, `like` |
| `threads_post` | Threads | `post`, `reply`, `like` |
| `bluesky_post` | Bluesky | `post`, `reply`, `like`, `repost` |
| `youtube_interact` | YouTube | `comment`, `reply`, `like`, `subscribe`, `info` |

---

## Usage Examples

### Basic Posting

```typescript
// Twitter
browser_post({ platform: 'twitter', content: 'Hello Twitter! 🐦' })

// LinkedIn
browser_post({ platform: 'linkedin', content: 'Professional update' })

// With profile targeting (multi-account)
browser_post({ platform: 'twitter', content: 'From work account', profile: 'Work' })
```

### Reddit

```typescript
// Submit a post
reddit_post({ 
  subreddit: 'startups', 
  title: 'Show r/startups: My new project', 
  content: 'Description of the project...' 
})

// Comment on a post (navigate to post first)
reddit_post({ action: 'comment', content: 'Great post!' })
```

### Hacker News

```typescript
// Submit a link
hn_submit({ 
  title: 'Show HN: MarketClaw', 
  url: 'https://marketclaw.io' 
})

// Submit a text post (Ask HN, Show HN)
hn_submit({ 
  title: 'Ask HN: Best practices for...', 
  content: 'I was wondering...' 
})

// Comment
hn_submit({ action: 'comment', content: 'Interesting perspective' })

// Upvote current story
hn_submit({ action: 'upvote' })
```

### Product Hunt

```typescript
// Upvote a product (navigate to product page first)
ph_interact({ action: 'upvote' })

// Comment
ph_interact({ action: 'comment', content: 'Congrats on the launch! 🚀' })
```

### Instagram

```typescript
// Comment on a post (navigate to post first)
instagram_interact({ action: 'comment', content: 'Love this! 🔥' })

// Send a DM
instagram_interact({ action: 'dm', username: 'someuser', content: 'Hey!' })
```

### Facebook

```typescript
// Create a post
facebook_post({ content: 'Hello Facebook!' })

// Comment on a post
facebook_post({ action: 'comment', content: 'Great post!' })

// Like a post
facebook_post({ action: 'like' })
```

### Threads

```typescript
// Create a thread
threads_post({ content: 'My first thread 🧵' })

// Reply to a thread
threads_post({ action: 'reply', content: 'Great point!' })
```

### Bluesky

```typescript
// Create a post (skeet)
bluesky_post({ content: 'Hello Bluesky! 🦋' })

// Reply
bluesky_post({ action: 'reply', content: 'Interesting thought' })

// Repost
bluesky_post({ action: 'repost' })
```

### YouTube

```typescript
// Comment on a video (navigate to video first)
youtube_interact({ action: 'comment', content: 'Great video!' })

// Like the video
youtube_interact({ action: 'like' })

// Subscribe to channel
youtube_interact({ action: 'subscribe' })

// Get video info
youtube_interact({ action: 'info' })
```

### Low-Level Primitives

```typescript
// Click any element
browser_click({ selector: '[data-testid="submit-btn"]' })

// Type into any input
browser_type({ selector: '#search', text: 'search query' })

// Find elements
browser_find({ selector: 'button.primary', limit: 5 })

// Wait for element
browser_wait({ selector: '.modal', timeout: 5000 })

// Get page info
browser_page_info({})

// Scroll
browser_scroll({ direction: 'down', amount: 500 })
browser_scroll({ direction: 'bottom' })  // Scroll to bottom
```

---

## Profile Support (Multi-Account)

The extension supports multiple Chrome profiles for managing different accounts:

1. **Name your profile** in the extension popup (e.g., "Work", "Personal", "Client1")
2. **Check connected profiles**: `browser_status()` shows all connected profiles
3. **Target specific profile**: Add `profile` parameter to any tool

```typescript
// Check connected profiles
browser_status()
// → "Profiles: Work, Personal. Clients: 2"

// Post from specific account
browser_post({ platform: 'twitter', content: 'Work tweet', profile: 'Work' })
browser_post({ platform: 'twitter', content: 'Personal tweet', profile: 'Personal' })
```

---

## WebSocket Protocol

### Connection

Extension connects to `ws://localhost:7890` and sends handshake:

```json
{
  "type": "handshake",
  "client": "marketclaw-extension",
  "version": "0.4.0",
  "profile": "Work",
  "capabilities": {
    "platforms": ["twitter", "linkedin", "reddit", ...],
    "primitives": ["click", "type", "find", ...]
  }
}
```

### Request Format

```json
{
  "id": "unique-id",
  "action": "post",
  "platform": "twitter",
  "content": "Hello!",
  "profile": "Work"
}
```

### Response Format

```json
{
  "type": "response",
  "id": "unique-id",
  "success": true,
  "result": { ... }
}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      MarketClaw Server                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ browser_post({ platform, content, profile })        │    │
│  │ reddit_post({ subreddit, title, content })          │    │
│  │ browser_click({ selector })                         │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                    WebSocket (7890)                          │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │
┌───────────────────────────┼──────────────────────────────────┐
│              Chrome Extension (v0.4.0)                       │
│                           │                                  │
│  ┌────────────────────────┴─────────────────────────────┐   │
│  │              background.js                            │   │
│  │  • WebSocket client                                   │   │
│  │  • Command routing                                    │   │
│  │  • Profile management                                 │   │
│  │  • Script injection                                   │   │
│  └──────────────┬───────────────────┬───────────────────┘   │
│                 │                   │                        │
│    ┌────────────┴────┐    ┌────────┴────────┐              │
│    │ Platform Scripts│    │ Primitives      │              │
│    │ • twitter.js    │    │ (injected)      │              │
│    │ • linkedin.js   │    │ • click         │              │
│    │ • reddit.js     │    │ • type          │              │
│    │ • instagram.js  │    │ • find          │              │
│    │ • hackernews.js │    │ • wait          │              │
│    │ • producthunt.js│    │ • scroll        │              │
│    │ • facebook.js   │    │ • getText       │              │
│    │ • threads.js    │    │ • etc...        │              │
│    │ • bluesky.js    │    │                 │              │
│    │ • youtube.js    │    │                 │              │
│    └─────────────────┘    └─────────────────┘              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
extension/
├── manifest.json           # Extension manifest (v0.4.0)
├── background.js           # Service worker
├── popup.html/js           # Extension popup UI
├── content-scripts/
│   ├── twitter.js          # Twitter/X automation
│   ├── linkedin.js         # LinkedIn automation
│   ├── reddit.js           # Reddit automation
│   ├── instagram.js        # Instagram automation
│   ├── hackernews.js       # HN automation
│   ├── producthunt.js      # Product Hunt automation
│   ├── facebook.js         # Facebook automation
│   ├── threads.js          # Threads automation
│   ├── bluesky.js          # Bluesky automation
│   ├── youtube.js          # YouTube automation
│   └── primitives.js       # Generic DOM primitives
└── icons/                  # Extension icons
```

---

## Security

- Only connects to `localhost` WebSocket server
- Limited to whitelisted domains in manifest
- No data sent to external servers
- Profile data stored locally in chrome.storage

---

## Version History

### 0.4.0 (Current)

- Added Facebook, Threads, Bluesky, YouTube support
- Total 10 platforms, 18 tools
- Updated popup to show all platforms

### 0.3.0

- Added Reddit, Instagram, Hacker News, Product Hunt
- Added Chrome profile support for multi-account
- Profile targeting in all tools

### 0.2.0

- Added generic primitives (click, type, find, wait, etc.)
- Hybrid architecture: platform recipes + low-level automation

### 0.1.0

- Initial release
- Twitter and LinkedIn posting
- WebSocket communication with MarketClaw
