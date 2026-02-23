## Raw Concept
**Task:**
Document technical API reference for agent tools

**Files:**
- docs/API.md

**Timestamp:** 2026-02-23

## Narrative
### Structure
Tools are grouped into functional categories: Scheduling, Knowledge, Social Media, Email, Leads, Sub-Agents, Team, Approvals, and Costs.

### Features
Comprehensive toolset for marketing automation including task scheduling, RAG-based knowledge retrieval, and platform-specific posting.

### Rules
All tools return a standard ToolResult format:
```typescript
interface ToolResult {
  success: boolean;
  message: string;
  data?: any;
  cost?: {
    usd: number;
    provider: string;
    units?: number;
    unitType?: string;
  };
}
```

### Examples
Key Tools:
- `schedule_task`: Schedule AI-driven automated tasks.
- `query_knowledge`: Search the product knowledge base.
- `post_tweet` / `post_linkedin`: Platform-specific social posting.
- `delegate_task`: Assign work to specialized sub-agents (e.g., Tweety, Quinn).
