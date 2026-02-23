## Raw Concept
**Task:**
Summarize automation capabilities for all 10 supported platforms

**Files:**
- extension/background.js
- extension/manifest.json

**Timestamp:** 2026-02-23

## Narrative
### Structure
Automation is performed via platform-specific content scripts. The extension manages tabs and navigates to the appropriate submission/post URLs for each of the 10 platforms.

### Features
Social Media (Twitter, LinkedIn, Facebook, Instagram, Threads, Bluesky), Communities (Reddit, Hacker News, Product Hunt), and Video (YouTube).

### Rules
1. Tier 2 platforms (Facebook, Threads, Bluesky, YouTube) were added in v0.4.0.
2. Facebook automation supports posting, commenting, and liking.
3. Threads and Bluesky focus on micro-blogging actions (post, reply, like, repost).
4. YouTube automation enables engagement via comments, likes, and subscriptions.

### Examples
Platform Action Matrix (v0.4.0):
| Platform | Primary Actions |
| :--- | :--- |
| `twitter` | post, reply |
| `linkedin` | post |
| `instagram` | comment, dm |
| `reddit` | post, comment |
| `hackernews` | submit, comment, upvote |
| `producthunt` | upvote, comment, reply |
| `facebook` | post, comment, like |
| `threads` | post, reply, like |
| `bluesky` | post, reply, like, repost |
| `youtube` | comment, reply, like, subscribe |
