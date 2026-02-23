## Raw Concept
**Task:**
Document the linting and code style configuration

**Files:**
- eslint.config.js
- package.json

**Timestamp:** 2026-02-23

## Narrative
### Structure
The project uses ESLint 10 with the Flat Config system (`eslint.config.js`). It leverages the standard TypeScript ESLint recommended rules.

### Dependencies
ESLint 10, typescript-eslint, globals

### Features
Automated linting via `npm run lint`. Configured for Node.js 20+ and ES2022.

### Rules
Custom ESLint Rule Overrides:
- `@typescript-eslint/no-explicit-any`: Disabled (off)
- `@typescript-eslint/no-unused-vars`: Warning, ignores variables starting with underscore (_)
- `@typescript-eslint/only-throw-error`: Disabled (off) - allows throwing non-Error objects
- `preserve-caught-error`: Disabled (off)

Ignore Patterns:
- `dist/`, `node_modules/`, `**/*.test.ts`, `coverage/`
