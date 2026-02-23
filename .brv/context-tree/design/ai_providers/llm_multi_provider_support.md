## Raw Concept
**Task:**
Document supported AI providers and their configuration

**Files:**
- src/providers/anthropic.ts
- src/providers/openai.ts
- src/providers/groq.ts
- src/providers/gemini.ts
- src/providers/ollama.ts
- src/providers/openrouter.ts

**Timestamp:** 2026-02-23

## Narrative
### Structure
Providers are located in src/providers/ and are swappable through configuration.

### Features
Supports Anthropic (Claude), OpenAI (GPT-4o), Groq, Gemini, Ollama (local), and OpenRouter.

### Rules
Configured via ~/.marketclaw/config.yaml or environment variables like ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.

### Examples
Table of Providers:
| Provider | Description |
|----------|-------------|
| Anthropic | Claude models (default) |
| OpenAI | GPT-4o, o1, etc. |
| Groq | Ultra-fast inference |
| Gemini | Google's models |
| Ollama | Local models, privacy |
| OpenRouter | Access any model |
