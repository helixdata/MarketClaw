## Raw Concept
**Task:**
Document the local Ollama provider implementation

**Files:**
- src/providers/ollama.ts

**Timestamp:** 2026-02-23

## Narrative
### Structure
Communicates with a local Ollama instance via its REST API (default: `http://localhost:11434`).

### Features
Local inference, OpenAI-compatible message format support, and tool use for supported local models.

### Rules
1. Checks connection to `/api/tags` during initialization.
2. Uses the `/api/chat` endpoint for completions.
3. Supports OpenAI-style tool definitions and tool calls.

### Examples
Completion Request Format:
```typescript
const body = {
  model: "llama3.1",
  messages: [...],
  stream: false,
  options: { num_predict: 4096 }
};
```
