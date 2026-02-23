## Raw Concept
**Task:**
Document the specialized sub-agent registry and execution system

**Files:**
- src/agents/registry.ts
- src/agents/types.ts
- src/agents/specialists.ts

**Flow:**
Agent Core -> subAgentRegistry.spawn(agentId, prompt) -> Task Queue -> executeTask -> Provider.complete (with tool loop) -> Task Completion

**Timestamp:** 2026-02-23

## Narrative
### Structure
The Sub-Agent System is managed by a central `subAgentRegistry` (src/agents/registry.ts). It allows for spawning specialized agents that handle domain-specific marketing tasks. Agents are defined by a manifest including identity, specialty, and allowed tools.

### Features
Asynchronous task execution, task queueing, tool-use loops within sub-agents, agent-specific model overrides, and persistent task history (last 50 completed tasks).

### Rules
1. Sub-agents are initialized with a name, emoji, persona, and voice (professional, casual, friendly, playful).
2. Each task has a unique ID and follows a lifecycle: pending -> running -> completed/failed.
3. Sub-agents can be restricted to a specific subset of tools defined in their specialty.
4. The system prompt for a sub-agent is dynamically built from its identity and specialty definitions.

### Examples
Built-in Specialist Agents:
| ID | Name | Emoji | Specialty | Description |
| :--- | :--- | :--- | :--- | :--- |
| `twitter` | Tweety | 🐦 | Twitter/X Specialist | Viral hooks, threads, and engagement |
| `linkedin` | Quinn | 💼 | LinkedIn Specialist | Thought leadership and B2B content |
| `email` | Emma | ✉️ | Email Specialist | Outreach, copywriting, and newsletters |
| `creative` | Pixel | 🎨 | Creative Specialist | Image generation and visual identity |
| `analyst` | Dash | 📊 | Analytics Specialist | Metrics, performance, and data insights |
| `researcher` | Scout | 🔍 | Research Specialist | Market research and competitor intel |
| `producthunt` | Hunter | 🚀 | Product Hunt Specialist | Launch strategy and community engagement |
| `audience` | Radar | 🎯 | Audience Researcher | Audience discovery and community intelligence |
