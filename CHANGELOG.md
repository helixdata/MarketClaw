# Changelog

All notable changes to MarketClaw will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-02-25

### Added
- **Discord Tools** - 8 new tools for Discord automation:
  - `discord_list_channels` - List servers and channels
  - `discord_post` - Post messages with embed support
  - `discord_read_channel` - Read recent messages
  - `discord_react` - Add emoji reactions
  - `discord_server_info` - Get server information
  - `discord_create_channel` - Create text/voice/announcement channels
  - `discord_delete_channel` - Delete channels
  - `discord_edit_channel` - Edit channel settings (name, topic, slowmode)
- Discord bot presence (shows as "online" with activity status)
- Twitter image upload support via clipboard/drop/file-input

### Changed
- **Channel Configuration** - Standardized all channels under `channels:` key in config
  - Old top-level `telegram:` config still works (backwards compatible)
  - Setup wizard now writes to new `channels.telegram` structure
  - CLI status reads from new config structure
- Updated all documentation with new config format

### Fixed
- Twitter Draft.js editor compatibility (proper text insertion, newlines, no duplicates)
- Twitter paste method uses clipboard instead of keyboard simulation

## [0.1.1] - 2026-02-24

### Added
- npm publishing support (`npm install -g marketclaw`)
- Auto-publish GitHub Action on release
- CHANGELOG.md for version tracking

### Changed
- `marketclaw update` now supports both npm and git installations

### Fixed
- Telegram typing indicator now stays active during long AI responses
- Images display inline in Telegram (sendPhoto) instead of as documents
- Product library images now auto-attach when shown
- Browser extension keepalive prevents MV3 service worker sleep
- Extension bridge fails gracefully when port is in use

## [0.1.0] - 2026-02-22

### Added
- Initial public release
- Multi-provider AI support (Anthropic Claude, OpenAI)
- Telegram channel with inline buttons
- Discord and Slack channels
- Product knowledge base with vector search
- Image library management
- Browser automation extension (Chrome MV3)
- Sub-agent system (Strategist, Writer, Designer, Analyst, Researcher, Scheduler, Radar)
- Campaign management
- Scheduled tasks and cron jobs
- Team permissions system
- Approval workflows
- Self-update command (`marketclaw update`)

### Browser Extension
- Chrome extension for social media automation
- Supports Twitter/X, LinkedIn, Reddit, Instagram, Hacker News, Product Hunt, Facebook, Threads, Bluesky, YouTube
- Service worker keepalive for MV3 reliability
