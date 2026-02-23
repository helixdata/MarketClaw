## Raw Concept
**Task:**
Document the interfaces and types used in the tool system

**Files:**
- src/tools/types.ts

**Timestamp:** 2026-02-23

## Narrative
### Structure
Defined in src/tools/types.ts. Uses JSON Schema-like structures for parameters to ensure LLM compatibility.

### Features
Support for typed parameters (string, number, boolean, array, object), cost reporting (USD and units), and interactive UI elements.

### Rules
Tool Interface Definition:
```typescript
export interface Tool {
  name: string;
  description: string;
  parameters: ToolDefinition['parameters'];
  execute(params: any): Promise<ToolResult>;
}
```

ToolResult Interface:
```typescript
export interface ToolResult {
  success: boolean;
  message: string;
  data?: any;
  cost?: ToolCost;
  buttons?: InlineButton[];
}
```

### Examples
Tool Categories:
- scheduling
- knowledge
- marketing
- memory
- social
- research
- utility
