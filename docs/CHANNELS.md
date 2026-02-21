# Channels

## Image Support

All channels support receiving images from users:

- **Telegram**: Photos and image documents
- **Discord**: Image attachments
- **Slack**: Image file uploads

When an image is received, it's:
1. Downloaded and saved to `~/.marketclaw/images/`
2. Converted to base64 for AI processing
3. Sent to vision-capable models (GPT-4o, Claude, Gemini)

The AI can then analyze, describe, or answer questions about the images.

---

MarketClaw uses a modular channel system for interacting with users across different platforms. Each channel implements a common interface, making it easy to add new platforms.

## Available Channels

| Channel | Status | Description |
|---------|--------|-------------|
| Telegram | ✅ Ready | Full-featured Telegram bot |
| Discord | 🚧 Stub | Bot framework ready |
| Slack | 🚧 Stub | Bolt app ready |
| CLI | ✅ Ready | Local command-line testing |

All channels share the same agent, memory, and tools — only the interface differs.

## Configuration

Channels are configured in `~/.marketclaw/config.yaml`:

```yaml
channels:
  telegram:
    enabled: true
    botToken: "your-telegram-bot-token"
    allowedUsers: [123456789]  # Optional: restrict access
    
  discord:
    enabled: false
    botToken: "your-discord-bot-token"
    guildIds: ["guild-id"]  # Optional
    
  slack:
    enabled: false
    botToken: "xoxb-your-bot-token"
    appToken: "xapp-your-app-token"
    
  cli:
    enabled: false  # Enable for local testing
```

## Channel Interface

All channels implement the `Channel` interface:

```typescript
interface Channel {
  // Identification
  readonly name: string;
  readonly displayName: string;
  readonly description: string;
  
  // Config requirements (for setup wizard)
  readonly requiredConfig: string[];
  readonly optionalConfig?: string[];
  readonly requiredEnv?: string[];
  
  // Lifecycle
  initialize(config: ChannelConfig): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  
  // Messaging
  send(userId: string, response: ChannelResponse): Promise<void>;
  
  // Validation
  isConfigured(): boolean;
  validateConfig?(config: ChannelConfig): Promise<{ valid: boolean; error?: string }>;
}
```

## Creating a New Channel

1. Create a new file in `src/channels/`:

```typescript
// src/channels/whatsapp.ts
import { Channel, ChannelConfig, ChannelResponse } from './types.js';
import { channelRegistry } from './registry.js';

export class WhatsAppChannel implements Channel {
  readonly name = 'whatsapp';
  readonly displayName = 'WhatsApp';
  readonly description = 'Interact via WhatsApp Business API';
  readonly requiredConfig = ['phoneNumberId', 'accessToken'];
  readonly requiredEnv = ['WHATSAPP_ACCESS_TOKEN'];

  // Implement all interface methods...
}

// Register the channel
export const whatsappChannel = new WhatsAppChannel();
channelRegistry.register(whatsappChannel);
```

2. Import in `src/channels/index.ts`:

```typescript
import './whatsapp.js';
export { whatsappChannel } from './whatsapp.js';
```

3. The channel will automatically appear in the setup wizard!

## Message Flow

1. Channel receives a message from user
2. Channel creates a `ChannelMessage` object:
   ```typescript
   {
     id: "msg-123",
     userId: "user-456",
     username: "johndoe",
     text: "Create a tweet about my product",
     timestamp: new Date(),
     metadata: { ... }
   }
   ```
3. Channel calls the registered message handler
4. Agent processes and returns `ChannelResponse`:
   ```typescript
   {
     text: "Here's a draft tweet: ...",
     replyToId: "msg-123",
     buttons: [
       { text: "Post it", callback: "post_tweet" },
       { text: "Edit", callback: "edit_tweet" }
     ]
   }
   ```
5. Channel formats and sends the response

## Telegram Setup

1. Create a bot via [@BotFather](https://t.me/BotFather)
2. Copy the bot token
3. Run `marketclaw setup` and enter the token when prompted
4. Start MarketClaw and message your bot!

### Telegram Features

- Text messages
- Inline buttons (callbacks)
- Markdown formatting
- Typing indicators
- Reply threading

### Restricting Access

To limit who can use your bot:

```yaml
telegram:
  enabled: true
  botToken: "..."
  allowedUsers: [123456789, 987654321]  # Telegram user IDs only
```

Get your user ID by messaging [@userinfobot](https://t.me/userinfobot).

## CLI Mode

For local testing without external services:

```bash
marketclaw start --channel cli
```

Or enable in config:

```yaml
channels:
  cli:
    enabled: true
  telegram:
    enabled: false
```

## Multiple Channels

You can enable multiple channels simultaneously:

```yaml
channels:
  telegram:
    enabled: true
    botToken: "..."
  discord:
    enabled: true
    botToken: "..."
```

Messages from all channels flow through the same agent, sharing:
- Product knowledge
- Campaign state
- Conversation context (per user/channel)
- Team members & permissions

## Team Identification

Team members can be identified across channels:

```typescript
interface TeamMember {
  telegramId?: number;    // Telegram user ID
  discordId?: string;     // Discord user ID
  slackId?: string;       // Slack user ID
  email?: string;         // Email address
  // ...
}
```

When a message arrives, MarketClaw looks up the user by their channel-specific ID and applies their permissions. See [Team Management](./TEAM.md).

## Environment Variables

Sensitive tokens can be set via environment variables:

| Variable | Channel |
|----------|---------|
| `TELEGRAM_BOT_TOKEN` | Telegram |
| `DISCORD_BOT_TOKEN` | Discord |
| `SLACK_BOT_TOKEN` | Slack |
| `SLACK_APP_TOKEN` | Slack |

These override config file values when set.
