## Raw Concept
**Task:**
Document core agent capabilities and tools

**Files:**
- src/tools/scheduler-tools.ts
- src/tools/knowledge-tools.ts
- src/tools/twitter-tools.ts

**Timestamp:** 2026-02-23

## Narrative
### Structure
Tools are located in src/tools/ and provide specific capabilities to the agent.

### Features
Scheduling (reminders, post later), Knowledge base (semantic search), Brand Identity (voice/colors), Image Library (storage/search), Document Reading (PDF/Docx), Web Research, Email, Social, Vision Support, and Cost Tracking.

### Rules
1. Brand guidelines are automatically used for content creation.
2. Vision support works across Telegram, Discord, and Slack.
3. Costs are tracked per-tool, per-agent, and per-product.
