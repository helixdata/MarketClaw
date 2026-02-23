# Changelog

All notable changes to MarketClaw will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
