## Raw Concept
**Task:**
Document the comprehensive setup and usage of browser automation

**Files:**
- docs/BROWSER-AUTOMATION.md

**Flow:**
MarketClaw Server (port 7890) -> WebSocket -> Chrome Extension (Multi-profile) -> Platform Content Scripts -> DOM Automation

**Timestamp:** 2026-02-23

## Narrative
### Structure
MarketClaw uses a hybrid automation architecture where a central server coordinates with a Chrome extension via WebSockets. This allows for "no-API" posting across 10 platforms using existing browser sessions.

### Features
Zero API costs, multi-account support via Chrome profiles, human-like interaction patterns, and universal DOM primitives for any website.

### Rules
Quick Start Steps:
1. Open Chrome and enable Developer mode at `chrome://extensions/`.
2. Click 'Load unpacked' and select the `extension/` folder.
3. Start the MarketClaw server (`npx tsx src/index.ts`).
4. Log into the desired social platforms in your browser.
5. Verify connection via the extension icon or `browser_status` tool.

Multi-account Setup:
1. Create separate Chrome profiles (e.g., 'Work', 'Personal').
2. Install the extension in each profile.
3. Set a unique 'Profile Name' in each extension popup.
4. Target profiles in tools using the `profile` parameter.

### Examples
Supported Platforms Matrix:
| Platform | Actions | Notes |
| :--- | :--- | :--- |
| 🐦 Twitter/X | `post` | Full posting support |
| 💼 LinkedIn | `post` | Feed posts |
| 🤖 Reddit | `post`, `comment` | Supports old + new Reddit |
| 📸 Instagram | `comment`, `dm` | Web posting limited |
| 🔶 Hacker News | `submit`, `comment`, `upvote` | Link + text submissions |
| 🚀 Product Hunt | `upvote`, `comment`, `reply` | Navigate to product first |
| 📘 Facebook | `post`, `comment`, `like` | Feed posts |
| 🧵 Threads | `post`, `reply`, `like` | Meta's Twitter alternative |
| 🦋 Bluesky | `post`, `reply`, `like`, `repost` | Full support |
| ▶️ YouTube | `comment`, `reply`, `like`, `subscribe` | Comments only |

### Diagrams
```
┌─────────────────┐         WebSocket          ┌──────────────────┐
│   MarketClaw    │◄─────── (port 7890) ──────►│ Chrome Extension │
│     Server      │                            │  (your browser)  │
└─────────────────┘                            └──────────────────┘
```

```
MarketClaw Server (port 7890)
         │
         │ WebSocket
         ▼
┌─────────────────────────────────────────────────────┐
│              Chrome Extension                        │
│  ┌─────────────────────────────────────────────┐    │
│  │           background.js                      │    │
│  │  • WebSocket client                          │    │
│  │  • Command routing                           │    │
│  │  • Profile management                        │    │
│  └──────────────┬──────────────────────────────┘    │
│                 │                                    │
│  ┌──────────────┴──────────────────────────────┐    │
│  │         Content Scripts (injected)           │    │
│  │  • twitter.js    • facebook.js               │    │
│  │  • linkedin.js   • threads.js                │    │
│  │  • reddit.js     • bluesky.js                │    │
│  │  • instagram.js  • youtube.js                │    │
│  │  • hackernews.js • producthunt.js            │    │
│  └──────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```
