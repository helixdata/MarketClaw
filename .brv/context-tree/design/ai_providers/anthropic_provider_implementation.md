## Raw Concept
**Task:**
Document the Anthropic (Claude) provider implementation

**Files:**
- src/providers/anthropic.ts

**Timestamp:** 2026-02-23

## Narrative
### Structure
Implements the `Provider` interface using the `@anthropic-ai/sdk`. Supports both standard API keys and Claude Code CLI OAuth tokens.

### Features
Tool use support (input_schema), image support (base64), and cache token tracking (cache_read_input_tokens, cache_creation_input_tokens).

### Rules
1. Priority for authentication: OAuth token > API key > env var.
2. OAuth tokens (starting with `sk-ant-oat`) require `apiKey: null` and `authToken` in the SDK config.
3. Tool results are passed back as `user` messages with `type: "tool_result"`.

### Examples
OAuth Initialization Logic:
```typescript
if (isOAuthToken) {
  this.client = new Anthropic({
    apiKey: null as any,
    authToken: token,
    defaultHeaders: {
      'anthropic-beta': 'claude-code-20250219,oauth-2025-04-20',
      'user-agent': 'claude-cli/2.1.44 (external, cli)',
    },
  });
}
```
