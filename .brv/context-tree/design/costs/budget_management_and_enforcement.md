## Raw Concept
**Task:**
Document budget configuration and enforcement logic

**Files:**
- src/costs/tracker.ts
- src/costs/types.ts

**Flow:**
ToolRegistry.execute -> costTracker.shouldBlock(params) -> Check budgets (global, product, agent, user) -> Return blocked status

**Timestamp:** 2026-02-23

## Narrative
### Structure
Budgets are defined with a scope, period, and limit. Enforcement logic is integrated into the tool execution lifecycle.

### Features
Scopes: global, product, agent, user. Periods: daily, weekly, monthly. Actions: warn, block, warn_then_block.

### Rules
1. A budget is checked only if its scope matches the execution context (e.g., matching productId).
2. Blocked actions return a clear reason including the budget name and current spend.
3. Warning thresholds (default 80%) can be used to proactively notify admins.

### Examples
Budget Configuration Example:
```typescript
{
  name: "Monthly Global Limit",
  scope: "global",
  period: "monthly",
  limitUsd: 50.00,
  action: "block",
  enabled: true
}
```
