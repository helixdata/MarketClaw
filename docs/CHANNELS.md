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
| Discord | ✅ Ready | Full-featured Discord bot with server/channel/role restrictions |
| Slack | ✅ Ready | Full-featured Slack bot via Socket Mode |
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

## Discord Setup

1. **Create a Discord Application:**
   - Go to https://discord.com/developers/applications
   - Click "New Application" and give it a name
   - Go to "Bot" section → "Add Bot" → "Yes, do it!"
   - Copy the bot token (click "Reset Token" if needed)

2. **Enable Required Intents:**
   - In Bot settings, enable:
     - ✅ **Message Content Intent** (required to read messages)
     - ✅ Server Members Intent (optional, for role checks)

3. **Invite the Bot to Your Server:**
   - Go to "OAuth2" → "URL Generator"
   - Select scopes: `bot`
   - Select permissions: `Send Messages`, `Read Message History`, `View Channels`
   - Copy the generated URL and open it to invite the bot

4. **Configure MarketClaw:**
   ```yaml
   # ~/.marketclaw/config.yaml
   discord:
     botToken: "your-bot-token-here"
     # Optional restrictions:
     guildIds: ["123456789"]      # Limit to specific servers
     channelIds: ["987654321"]    # Limit to specific channels
     allowedRoles: ["Admin"]      # Limit to users with these roles
     commandPrefix: "!"           # Optional: respond to "!help"
   ```

5. **Start MarketClaw** — the Discord bot will connect automatically!

### Discord Features

- Responds to @mentions in servers
- Responds to all DMs
- Optional command prefix (e.g., `!ask what should I tweet?`)
- Supports image attachments
- Supports document attachments (PDF, DOCX, etc.)
- Server/channel/role restrictions

### Getting IDs

Right-click on servers/channels/roles in Discord with Developer Mode enabled:
- Enable Developer Mode: User Settings → Advanced → Developer Mode
- Right-click → "Copy ID"

## Slack Setup

1. **Create a Slack App:**
   - Go to https://api.slack.com/apps
   - Click "Create New App" → "From scratch"
   - Give it a name and select your workspace

2. **Enable Socket Mode:**
   - Go to "Socket Mode" in the sidebar
   - Toggle it ON
   - Create an App-Level Token with `connections:write` scope
   - Copy the token (starts with `xapp-`)

3. **Add Bot Token Scopes:**
   - Go to "OAuth & Permissions"
   - Under "Bot Token Scopes", add:
     - `chat:write` (send messages)
     - `app_mentions:read` (respond to @mentions)
     - `im:history` (read DMs)
     - `im:read` (access DM channels)
     - `channels:history` (read channel messages, if needed)

4. **Enable Events:**
   - Go to "Event Subscriptions"
   - Toggle ON
   - Subscribe to bot events:
     - `app_mention` (respond to @mentions)
     - `message.im` (respond to DMs)

5. **Install to Workspace:**
   - Go to "Install App"
   - Click "Install to Workspace"
   - Copy the Bot User OAuth Token (starts with `xoxb-`)

6. **Configure MarketClaw:**
   ```yaml
   # ~/.marketclaw/config.yaml
   slack:
     botToken: "xoxb-your-bot-token"
     appToken: "xapp-your-app-token"
     # Optional restrictions:
     allowedChannels: ["C123456"]  # Limit to specific channels
     allowedUsers: ["U123456"]     # Limit to specific users
   ```

7. **Start MarketClaw** — the Slack bot will connect via Socket Mode!

### Slack Features

- Responds to @mentions in channels
- Responds to DMs
- Thread support
- Image attachments
- Document attachments (PDF, DOCX, etc.)
- Channel/user restrictions

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
