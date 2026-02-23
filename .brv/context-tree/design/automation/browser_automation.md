## Raw Concept
**Task:**
Document the browser automation capabilities and supported platforms

**Files:**
- README.md
- extension/background.js

**Timestamp:** 2026-02-23

## Narrative
### Structure
Browser automation is handled via a Chrome extension that connects to the MarketClaw server via WebSockets. It allows for human-like posting without API costs by utilizing existing browser sessions.

### Features
Support for 10 platforms, multi-account profile targeting, and low-level DOM primitives for universal site automation.

### Rules
Supported Platforms and Actions:
| Platform | Actions |
|----------|---------|
| 🐦 Twitter/X | Post |
| 💼 LinkedIn | Post |
| 🤖 Reddit | Post, comment |
| 📸 Instagram | Comment, DM |
| 🔶 Hacker News | Submit, comment, upvote |
| 🚀 Product Hunt | Upvote, comment |
| 📘 Facebook | Post, comment, like |
| 🧵 Threads | Post, reply, like |
| 🦋 Bluesky | Post, reply, like, repost |
| ▶️ YouTube | Comment, like, subscribe |

### Examples
Multi-account targeting example:
"Post to Twitter from my work account: Company announcement" -> Targets "Work" profile.
