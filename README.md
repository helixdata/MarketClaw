# MarketClaw 🦀

**AI-powered marketing agent that lives in Telegram.**

Build in public, automate your marketing, never forget your campaigns.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)

---

## What is MarketClaw?

MarketClaw is an AI marketing assistant that:

- 🤖 **Lives in Telegram** — Chat naturally about your marketing
- 🧠 **Remembers everything** — Products, campaigns, brand voice
- 📝 **Creates content** — Tweets, LinkedIn posts, Product Hunt launches
- ⏰ **Schedules posts** — Set it and forget it
- 🔌 **Pluggable** — Swap AI providers, add skills, customize tools

Think of it as your marketing co-pilot that's always on, always learning, and never forgets a campaign.

---

## Quick Start

```bash
# Clone
git clone https://github.com/marketclaw/marketclaw.git
cd marketclaw

# Install
npm install

# Setup (interactive, ~3 minutes)
npx tsx src/cli.ts setup

# Start
npx tsx src/cli.ts start
```

That's it. Open Telegram and start chatting with your bot.

---

## Features

### 🔀 Multi-Provider AI

Use any AI provider:

| Provider | Description |
|----------|-------------|
| **Anthropic** | Claude models (default) |
| **OpenAI** | GPT-4o, o1, etc. |
| **Groq** | Ultra-fast inference |
| **Gemini** | Google's models |
| **Ollama** | Local models, privacy |
| **OpenRouter** | Access any model |

### 🛠️ Built-in Tools

- **Scheduling** — Post later, set reminders
- **Knowledge base** — Store product info, search with embeddings
- **Email** — Outreach via Resend, monitor inbox
- **Social** — Twitter, LinkedIn, Product Hunt (via skills)
- **Images** — Generate with DALL-E
- **Leads** — Simple CRM

### 📱 Telegram-First

Your primary interface. Natural conversation, inline buttons, image sharing.

```
You: "Schedule a tweet about our new feature for tomorrow 9am"
Bot: ✅ Scheduled! I'll post "..." tomorrow at 9:00 AM.

You: "What posts are scheduled this week?"
Bot: 📅 3 posts scheduled:
     • Tomorrow 9am - Twitter
     • Wed 2pm - LinkedIn  
     • Fri 10am - Twitter thread
```

### 🧠 Persistent Memory

MarketClaw remembers:
- Your products and their features
- Brand voice and guidelines
- Campaign history
- What works and what doesn't

```
~/.marketclaw/workspace/
├── BRAND.md           # Your brand voice
├── products/          # Product details
├── campaigns/         # Campaign history
└── knowledge/         # Product knowledge base
```

---

## Configuration

### Environment Variables

```bash
# Required
TELEGRAM_BOT_TOKEN=your-token

# AI Provider (pick one)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
GOOGLE_API_KEY=AIza...
OPENROUTER_API_KEY=sk-or-...

# Optional integrations
RESEND_API_KEY=re_...
TWITTER_COOKIES=...
```

### Config File

`~/.marketclaw/config.yaml`:

```yaml
telegram:
  botToken: ${TELEGRAM_BOT_TOKEN}
  allowedUsers: [123456789]

providers:
  default: anthropic
  anthropic:
    model: claude-sonnet-4-5-20250514

agent:
  name: MarketClaw
```

See [docs/SETUP.md](./docs/SETUP.md) for detailed configuration.

---

## Architecture

```
src/
├── index.ts           # Agent startup
├── cli.ts             # CLI commands
├── providers/         # AI providers (swappable)
│   ├── anthropic.ts
│   ├── openai.ts
│   ├── groq.ts
│   ├── gemini.ts
│   ├── ollama.ts
│   └── openrouter.ts
├── channels/          # Chat interfaces
│   └── telegram.ts
├── tools/             # Agent capabilities
│   ├── scheduler-tools.ts
│   ├── knowledge-tools.ts
│   ├── twitter-tools.ts
│   └── ...
├── memory/            # Persistent state
├── knowledge/         # RAG/embeddings
└── scheduler/         # Cron jobs
```

---

## CLI Commands

```bash
# Agent
marketclaw start        # Start the agent
marketclaw setup        # Interactive setup
marketclaw status       # Show status

# Products
marketclaw products list
marketclaw products add "ProductName" --tagline "..."

# Knowledge
marketclaw kb init <product>
marketclaw kb index <product>
marketclaw kb search <product> "query"

# Scheduling
marketclaw cron list
marketclaw cron add -s "every day at 9am" -m "Check metrics"

# Config
marketclaw config
```

---

## Documentation

- [Setup Guide](./docs/SETUP.md) — Detailed installation
- [Providers](./docs/PROVIDERS.md) — Configure AI providers
- [Tools](./docs/TOOLS.md) — Available tools & how to add more
- [Skills](./docs/SKILLS.md) — Plugin system
- [Contributing](./docs/CONTRIBUTING.md) — How to contribute

---

## Roadmap

- [x] Multi-provider AI
- [x] Telegram interface
- [x] Persistent memory
- [x] Tool system
- [x] Scheduling
- [x] Knowledge base
- [ ] Skills/Marketplace
- [ ] Web dashboard
- [ ] Analytics
- [ ] Discord channel
- [ ] Automated posting

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](./docs/CONTRIBUTING.md).

```bash
# Development
npm run dev       # Watch mode
npm run typecheck # Type checking
npm run lint      # Linting
```

---

## Inspiration

- [Clawdbot](https://github.com/clawdbot/clawdbot) — Personal AI agent
- [ZeroClaw](https://github.com/zeroclaw-labs/zeroclaw) — Trait-driven architecture

---

## License

MIT © Brett Waterson

---

<p align="center">
Built with 🦀 for indie hackers who'd rather ship than schedule
</p>
