## Raw Concept
**Task:**
Document the persistent memory and context building system

**Files:**
- src/memory/index.ts

**Flow:**
Memory.buildContext() -> Load BRAND.md -> Load Active Product -> Load Active Campaign -> Load Products Summary -> Consolidated AI Context

**Timestamp:** 2026-02-23

## Narrative
### Structure
The Memory system (src/memory/index.ts) provides persistent storage for brand identity, products, campaigns, sessions, and runtime state. It is the "brain" of the agent, ensuring consistency across conversations.

### Features
Brand identity storage (BRAND.md), product-specific context (features, audience, messaging), campaign history and metrics, session logging (JSONL), and runtime state management.

### Rules
1. Memory is stored in `~/.marketclaw/workspace/`.
2. `BRAND.md` contains the core voice, positioning, and values.
3. Products are stored as individual JSON files in the `products/` directory.
4. Campaigns are stored as individual JSON files in the `campaigns/` directory.
5. Sessions are stored as JSONL files in the `sessions/` directory for efficient appending.

### Examples
Memory Workspace Architecture:
- `BRAND.md`: Voice, positioning, values
- `products/`: Product-specific context (JSON)
- `campaigns/`: Campaign history, status, metrics (JSON)
- `sessions/`: Conversation transcripts (JSONL)
- `state.json`: Runtime state (active product/campaign)
