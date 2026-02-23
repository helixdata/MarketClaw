## Raw Concept
**Task:**
Document installation and configuration procedures

**Files:**
- docs/SETUP.md

**Timestamp:** 2026-02-23

## Narrative
### Structure
MarketClaw requires Node.js 20+ and can be configured via an interactive CLI wizard, YAML config file, or environment variables.

### Features
Interactive setup wizard, multi-provider AI support, and marketing channel integrations.

### Rules
Setup Steps:
1. Clone repo and run `npm install`.
2. Run `npx tsx src/cli.ts setup` for interactive configuration.
3. Provide Telegram Bot Token (via @BotFather).
4. Choose AI Provider and provide API Key.
5. Start agent with `npx tsx src/cli.ts start`.
