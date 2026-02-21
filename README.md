<p align="center">
  <img src="assets/logo.png" alt="MarketClaw" width="200">
</p>

<h1 align="center">MarketClaw 🦀</h1>

<p align="center">
  <strong>AI-powered marketing agent that lives in Telegram.</strong>
</p>

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
- **Brand identity** — Colors, voice, taglines, typography per product
- **Image library** — Store, tag, and search product images
- **Document reading** — Extract text from PDF, Word (.docx/.doc), and text files
- **Web search** — Search the web with Brave API, extract content from URLs
- **Email** — Outreach via Resend, monitor inbox
- **Social** — Twitter, LinkedIn, Product Hunt (via skills)
- **Images** — Generate with DALL-E, analyze with vision
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

### 🤖 Sub-Agents

Delegate tasks to specialized AI agents:

| Agent | Name | Specialty |
|-------|------|-----------|
| 🐦 | Tweety | Twitter threads, viral hooks |
| 💼 | Quinn | LinkedIn, B2B content |
| ✉️ | Emma | Email marketing, outreach |
| 🎨 | Pixel | Visual content, images |
| 📊 | Dash | Analytics, metrics |
| 🔍 | Scout | Research, competitor intel |
| 🚀 | Hunter | Product Hunt launches |

```
You: "Ask Tweety to write a thread about building in public"
Bot: 🐦 Tweety completed the task:
     1/ Building in public is scary. Here's why you should do it anyway...
```

### 👥 Team Management

Multi-user support with roles:

- **Admin** — Full access, manage team
- **Manager** — Approve content, post
- **Creator** — Draft content (needs approval)
- **Viewer** — Read-only analytics

```
You: "Add @jane as a creator for ProofPing"
Bot: ✅ Added Jane to the team (creator for ProofPing)
```

### ✅ Approval Workflow

Quality control for team content:

```
Creator: "Request approval for this tweet"
Bot: 📝 Notifying approvers...

Manager: "approve"
Bot: ✅ Approved! Ready to post.
```

### 🎨 Brand Identity

Define your brand for consistent content:

```
You: "Set ProofPing brand colors: primary #FF6B35, accent #00D9C0"
Bot: ✅ Updated brand colors for ProofPing

You: "ProofPing voice is warm and reassuring, never corporate"
Bot: ✅ Updated brand voice for ProofPing

You: "What are ProofPing's brand guidelines?"
Bot: 🎨 ProofPing Brand:
     Colors: primary #FF6B35, accent #00D9C0
     Voice: warm, reassuring friend
     Tagline: "Someone's always got your back"
```

The agent automatically uses brand guidelines when creating content.

### 🔍 Web Search & Research

Search the web and extract content for research:

```
You: "Research AI marketing trends"
Bot: # Research: AI marketing trends

     Found 5 sources:
     1. **The Rise of AI in Marketing** - How brands are using...
     2. **Marketing Automation 2024** - Key trends to watch...

You: "Search for Product Hunt launch tips from this week"
Bot: Found 5 recent results:
     • How to Launch on Product Hunt (2 days ago)
     • Top Tips from #1 Products (5 days ago)
     ...

You: "Fetch the content from https://example.com/article"
Bot: Extracted 3,500 characters from the article...
```

Tools: `web_search`, `web_fetch`, `research_topic`

### 🖼️ Product Image Library

Store and search product images:

```
You: "Add this screenshot to ProofPing" [attaches image]
Bot: ✅ Added "screenshot.png" to ProofPing library

You: "Find ProofPing screenshots showing the dashboard"
Bot: 📸 Found 3 images:
     • App Store Hero (screenshot) - iPhone showing main dashboard
     • Dashboard Dark Mode (screenshot) - Dark theme variant
     • Check-in Flow (screenshot) - Step-by-step check-in

You: "List all ProofPing logos"
Bot: 📸 2 logo images found...
```

Features:
- Semantic search ("find mockups showing check-in")
- Tag and type filtering
- Auto dimension detection
- URL or file upload

### 👁️ Vision Support

Send images and MarketClaw can analyze them:

```
You: [sends competitor's landing page screenshot]
     "What's good about this landing page?"

Bot: Here's my analysis:
     ✅ Clear value proposition above the fold
     ✅ Strong social proof with logos
     ⚠️ CTA could be more prominent
     ...
```

