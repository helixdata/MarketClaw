## Raw Concept
**Task:**
Document the cost tracking and budget management system

**Files:**
- src/costs/tracker.ts
- src/costs/types.ts
- src/costs/index.ts

**Flow:**
Tool Execution -> costTracker.log(record) -> Append to .jsonl -> costTracker.summarize(query) -> Aggregate dimensions -> Return CostSummary

**Timestamp:** 2026-02-23

## Narrative
### Structure
The Cost Tracking system uses a singleton `CostTracker` (src/costs/tracker.ts) to manage usage data. Costs are stored in append-only JSONL files organized by date within the workspace directory.

### Dependencies
Uses standard Node.js `fs/promises` and `readline` for efficient log streaming and parsing.

### Features
Real-time cost logging, multi-dimensional aggregation (by tool, agent, product, provider, user), time-series grouping (daily/hourly), and budget enforcement.

### Rules
1. Cost records are stored in `~/.marketclaw/workspace/costs/costs-YYYY-MM-DD.jsonl`.
2. Budgets are stored in `budgets.json` within the same directory.
3. Budget checks can block tool execution if limits are exceeded.
4. Costs are normalized to USD for unified reporting.
