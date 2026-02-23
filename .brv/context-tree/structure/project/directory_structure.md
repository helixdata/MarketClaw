## Raw Concept
**Task:**
Map the source code directory structure

**Files:**
- src/

**Timestamp:** 2026-02-23

## Narrative
### Structure
src/index.ts: Agent startup
src/cli.ts: CLI commands
src/setup.ts: Interactive setup wizard
src/providers/: AI providers (swappable)
src/channels/: Chat interfaces (modular)
src/agents/: Sub-agent system
src/team/: Multi-user management
src/approvals/: Content approval workflow
src/tools/: Agent capabilities
src/memory/: Persistent state
src/knowledge/: RAG/embeddings
src/scheduler/: Cron jobs

### Features
Logical grouping of concerns: providers for AI, channels for UI/UX, tools for action execution.