Works across Telegram, Discord, and Slack with Claude, GPT-4o, and Gemini.

### 💰 Cost Tracking

Monitor and control API spending:

```
You: "How much have we spent this week?"
Bot: 💰 Total: $12.45 (156 operations)
     By Tool: generate_image: $8.00, send_email: $2.15
     By Agent: Pixel: $8.00, Emma: $2.15
     By Provider: gemini: $8.00, resend: $2.15

You: "Set a $50 monthly budget"
Bot: ✅ Budget "Monthly Limit" created: $50/monthly (global)
```

Features:
- Per-tool, per-agent, per-product cost attribution
- Daily/weekly/monthly budgets with warn or block actions
- Trend analysis and reporting

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
BRAVE_SEARCH_API_KEY=BSA...
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
  emoji: 🦀
  voice: friendly    # professional, casual, friendly, playful
  persona: your friendly marketing assistant
```

See [docs/SETUP.md](./docs/SETUP.md) for detailed configuration.

---

## Architecture

```
src/
├── index.ts           # Agent startup
├── cli.ts             # CLI commands
├── setup.ts           # Interactive setup wizard
├── providers/         # AI providers (swappable)
│   ├── anthropic.ts
│   ├── openai.ts
│   ├── groq.ts
│   ├── gemini.ts
│   ├── ollama.ts
│   └── openrouter.ts
├── channels/          # Chat interfaces (modular)
│   ├── telegram.ts
│   ├── discord.ts
│   ├── slack.ts
│   └── cli.ts
├── agents/            # Sub-agent system
│   ├── specialists.ts # Built-in specialists
│   ├── registry.ts    # Agent management
│   └── tools.ts       # delegate_task, etc.
├── team/              # Multi-user management
│   ├── manager.ts     # Team CRUD
│   ├── permissions.ts # Tool-level permissions
│   └── tools.ts       # Team management tools
├── approvals/         # Content approval workflow
│   ├── manager.ts     # Approval logic
│   └── tools.ts       # approve, reject, etc.
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

- [Setup Guide](./docs/SETUP.md) — Detailed installation & configuration
- [Channels](./docs/CHANNELS.md) — Telegram, Discord, Slack, CLI
- [Providers](./docs/PROVIDERS.md) — Configure AI providers
- [Brand Identity](./docs/BRAND.md) — Colors, voice, taglines, typography
- [Image Library](./docs/IMAGE-LIBRARY.md) — Store & search product images
- [Web Search](./docs/WEB-SEARCH.md) — Search the web & extract content
- [Sub-Agents](./docs/SUB-AGENTS.md) — Specialist agents & delegation
- [Team](./docs/TEAM.md) — Multi-user roles & permissions
- [Approvals](./docs/APPROVALS.md) — Content approval workflow
- [Costs](./docs/COSTS.md) — Cost tracking & budgets
- [Daemon](./docs/DAEMON.md) — Running as a background service
- [Tools](./docs/TOOLS.md) — Available tools & how to add more
- [Skills](./docs/SKILLS.md) — Plugin system
- [API Reference](./docs/API.md) — Complete tool reference
- [Architecture](./docs/ARCHITECTURE.md) — System design overview
- [FAQ](./docs/FAQ.md) — Common questions
- [Contributing](./docs/CONTRIBUTING.md) — How to contribute

---

## Roadmap

- [x] Multi-provider AI
- [x] Telegram interface
- [x] Persistent memory
- [x] Tool system
- [x] Scheduling
- [x] Knowledge base
- [x] Sub-agents system
- [x] Team management
- [x] Approval workflow
- [x] Modular channels (Telegram, Discord, Slack)
- [x] Cost tracking & budgets
- [x] Brand identity management
- [x] Product image library
- [x] Vision/image support
- [x] Web search & research tools
- [ ] Google Calendar integration
- [ ] Notion integration
- [ ] Google Ads integration
- [ ] Content templates
- [ ] Audience personas
- [ ] Competitor monitoring
- [ ] Skills/Marketplace
- [ ] Microsoft Teams channel
- [ ] Analytics dashboard
- [ ] Web dashboard

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
