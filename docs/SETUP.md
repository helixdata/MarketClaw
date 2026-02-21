# MarketClaw Setup Guide

Complete guide to getting MarketClaw running in under 5 minutes.

## Prerequisites

- **Node.js 20+** — [Download](https://nodejs.org)
- **A Telegram Bot** — Create via [@BotFather](https://t.me/botfather)
- **An AI Provider API key** — See [Providers](./PROVIDERS.md) for options

## Quick Start

```bash
# Clone the repository
git clone https://github.com/marketclaw/marketclaw.git
cd marketclaw

# Install dependencies
npm install

# Run setup wizard
npx tsx src/cli.ts setup

# Start the agent
npx tsx src/cli.ts start
```

## Interactive Setup

The setup wizard (`npx tsx src/cli.ts setup`) guides you through configuration:

### 1. Telegram Bot

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow the prompts
3. Copy the bot token (looks like `123456789:ABCdefGHI...`)
4. Paste when prompted

**Optional: Restrict access**
- Add your Telegram user ID to limit who can use the bot
- Find your ID via [@userinfobot](https://t.me/userinfobot)

### 2. AI Provider

Choose one:

| Provider | Best For | Cost |
|----------|----------|------|
| **Anthropic** | Reasoning, tool use | Pay per token |
| **OpenAI** | General purpose | Pay per token |
| **Groq** | Fast responses | Free tier available |
| **Gemini** | Multimodal | Free tier available |
| **Ollama** | Privacy, local | Free (local) |
| **OpenRouter** | Multiple providers | Pay per token |

See [PROVIDERS.md](./PROVIDERS.md) for detailed provider setup.

### 3. Marketing Integrations (Optional)

Add these later via `marketclaw config` or environment variables:

- **Twitter/X** — For posting tweets
- **LinkedIn** — For professional content
- **Product Hunt** — For launches
- **Resend** — For email outreach

## Environment Variables

Instead of the setup wizard, you can use environment variables:

```bash
# Required
export TELEGRAM_BOT_TOKEN="your-telegram-bot-token"

# AI Provider (pick one)
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export GROQ_API_KEY="gsk_..."
export GOOGLE_API_KEY="AIza..."
export OPENROUTER_API_KEY="sk-or-..."

# Optional: Marketing channels
export TWITTER_COOKIES="..."
export LINKEDIN_ACCESS_TOKEN="..."
export RESEND_API_KEY="re_..."
```

## Configuration File

Config is stored at `~/.marketclaw/config.yaml`:

```yaml
telegram:
  botToken: "your-token"
  allowedUsers: [123456789]  # Optional: restrict access
  adminUsers: [123456789]    # Optional: who can schedule

providers:
  default: anthropic
  anthropic:
    model: claude-sonnet-4-5-20250514
  openai:
    model: gpt-4o

agent:
  name: MarketClaw
  systemPrompt: |
    You are a marketing assistant...
```

## Verify Installation

```bash
# Check status
npx tsx src/cli.ts status

# Should show:
# Provider: anthropic
# Auth profiles: 1
# Products: 0
# Telegram: configured
```

## Next Steps

1. **Add a product**: `marketclaw products add "My Product" --tagline "Cool thing"`
2. **Initialize knowledge**: `marketclaw kb init my-product`
3. **Chat with your bot**: Open Telegram and say hello!

## Troubleshooting

### "No Telegram bot token configured"
- Check `~/.marketclaw/config.yaml` has your token
- Or set `TELEGRAM_BOT_TOKEN` environment variable

### "No API key or auth token provided"
- Run `marketclaw setup` again
- Or set the appropriate `*_API_KEY` environment variable

### Bot doesn't respond
- Check `marketclaw status` shows everything configured
- Make sure the bot is running (`marketclaw start`)
- Check the terminal for error messages

### "Provider not found: X"
- Run `npm install` to ensure all dependencies are installed
- Check you're using a supported provider name

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/marketclaw/marketclaw/issues)
- **Discussions**: [GitHub Discussions](https://github.com/marketclaw/marketclaw/discussions)
