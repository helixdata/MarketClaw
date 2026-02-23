## Raw Concept
**Task:**
Document the testing strategy and coverage requirements

**Files:**
- vitest.config.ts
- package.json

**Timestamp:** 2026-02-23

## Narrative
### Structure
MarketClaw uses Vitest for unit and integration testing. Test files are colocated with source code using the `*.test.ts` naming convention.

### Dependencies
Vitest, @vitest/coverage-v8

### Features
Automated test execution via `npm test`, watch mode with `npm run test:watch`, and coverage reporting with `npm run test:coverage`. Currently has over 2000 passing tests.

### Rules
Coverage Thresholds (v8 provider):
- Statements: 85%
- Branches: 84%
- Functions: 85%
- Lines: 85%

Exclusions from Coverage:
- CLI/Entry points (src/cli.ts, src/index.ts, src/setup.ts, src/daemon.ts)
- Channel implementations (Telegram, Discord, Slack, CLI)
- AI Provider implementations (Anthropic, OpenAI, etc.)
- OAuth implementations (Google Calendar)
