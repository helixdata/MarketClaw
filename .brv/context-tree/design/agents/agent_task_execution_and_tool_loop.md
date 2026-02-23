## Raw Concept
**Task:**
Document the internal execution logic for sub-agent tasks

**Files:**
- src/agents/registry.ts

**Flow:**
executeTask -> Build System Prompt -> Filter Tools -> Provider Loop -> Handle Tool Calls -> Final Response

**Timestamp:** 2026-02-23

## Narrative
### Structure
The `executeTask` method in `SubAgentRegistry` handles the interaction between a sub-agent and the active AI provider.

### Features
Automatic system prompt generation, tool-call handling, iteration limits, and timeout enforcement.

### Rules
1. Max tool iterations per task defaults to 10.
2. Task timeout defaults to 120 seconds.
3. The registry emits `task:start`, `task:complete`, and `task:error` events for monitoring.
4. Tool results are fed back into the conversation history for the sub-agent to reach a final answer.

### Examples
Agent Voice Styles:
- `professional`: Formal and polished language.
- `casual`: Relaxed and conversational language.
- `friendly`: Warm and approachable (default).
- `playful`: Fun, energetic, and humorous.
