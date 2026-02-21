# Contributing to MarketClaw

Thanks for your interest in contributing! 🦀

## Quick Start

1. Fork the repo
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/MarketClaw.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b my-feature`
5. Make your changes
6. Run tests: `npm test`
7. Push and open a PR

## Development Setup

```bash
# Install dependencies
npm install

# Run in development mode (with hot reload)
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Project Structure

```
src/
├── agents/       # Sub-agent system (specialists)
├── approvals/    # Content approval workflow
├── channels/     # Telegram, Discord, Slack, CLI
├── config/       # Configuration loading
├── knowledge/    # RAG / document search
├── memory/       # Persistent memory system
├── providers/    # LLM providers (Anthropic, OpenAI)
├── scheduler/    # Cron-style job scheduling
├── team/         # Team management & permissions
├── tools/        # All agent tools
└── index.ts      # Main entry point
```

## Pull Request Guidelines

- **One feature per PR** — keeps reviews focused
- **Write tests** — aim for coverage on new code
- **Update docs** — if you change behavior, update relevant docs
- **Follow existing style** — we use ESLint, run `npm run lint`
- **Descriptive commits** — use conventional commits if possible (`feat:`, `fix:`, `docs:`)

## First Time Contributors

Look for issues labeled [`good first issue`](https://github.com/helixdata/MarketClaw/labels/good%20first%20issue) — these are great starting points!

## Reporting Bugs

Open an issue with:
- What you expected
- What actually happened
- Steps to reproduce
- Your environment (OS, Node version, etc.)

## Feature Requests

Open a Discussion in the **Ideas** category first — let's talk about it before you build!

## Questions?

- Open a Discussion in **Q&A**
- Check existing issues/discussions first

---

Thanks for helping make MarketClaw better! 🦞
