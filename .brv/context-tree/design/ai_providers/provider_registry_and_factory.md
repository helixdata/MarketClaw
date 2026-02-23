## Raw Concept
**Task:**
Document the central provider registry and factory system

**Files:**
- src/providers/index.ts
- src/providers/types.ts

**Flow:**
Config -> ProviderRegistry.initProvider(name, config) -> Factory creates Provider -> provider.init(config) -> Registry stores provider

**Timestamp:** 2026-02-23

## Narrative
### Structure
The `ProviderRegistry` (src/providers/index.ts) manages the lifecycle of AI providers. It uses factory functions to instantiate specific provider classes like `AnthropicProvider` or `OpenAIProvider`.

### Features
Support for multiple initialized providers, active provider switching, and provider metadata for setup wizards.

### Rules
1. Providers must implement the `Provider` interface.
2. The first provider initialized becomes the `activeProvider` by default.
3. Provider metadata (env vars, default models) is stored in `PROVIDER_INFO`.

### Examples
Provider Metadata Table:
| Provider | Display Name | Env Var | Default Model | Requires API Key |
| :--- | :--- | :--- | :--- | :--- |
| anthropic | Anthropic (Claude) | ANTHROPIC_API_KEY | claude-sonnet-4-5-20250514 | Yes |
| openai | OpenAI (GPT) | OPENAI_API_KEY | gpt-4o | Yes |
| groq | Groq | GROQ_API_KEY | llama-3.1-70b-versatile | Yes |
| gemini | Google Gemini | GOOGLE_API_KEY | gemini-1.5-pro | Yes |
| ollama | Ollama (Local) | OLLAMA_HOST | llama3.1 | No |
| openrouter | OpenRouter | OPENROUTER_API_KEY | anthropic/claude-3.5-sonnet | Yes |
