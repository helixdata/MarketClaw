## Raw Concept
**Task:**
Document the server-side WebSocket bridge for browser automation

**Files:**
- src/browser/extension-bridge.ts
- src/browser/tools.ts

**Flow:**
Agent -> browser_post -> extensionBridge.post() -> WebSocket (port 7890) -> Browser Extension -> DOM Automation -> Response -> Agent

**Timestamp:** 2026-02-23

## Narrative
### Structure
The `ExtensionBridge` (src/browser/extension-bridge.ts) runs a WebSocket server on port 7890. It manages connections from the MarketClaw Chrome extension and provides an asynchronous request-response interface for the agent.

### Features
Real-time command routing, automatic request timeouts (default 30s), client capability tracking (handshake), and support for multiple browser commands (post, navigate, getTabs).

### Rules
1. Communication is JSON-based with unique IDs for request tracking.
2. Commands are only sent if an active client is connected via WebSocket.
3. `browser_post` enforces platform-specific rules (e.g., Twitter 280-char limit) before bridging the command.

### Examples
Browser Automation Tools:
| Tool Name | Action | Description |
| :--- | :--- | :--- |
| `browser_post` | `post` | Post content to Twitter/X or LinkedIn using the browser's session |
| `browser_status` | `status` | Check if the extension is connected and list its capabilities |
| `browser_navigate` | `navigate` | Open a specific URL in a new browser tab |
