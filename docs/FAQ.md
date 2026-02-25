# Frequently Asked Questions

## General

### What is MarketClaw?

MarketClaw is an AI-powered marketing assistant that lives in your chat (Telegram, Discord, Slack, or CLI). It helps indie hackers and small teams automate marketing tasks like social media, email, and content creation.

### Is it free?

MarketClaw itself is free and open source (MIT license). However, you'll need API keys for:
- An AI provider (Anthropic, OpenAI, etc.) — costs vary by usage
- Optional integrations (Resend for email, etc.)

### What AI providers are supported?

- **Anthropic** (Claude) — Recommended, best tool use
- **OpenAI** (GPT-4o, etc.)
- **Groq** — Fast inference
- **Google Gemini**
- **Ollama** — Local models, free
- **OpenRouter** — Access to many models

### Can I run it locally without API costs?

Yes! Use Ollama with a local model like Llama 3. Quality will vary but it's completely free.

---

## Setup

### How do I get started?

```bash
git clone https://github.com/marketclaw/marketclaw.git
cd marketclaw
npm install
npx tsx src/cli.ts setup
npx tsx src/cli.ts start
```

The setup wizard will guide you through configuration.

### How do I create a Telegram bot?

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot`
3. Follow the prompts to name your bot
4. Copy the token BotFather gives you
5. Add it to your config or `TELEGRAM_BOT_TOKEN` env var

### How do I restrict who can use my bot?

In `~/.marketclaw/config.yaml`:

```yaml
channels:
  telegram:
    enabled: true
    botToken: your-token
    allowedUsers: [123456789, 987654321]  # Telegram user IDs
    adminUsers: [123456789]  # Full admin access
```

Find your user ID by messaging [@userinfobot](https://t.me/userinfobot).

### Why isn't my bot responding?

1. **Check if it's running**: `ps aux | grep marketclaw`
2. **Check logs**: `tail -f /tmp/marketclaw.log`
3. **Verify bot token**: Make sure it's correct in config
4. **Check allowedUsers**: Your ID must be in the list
5. **Only one instance**: Telegram only allows one connection per bot token

---

## Features

### What's a sub-agent?

Sub-agents are AI specialists with specific expertise:
- 🐦 **Tweety** — Twitter content
- 💼 **Quinn** — LinkedIn posts
- ✉️ **Emma** — Email marketing
- 🎨 **Pixel** — Visual content
- 📊 **Dash** — Analytics
- 🔍 **Scout** — Research
- 🚀 **Hunter** — Product Hunt

Delegate tasks to them: "Ask Tweety to write a thread about building in public"

### Can each sub-agent use a different AI model?

Yes! Use `set_agent_model`:

```
set_agent_model agentId=twitter model=gpt-4o-mini
```

This lets you use cheaper/faster models for simpler tasks.

### How does the knowledge base work?

MarketClaw can store and search product information:

```
Store: "Our pricing is $9/month for Basic, $29/month for Pro"
Query: "What's our pricing?"
```

It uses embeddings for semantic search, so it understands meaning, not just keywords.

### How do budgets work?

Set spending limits to control costs:

```
set_budget name="Daily Limit" scope=global period=daily limitUsd=10 action=block
```

When exceeded, tools that cost money will be blocked until the period resets.

### What's the approval workflow?

For teams, creators can submit content that requires manager/admin approval before posting:

1. Creator: "Request approval for this tweet: ..."
2. Manager gets notified
3. Manager approves or rejects
4. If approved, content can be posted

---

## Troubleshooting

### How do I debug issues?

Use the built-in logging system:

**Enable debug mode in chat:**
```
/debug on    # Enable verbose logging for this session
/debug off   # Disable debug logging
/debug       # Toggle debug mode
```

**View recent logs:**
```bash
marketclaw logs tail        # Last 50 log entries
marketclaw logs tail -n 100 # Last 100 entries
```

**Search for errors:**
```bash
marketclaw logs search "error"
marketclaw logs search "" -l error    # Filter by level
marketclaw logs search "" -c browser  # Filter by component
```

**Trace a request:**
Every session gets a correlation ID. Find it in the logs and search:
```bash
marketclaw logs search "a1b2c3d4"  # Find all logs for that session
```

Log files are stored in `~/.marketclaw/logs/` as JSON lines.

See [LOGGING.md](./LOGGING.md) for full documentation.

### "Tool not found" error

The tool might not be registered or might be disabled. Check:
1. Is the required integration configured? (e.g., Twitter needs cookies)
2. Run `list_tools` to see available tools

### "Budget exceeded" error

You've hit a spending limit. Options:
1. Wait for the budget period to reset
2. Increase the budget limit
3. Delete the budget

Check budgets: `list_budgets`

### AI responses are slow

1. **Model choice**: Larger models are slower. Try `gpt-4o-mini` or `claude-3-haiku`
2. **Provider**: Groq is very fast
3. **Tool calls**: Complex tasks with many tool calls take longer

### Memory/context seems limited

Each conversation has a context window limit. For long sessions:
1. Start a new conversation for fresh context
2. Use the knowledge base for persistent information
3. Keep individual messages concise

### Twitter/LinkedIn isn't working

These require authentication:
- **Twitter**: Set `TWITTER_COOKIES` (use bird CLI to get cookies)
- **LinkedIn**: Set up OAuth token via LaunchCrew or env vars

Check auth: `check_twitter_auth` or `check_linkedin_auth`

---

## Development

### How do I add a new tool?

1. Create a file in `src/tools/` or as a skill
2. Implement the `Tool` interface
3. Register it in `src/tools/index.ts`

See [TOOLS.md](./TOOLS.md) for details.

### How do I create a skill (plugin)?

1. Create a folder with `manifest.json` and your tool code
2. Place in `~/.marketclaw/skills/` or publish to the marketplace

See [SKILLS.md](./SKILLS.md) for details.

### How do I run tests?

```bash
npm test                    # Run all tests
npm test -- --coverage      # With coverage report
npm test -- path/to/test    # Specific test file
```

### How do I contribute?

1. Fork the repo
2. Create a feature branch
3. Make changes with tests
4. Submit a PR

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

## Deployment

### How do I run it in production?

See [DAEMON.md](./DAEMON.md) for options:
- **macOS**: launchd
- **Linux**: systemd
- **Cross-platform**: PM2
- **Containers**: Docker

### Can I run multiple instances?

Each Telegram bot token can only have one active connection. For multiple bots:
- Use different bot tokens
- Run separate instances with different configs

### How do I update?

```bash
git pull
npm install
# Restart your daemon
```

---

## Privacy & Security

### Is my data sent anywhere?

- **AI Provider**: Conversations are sent to your configured AI provider
- **No telemetry**: MarketClaw doesn't phone home
- **Local storage**: All data stays in `~/.marketclaw/`

### Are my API keys safe?

- Store keys in environment variables or `.env` files
- Never commit keys to version control
- Use the minimum required permissions

### How do I report a security issue?

Email **brett@oneway.co.nz** — do not open public issues for security vulnerabilities.

See [SECURITY.md](../SECURITY.md) for details.
