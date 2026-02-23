# Browser Automation Setup Guide

MarketClaw can post to 10 social media platforms via the Chrome extension — no API costs, posts like a human using your logged-in browser sessions.

## Overview

```
┌─────────────────┐         WebSocket          ┌──────────────────┐
│   MarketClaw    │◄─────── (port 7890) ──────►│ Chrome Extension │
│     Server      │                            │  (your browser)  │
└─────────────────┘                            └──────────────────┘
```

**How it works:**
1. MarketClaw server runs a WebSocket server on port 7890
2. Chrome extension connects to the server
3. When you say "Post to Twitter", MarketClaw sends a command to the extension
4. Extension automates the browser to post (using your logged-in session)

**Benefits:**
- ✅ No API costs
- ✅ No API rate limits
- ✅ Posts as you (your real account)
- ✅ Works with any account you're logged into
- ✅ Multi-account support via Chrome profiles

---

## Quick Start

### 1. Install the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `extension/` folder from your MarketClaw directory
5. Pin the extension to your toolbar (optional but recommended)

### 2. Start MarketClaw

```bash
# If using pm2
pm2 restart marketclaw

# Or start directly
npx tsx src/index.ts
```

### 3. Verify Connection

Click the extension icon — you should see:
- 🟢 **Connected to MarketClaw** — Ready to go!
- 🔴 **Disconnected** — Check that MarketClaw is running

Or use the tool:
```
You: "Check browser status"
Bot: ✅ Browser extension connected. Profiles: Default. Clients: 1
```

### 4. Log Into Your Accounts

Open tabs and log into the platforms you want to use:
- Twitter/X
- LinkedIn
- Reddit
- Instagram
- Facebook
- Threads
- Bluesky
- YouTube
- Hacker News
- Product Hunt

### 5. Start Posting!

```
You: "Post to Twitter: Hello from MarketClaw! 🦀"
Bot: ✅ Posted to Twitter successfully
```

---

## Supported Platforms

| Platform | Actions | Notes |
|----------|---------|-------|
| 🐦 **Twitter/X** | `post` | Full posting support |
| 💼 **LinkedIn** | `post` | Feed posts |
| 🤖 **Reddit** | `post`, `comment` | Supports old + new Reddit |
| 📸 **Instagram** | `comment`, `dm` | Web posting limited (use comments) |
| 🔶 **Hacker News** | `submit`, `comment`, `upvote` | Link + text submissions |
| 🚀 **Product Hunt** | `upvote`, `comment`, `reply` | Navigate to product first |
| 📘 **Facebook** | `post`, `comment`, `like` | Feed posts |
| 🧵 **Threads** | `post`, `reply`, `like` | Meta's Twitter alternative |
| 🦋 **Bluesky** | `post`, `reply`, `like`, `repost` | Full support |
| ▶️ **YouTube** | `comment`, `reply`, `like`, `subscribe` | Comments only (no uploads) |

---

## Multi-Account Setup (Profiles)

Use Chrome profiles to manage multiple accounts (e.g., personal + work Twitter).

### 1. Create Chrome Profiles

1. Click your profile icon in Chrome (top right)
2. Click **Add** to create a new profile
3. Name it (e.g., "Work", "Personal", "Client - Acme")
4. Log into your accounts in each profile

### 2. Install Extension in Each Profile

The extension needs to be installed separately in each Chrome profile:

1. Open Chrome with each profile
2. Go to `chrome://extensions/`
3. Load the extension (same `extension/` folder)

### 3. Name Your Profiles in the Extension

1. Click the MarketClaw extension icon
2. Enter a name in the "Profile Name" field (e.g., "Work")
3. Click Save

### 4. Target Specific Profiles

```
You: "Post to Twitter from Work profile: Company announcement"
Bot: ✅ Posted to Twitter (Work profile)

You: "Post to Twitter from Personal: Weekend vibes 🌴"
Bot: ✅ Posted to Twitter (Personal profile)
```

### 5. Check Connected Profiles

```
You: "Check browser status"
Bot: ✅ Browser extension connected. Profiles: Work, Personal. Clients: 2
```

---

## Available Tools

### Generic Tool

**`browser_post`** — Post to any platform:

```typescript
browser_post({
  platform: 'twitter',      // Required: platform name
  content: 'Hello world!',  // Required: post content
  profile: 'Work',          // Optional: target profile
  action: 'post',           // Optional: action type
  // Platform-specific options:
  subreddit: 'startups',    // Reddit: target subreddit
  title: 'My post',         // Reddit/HN: post title
  url: 'https://...',       // HN: link submission
  username: 'user123',      // Instagram: DM recipient
})
```

### Platform-Specific Tools

