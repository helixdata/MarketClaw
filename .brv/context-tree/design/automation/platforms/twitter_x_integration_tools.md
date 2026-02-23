## Raw Concept
**Task:**
Document the Twitter/X integration tools and CLI bridge

**Files:**
- src/tools/twitter-tools.ts

**Flow:**
Tool.execute -> execBird(command) -> bird CLI -> Twitter Action -> Result

**Timestamp:** 2026-02-23

## Narrative
### Structure
Twitter integration is primarily handled via a bridge to the `bird` CLI tool. The `twitterTools` module in src/tools/twitter-tools.ts provides a standard interface for the agent to interact with Twitter/X.

### Features
Posting tweets with media, replying to threads, searching tweets, retrieving mentions, reading specific tweets, and checking authentication status.

### Rules
1. Tweets are capped at 280 characters; the `post_tweet` tool enforces this before execution.
2. `execBird` is used to run subcommands like `tweet`, `reply`, `search`, and `mentions`.
3. The `dryRun` parameter in `post_tweet` allows for content preview without actual posting.
4. `check_twitter_auth` verifies authentication status by running the `whoami` command via the CLI.

### Examples
Twitter Tool Suite:
| Tool Name | Action | Description |
| :--- | :--- | :--- |
| `post_tweet` | `tweet` | Post a new tweet (supports `imagePath` and `imageAlt`) |
| `reply_tweet` | `reply` | Reply to an existing tweet URL or ID |
| `search_tweets` | `search` | Search Twitter using standard operators |
| `get_mentions` | `mentions` | Retrieve recent mentions/notifications |
| `read_tweet` | `read` | Fetch details of a specific tweet |
| `get_home_timeline` | `home` | Get the "For You" or "Following" timeline |
| `get_user_tweets` | `user-tweets` | Fetch tweets from a specific @username |
| `draft_tweet` | N/A | Provide formatting guidelines for a draft (no CLI call) |
| `check_twitter_auth` | `whoami` | Check if Twitter cookies are valid and return user handle |
