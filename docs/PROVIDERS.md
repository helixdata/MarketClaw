# LLM Providers

MarketClaw supports multiple AI providers. Choose based on your needs:

## Quick Comparison

| Provider | Speed | Tool Use | Cost | Best For |
|----------|-------|----------|------|----------|
| **Anthropic** | Medium | Excellent | $$ | Complex tasks, reasoning |
| **OpenAI** | Fast | Good | $$ | General purpose |
| **Groq** | ⚡ Fast | Good | $ | Quick responses |
| **Gemini** | Medium | Good | Free tier | Multimodal, budget |
| **Ollama** | Varies | Limited | Free | Privacy, local |
| **OpenRouter** | Varies | Varies | $$ | Access to all models |

---

## Anthropic (Claude)

The default provider. Excellent at reasoning and tool use.

### Setup

1. Get an API key at [console.anthropic.com](https://console.anthropic.com/settings/keys)
2. Set the environment variable:
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-..."
   ```

### Models

- `claude-opus-4-5` — Most capable
- `claude-sonnet-4-5-20250514` — Best balance (recommended)
- `claude-haiku-3-5` — Fastest, cheapest

### Config

```yaml
providers:
  default: anthropic
  anthropic:
    model: claude-sonnet-4-5-20250514
```

### Claude Code CLI Auth (Alternative)

If you have a Claude subscription via Claude Code CLI:

```bash
# Generate a setup token
claude setup-token

# Import into MarketClaw
marketclaw auth setup-token
```

---

## OpenAI (GPT)

Well-rounded provider with fast responses.

### Setup

1. Get an API key at [platform.openai.com](https://platform.openai.com/api-keys)
2. Set the environment variable:
   ```bash
   export OPENAI_API_KEY="sk-..."
   ```

### Models

- `gpt-4o` — Most capable (recommended)
- `gpt-4o-mini` — Faster, cheaper
- `o1-preview` — Advanced reasoning
- `o1-mini` — Faster reasoning

### Config

```yaml
providers:
  default: openai
  openai:
    model: gpt-4o
```

---

## Groq

Ultra-fast inference using custom LPU hardware. Great for responsive interactions.

### Setup

1. Get an API key at [console.groq.com](https://console.groq.com/keys)
2. Set the environment variable:
   ```bash
   export GROQ_API_KEY="gsk_..."
   ```

### Models

- `llama-3.1-70b-versatile` — Best balance (recommended)
- `llama-3.1-8b-instant` — Ultra fast
- `mixtral-8x7b-32768` — Long context
- `gemma2-9b-it` — Compact

### Config

```yaml
providers:
  default: groq
  groq:
    model: llama-3.1-70b-versatile
```

---

## Google Gemini

Google's multimodal models with a generous free tier.

### Setup

1. Get an API key at [aistudio.google.com](https://aistudio.google.com/apikey)
2. Set the environment variable:
   ```bash
   export GOOGLE_API_KEY="AIza..."
   # or
   export GEMINI_API_KEY="AIza..."
   ```

### Models

- `gemini-1.5-pro` — Most capable (recommended)
- `gemini-1.5-flash` — Faster
- `gemini-1.5-flash-8b` — Fastest
- `gemini-2.0-flash-exp` — Latest experimental

### Config

```yaml
providers:
  default: gemini
  gemini:
    model: gemini-1.5-pro
```

---

## Ollama (Local)

Run models locally for privacy and no API costs.

### Setup

1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Pull a model:
   ```bash
   ollama pull llama3.1
   ```
3. Start Ollama (it runs as a service)

### Models

Any model from the [Ollama library](https://ollama.ai/library):
- `llama3.1` — Latest Llama (recommended)
- `llama3.1:70b` — Larger, more capable
- `mixtral` — Good at code
- `codellama` — Code-focused

### Config

```yaml
providers:
  default: ollama
  ollama:
    model: llama3.1
    baseUrl: http://localhost:11434  # Optional: custom host
```

### Tool Use Note

Tool support varies by model. Llama 3.1+ has good tool support; older models may not work well with tools.

---

## OpenRouter

Access multiple providers through one API. Pay-as-you-go with model flexibility.

### Setup

1. Get an API key at [openrouter.ai](https://openrouter.ai/keys)
2. Set the environment variable:
   ```bash
   export OPENROUTER_API_KEY="sk-or-..."
   ```

### Models

Use `provider/model` format:
- `anthropic/claude-3.5-sonnet` — Claude via OpenRouter
- `openai/gpt-4o` — GPT-4 via OpenRouter
- `google/gemini-pro-1.5` — Gemini via OpenRouter
- `meta-llama/llama-3.1-405b-instruct` — Open models

### Config

```yaml
providers:
  default: openrouter
  openrouter:
    model: anthropic/claude-3.5-sonnet
```

### Benefits

- Switch models without changing API keys
- Access models not directly available
- Unified billing

---

## Using Multiple Providers

You can configure multiple providers and switch between them:

```yaml
providers:
  default: anthropic
  anthropic:
    model: claude-sonnet-4-5-20250514
  openai:
    model: gpt-4o
  groq:
    model: llama-3.1-70b-versatile
```

Switch providers at runtime:
```typescript
import { providers } from './providers/index.js';

await providers.initProvider('anthropic', { apiKey: '...' });
await providers.initProvider('groq', { apiKey: '...' });

// Use Anthropic
providers.setActive('anthropic');

// Switch to Groq for speed
providers.setActive('groq');
```

---

## Adding a Custom Provider

Implement the `Provider` interface:

```typescript
import { Provider, ProviderConfig, CompletionRequest, CompletionResponse } from './types.js';

export class MyProvider implements Provider {
  name = 'myprovider';
  
  async init(config: ProviderConfig): Promise<void> {
    // Initialize with API keys, etc.
  }
  
  isReady(): boolean {
    return true; // Ready to use?
  }
  
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Make API call and return response
  }
  
  async listModels(): Promise<string[]> {
    return ['model-a', 'model-b'];
  }
  
  currentModel(): string {
    return 'model-a';
  }
}
```

Then register it:

```typescript
import { providers } from './providers/index.js';
import { MyProvider } from './providers/myprovider.js';

providers.registerProviderType('myprovider', () => new MyProvider());
```
