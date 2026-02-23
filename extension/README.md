# MarketClaw Browser Extension

Chrome extension for automated social media posting via MarketClaw.

## Features

- 🐦 **Twitter/X** — Compose and post tweets
- 💼 **LinkedIn** — Create and publish posts
- 🔌 **WebSocket** — Real-time communication with MarketClaw
- 🎯 **Automation** — No manual clicking needed

## Installation (Developer Mode)

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select this folder (`marketclaw-extension`)
5. The extension icon should appear in your toolbar

## Usage

### With MarketClaw Server

1. Start MarketClaw with the WebSocket server enabled
2. The extension will auto-connect to `ws://localhost:7890`
3. Send commands via MarketClaw:

```javascript
// Post to Twitter
{
  "action": "post",
  "platform": "twitter",
  "content": "Hello from MarketClaw! 🦀"
}

// Post to LinkedIn
{
  "action": "post",
  "platform": "linkedin", 
  "content": "Excited to share our latest update..."
}
```

### Manual Posting (via popup)

1. Click the extension icon
2. Select platform
3. Enter content
4. Click Post

## Commands

| Action | Description |
|--------|-------------|
| `ping` | Health check |
| `status` | Get connection status |
| `post` | Post content to a platform |
| `navigate` | Open a URL in new tab |
| `getTabs` | List open tabs for a platform |
| `execute` | Run custom script in tab |

## WebSocket Server

The extension connects to a WebSocket server at `ws://localhost:7890`.

Message format:
```json
{
  "id": "unique-id",
  "action": "post",
  "platform": "twitter",
  "content": "Tweet content here"
}
```

Response format:
```json
{
  "type": "response",
  "id": "unique-id",
  "success": true,
  "message": "Tweet posted successfully"
}
```

## Development

```bash
# Watch for changes (no build needed for Chrome extensions)
# Just reload the extension in chrome://extensions/
```

## Supported Platforms

- ✅ Twitter / X
- ✅ LinkedIn
- 🚧 Instagram (coming soon)
- 🚧 Facebook (coming soon)

## Security

- Only connects to `localhost`
- Limited to whitelisted domains
- No data sent to external servers
