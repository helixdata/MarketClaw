## Raw Concept
**Task:**
Document persistent memory and RAG system

**Files:**
- src/memory/
- src/knowledge/

**Timestamp:** 2026-02-23

## Narrative
### Structure
Memory is stored in ~/.marketclaw/workspace/. Knowledge base uses RAG with embeddings (via Vectra).

### Features
Remembers products, brand voice, campaign history, and knowledge base documents.

### Rules
Directory Structure:
~/.marketclaw/workspace/
├── BRAND.md           # Your brand voice
├── products/          # Product details
├── campaigns/         # Campaign history
└── knowledge/         # Product knowledge base
