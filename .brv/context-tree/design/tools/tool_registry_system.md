## Raw Concept
**Task:**
Document the central tool registration and execution system

**Files:**
- src/tools/registry.ts
- src/tools/types.ts
- src/tools/index.ts

**Flow:**
Agent -> ToolRegistry.execute(name, params, context) -> Budget Check -> Tool.execute(params) -> Log Cost -> Return ToolResult

**Timestamp:** 2026-02-23

## Narrative
### Structure
The Tool System uses a singleton `toolRegistry` (src/tools/registry.ts) to manage all agent capabilities. Tools are organized into categories and exported via `src/tools/index.ts`.

### Dependencies
Depends on src/costs/tracker.ts for budget checks and cost logging.

### Features
Centralized registration, category-based filtering, JSON Schema generation for LLMs, execution with budget enforcement, and automatic cost tracking.

### Rules
1. Tools must implement the `Tool` interface from `src/tools/types.ts`.
2. Tool names must be unique and in snake_case.
3. Every tool execution checks the `costTracker` to prevent budget overruns.
4. Tools return a `ToolResult` which can include interactive `InlineButton` objects for chat UIs.
