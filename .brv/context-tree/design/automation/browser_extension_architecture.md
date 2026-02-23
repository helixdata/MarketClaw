## Raw Concept
**Task:**
Document the v0.4.0 browser extension architecture and 10 supported platforms

**Files:**
- extension/manifest.json
- extension/background.js
- extension/content-scripts/

**Timestamp:** 2026-02-23

## Narrative
### Structure
The browser extension (v0.4.0) supports 10 major social and community platforms. It uses a modular content-script architecture where each platform has its own automation logic and matching patterns in `manifest.json`.

### Features
Real-time WebSocket bridge, multi-profile support, generic DOM primitives, and specialized automation for social media, community forums, and video platforms.

### Rules
Complete Supported Platforms (v0.4.0):
| Platform | Domain Patterns | Content Script | Actions |
| :--- | :--- | :--- | :--- |
| **Twitter/X** | `twitter.com`, `x.com` | `twitter.js` | post, reply |
| **LinkedIn** | `linkedin.com` | `linkedin.js` | post |
| **Instagram** | `instagram.com` | `instagram.js` | comment, dm |
| **Reddit** | `reddit.com`, `old.reddit.com` | `reddit.js` | post, comment |
| **Hacker News** | `news.ycombinator.com` | `hackernews.js` | submit, comment, upvote |
| **Product Hunt** | `producthunt.com` | `producthunt.js` | upvote, comment, reply |
| **Facebook** | `facebook.com` | `facebook.js` | post, comment, like |
| **Threads** | `threads.net` | `threads.js` | post, reply, like |
| **Bluesky** | `bsky.app` | `bluesky.js` | post, reply, like, repost |
| **YouTube** | `youtube.com` | `youtube.js` | comment, reply, like, subscribe |

### Examples
Handshake Capabilities (v0.4.0):
```json
{
  "type": "handshake",
  "client": "marketclaw-extension",
  "version": "0.4.0",
  "profile": "Work",
  "capabilities": {
    "platforms": ["twitter", "linkedin", "instagram", "reddit", "hackernews", "producthunt", "facebook", "threads", "bluesky", "youtube"],
    "primitives": ["click", "type", "find", "getText", "getAttribute", "setAttribute", "scroll", "hover", "focus", "select", "setChecked", "wait", "waitGone", "delay", "pageInfo", "evaluate"]
  }
}```
