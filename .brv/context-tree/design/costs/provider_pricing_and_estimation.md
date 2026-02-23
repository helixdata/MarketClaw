## Raw Concept
**Task:**
Document known provider pricing models used for cost estimation

**Files:**
- src/costs/types.ts

**Timestamp:** 2026-02-23

## Narrative
### Structure
The system maintains a `PROVIDER_PRICING` constant (src/costs/types.ts) with approximate rates for common AI services.

### Features
Pricing for LLMs (per 1M tokens), Image generation (per image), Email (per email), and TTS (per 1000 characters).

### Rules
Pricing Table (Sample Rates):
| Provider | Model/Type | Rate Unit | Input Rate | Output Rate |
| :--- | :--- | :--- | :--- | :--- |
| Anthropic | claude-3-opus | 1M tokens | $15.00 | $75.00 |
| Anthropic | claude-3-sonnet | 1M tokens | $3.00 | $15.00 |
| OpenAI | gpt-4o | 1M tokens | $2.50 | $10.00 |
| OpenAI | gpt-4o-mini | 1M tokens | $0.15 | $0.60 |
| OpenAI-Image | dall-e-3-1024 | image | $0.04 | N/A |
| Resend | email | email | $0.001 | N/A |