| Tool | Platform | Best For |
|------|----------|----------|
| `reddit_post` | Reddit | Subreddit posts, comments |
| `hn_submit` | Hacker News | Show HN, Ask HN, links |
| `ph_interact` | Product Hunt | Launch day engagement |
| `instagram_interact` | Instagram | Comments, DMs |
| `facebook_post` | Facebook | Feed posts |
| `threads_post` | Threads | Threading |
| `bluesky_post` | Bluesky | Full posting |
| `youtube_interact` | YouTube | Video engagement |

### Low-Level Primitives

For automating any website (not just the supported platforms):

| Tool | Description |
|------|-------------|
| `browser_click` | Click element by CSS selector |
| `browser_type` | Type text into element |
| `browser_find` | Find elements matching selector |
| `browser_wait` | Wait for element to appear |
| `browser_scroll` | Scroll the page |
| `browser_get_text` | Get element text content |
| `browser_page_info` | Get page URL, title |
| `browser_navigate` | Open URL in new tab |

---

## Examples

### Basic Posting

```
You: "Post to Twitter: Just shipped a new feature! 🚀"
Bot: ✅ Posted to Twitter successfully

You: "Post to LinkedIn: Excited to announce..."
Bot: ✅ Posted to LinkedIn successfully
```

### Reddit

```
You: "Post to r/startups: title 'Show r/startups: My new SaaS' with content 'Hey everyone, just launched...'"
Bot: ✅ Posted to Reddit (r/startups)

You: "Comment on this Reddit post: Great insights!"
Bot: ✅ Comment posted to Reddit
```

### Hacker News

```
You: "Submit to HN: title 'Show HN: MarketClaw' with url 'https://marketclaw.io'"
Bot: ✅ Submitted to Hacker News

You: "Upvote this HN post"
Bot: ✅ Upvoted on Hacker News
```

### Product Hunt

```
You: "Upvote this product"
Bot: ✅ Upvoted on Product Hunt

You: "Comment: Congrats on the launch! 🚀"
Bot: ✅ Comment posted to Product Hunt
```

### Multi-Account

```
You: "From my Work account, post to Twitter: Q4 results are in..."
Bot: ✅ Posted to Twitter (Work profile)

You: "From Personal, post to Bluesky: Weekend project update 🛠️"
Bot: ✅ Posted to Bluesky (Personal profile)
```

---

## Troubleshooting

### Extension Not Connecting

**Symptoms:** Extension shows "Disconnected"

**Solutions:**
1. Make sure MarketClaw server is running (`pm2 status marketclaw`)
2. Check that port 7890 is not blocked
3. Restart MarketClaw: `pm2 restart marketclaw`
4. Reload extension: `chrome://extensions/` → click refresh icon

### Posts Failing

**Symptoms:** "Could not find post button" or similar errors

**Solutions:**
1. Make sure you're logged into the platform
2. Navigate to the platform's homepage first
3. Check for popups/modals blocking the UI
4. Try refreshing the page

### Wrong Account Posting

**Symptoms:** Post went to wrong account

**Solutions:**
1. Name your profiles in the extension popup
2. Use `profile` parameter: `browser_post({ ..., profile: 'Work' })`
3. Check connected profiles: `browser_status()`

### Rate Limiting

**Symptoms:** Posts failing after several successful ones

**Solutions:**
1. Space out your posts (the platforms have rate limits)
2. Use scheduling: `schedule_task` to spread posts over time
3. Check platform-specific limits (e.g., HN has strict rate limits)

---

## Security Considerations

- **Local only:** Extension only connects to `localhost:7890`
- **No data exfiltration:** Extension doesn't send data anywhere except local server
- **Your credentials stay in your browser:** MarketClaw never sees your passwords
- **Profile isolation:** Each Chrome profile is isolated

---

## Architecture

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

---

## Updating the Extension

When MarketClaw updates:

1. Pull latest code: `git pull`
2. Go to `chrome://extensions/`
3. Click the refresh icon on MarketClaw extension
4. Restart MarketClaw: `pm2 restart marketclaw`

---

## FAQ

**Q: Do I need API keys for the platforms?**
A: No! The extension uses your logged-in browser sessions.

**Q: Can I schedule browser posts?**
A: Yes! Use `schedule_task` to schedule any browser automation.

**Q: What if a platform changes their UI?**
A: The content scripts may need updating. Check for MarketClaw updates.

**Q: Can I use this with headless browsers?**
A: Not currently. The extension requires a real Chrome browser.

**Q: Is this against the platforms' ToS?**
A: Browser automation exists in a gray area. Use responsibly and don't spam.

---

## Next Steps

- [Tools Reference](./TOOLS.md) — Full list of browser tools
- [Extension README](../extension/README.md) — Detailed extension docs
- [Scheduling](./TOOLS.md#-scheduling-tools) — Schedule browser posts
