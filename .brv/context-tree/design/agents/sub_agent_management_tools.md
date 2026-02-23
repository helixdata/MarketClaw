## Raw Concept
**Task:**
Document tools for managing and delegating tasks to sub-agents

**Files:**
- src/agents/tools.ts

**Flow:**
Agent Core -> delegate_task -> subAgentRegistry.spawn -> waitForTask -> Result

**Timestamp:** 2026-02-23

## Narrative
### Structure
The `agentTools` module (src/agents/tools.ts) provides the primary interface for the main agent to interact with the sub-agent system.

### Features
Task delegation (`delegate_task`), status monitoring (`get_task_status`), agent discovery (`list_agents`), and custom agent creation (`create_agent`).

### Rules
1. `delegate_task` defaults to waiting for completion (120s timeout) unless `wait: false` is specified.
2. Context for delegated tasks must be passed as a JSON string.
3. Custom agents created via `create_agent` are persisted through the `createCustomAgent` loader.

### Examples
Core Agent Tools:
| Tool Name | Description |
| :--- | :--- |
| `list_agents` | List all available sub-agents and their specialties |
| `delegate_task` | Assign a task to a specific agent (e.g., "twitter", "creative") |
| `get_task_status` | Check the progress and result of a delegated task |
| `agent_info` | Get detailed identity and specialty info for an agent |
| `create_agent` | Define a new sub-agent with a custom persona and expertise |
