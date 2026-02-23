## Raw Concept
**Task:**
Document optimal AI model recommendations for different agent specialties

**Files:**
- src/agents/tools.ts

**Timestamp:** 2026-02-23

## Narrative
### Structure
The `recommend_agent_model` tool provides a heuristic-based mapping between agent specialties and the most efficient AI models.

### Features
Mapping based on cost, speed, and reasoning requirements of specific marketing tasks.

### Rules
1. Low-complexity tasks (Twitter) favor fast, cheap models (GPT-4o-mini).
2. High-complexity tasks (Research, Audience) favor deep reasoning models (Claude 3 Opus).
3. B2B and professional content (LinkedIn, Email) favor nuanced models (Claude 3.5 Sonnet).

### Examples
Agent Model Recommendation Table:
| Agent ID | Recommended Model | Reason |
| :--- | :--- | :--- |
| `twitter` | `gpt-4o-mini` | Fast and cheap for short-form, high-volume content |
| `linkedin` | `claude-3-5-sonnet` | Nuance and professional tone; Quality > Speed |
| `email` | `claude-3-5-sonnet` | Nuance and reasoning for personalization |
| `creative` | `gemini-2.0-flash` | Best for image prompts and multimodal tasks |
| `analyst` | `claude-3-5-sonnet` | Strong reasoning and pattern recognition |
| `researcher` | `claude-3-opus` | Deep research, synthesis, and strategy |
| `audience` | `claude-3-opus` | Deep analysis and insight extraction |
