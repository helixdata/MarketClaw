## Raw Concept
**Task:**
Document the expanded browser toolset including Tier 2 platforms and profile targeting

**Files:**
- src/browser/tools.ts

**Flow:**
Agent Tool -> extensionBridge.sendCommand(command, profile) -> WebSocket -> Browser Profile -> DOM Action -> Result

**Timestamp:** 2026-02-23

## Narrative
### Structure
The browser toolset (src/browser/tools.ts) now includes 18 specialized tools supporting 10 platforms and multi-profile targeting.

### Features
Support for Facebook, Threads, Bluesky, and YouTube automation. All tools now support the `profile` parameter for targeting specific browser instances.

### Rules
1. `browser_post` remains the universal interface for all 10 platforms.
2. Tier 2 tools (`facebook_post`, `threads_post`, `bluesky_post`, `youtube_interact`) provide dedicated parameters for platform-specific engagement.
3. Profile targeting allows commands to be routed to specific browser sessions (e.g., "Work" vs "Personal").

### Examples
Expanded Browser Tool Suite (18 tools):
| Platform Tier | Tool Name | Actions Supported |
| :--- | :--- | :--- |
| **Tier 1** | `reddit_post` | post, comment |
| **Tier 1** | `hn_submit` | submit, comment, upvote |
| **Tier 1** | `ph_interact` | upvote, comment, reply |
| **Tier 1** | `instagram_interact` | comment, dm |
| **Tier 2** | `facebook_post` | post, comment, like |
| **Tier 2** | `threads_post` | post, reply, like |
| **Tier 2** | `bluesky_post` | post, reply, like, repost |
| **Tier 2** | `youtube_interact` | comment, reply, like, subscribe, info |
