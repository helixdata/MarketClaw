## Raw Concept
**Task:**
Document the expanded MarketClaw platform and its core features

**Files:**
- README.md
- src/index.ts
- extension/manifest.json

**Flow:**
User Chat -> Channel Router -> Agent Core -> Providers/Tools/Sub-Agents/Browser Automation -> Result

**Timestamp:** 2026-02-23

## Narrative
### Structure
MarketClaw is an AI-powered marketing automation platform that lives in chat (Telegram, Discord, Slack). It features a modular architecture with swappable AI providers, persistent memory, specialized sub-agents, and a comprehensive browser automation system via a Chrome extension.

### Dependencies
Node.js >=20, TypeScript 5.0, Chrome Extension Manifest V3, WebSockets.

### Features
Multi-provider AI (6 providers), persistent memory for products/campaigns, built-in marketing tools, sub-agent delegation, brand identity management, web research, vision support, and browser automation for 10 platforms.

### Rules
1. Lives in your chat (Telegram, Discord, Slack, CLI).
2. Remembers products, campaigns, and brand voice.
3. Automates tasks like inbox monitoring and social posting.
4. Supports multi-account browser profiles (Work, Personal, Client1).
