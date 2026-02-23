## Raw Concept
**Task:**
Document the Gmail integration tools and CLI bridge

**Files:**
- src/tools/gmail-tools.ts

**Flow:**
Tool.execute -> execGog(command) -> gog gmail CLI -> Gmail Action -> Result

**Timestamp:** 2026-02-23

## Narrative
### Structure
Gmail integration is implemented via a bridge to the `gog` CLI tool. The `gmailTools` module in src/tools/gmail-tools.ts provides a standard interface for the agent to manage and monitor incoming emails.

### Features
Checking inbox for unread messages, searching emails with advanced Gmail operators, reading full threads, retrieving single messages, and monitoring for replies or marketing-relevant keywords.

### Rules
1. Commands are executed via `gog gmail {args} --json` to ensure structured data return.
2. OAuth credentials must be configured at `~/.marketclaw/google-credentials.json` for the bridge to function.
3. Search queries support all standard Gmail operators (from:, subject:, after:, etc.).
4. `monitor_marketing_inbox` uses a default set of keywords (partnership, press, collaboration, etc.) unless overridden.

### Examples
Gmail Tool Suite:
| Tool Name | Action | Description |
| :--- | :--- | :--- |
| `check_inbox` | `search` | Fetch unread or inbox threads (supports `unreadOnly` and `limit`) |
| `search_emails` | `search` | Execute advanced Gmail search queries |
| `read_email_thread` | `thread` | Retrieve all messages in a specific thread by ID |
| `get_email` | `get` | Fetch a single email message including body and attachments status |
| `check_email_replies` | `search` | Identify threads with replies (multiple messages not from self) |
| `monitor_marketing_inbox` | `search` | Look for unread emails matching marketing keywords (press, inquiry, etc.) |
