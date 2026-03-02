/**
 * Tool System Types
 * Open, extensible tool architecture
 */

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
  required?: string[];
  default?: any;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
}

/**
 * Cost info returned by a tool
 */
export interface ToolCost {
  /** Normalized cost in USD */
  usd: number;
  
  /** Provider name (openai, anthropic, gemini, resend, etc.) */
  provider: string;
  
  /** Number of units consumed */
  units?: number;
  
  /** Type of units */
  unitType?: 'tokens' | 'emails' | 'images' | 'characters' | 'api_calls' | 'minutes';
  
  /** Breakdown (e.g., { inputTokens: 100, outputTokens: 50 }) */
  breakdown?: Record<string, number>;
}

/**
 * Inline button for interactive responses
 */
export interface InlineButton {
  /** Button display text */
  text: string;
  
  /** Callback command when clicked */
  callback: string;
}

export interface ToolResult {
  success: boolean;
  message: string;
  data?: any;
  
  /** Cost incurred by this tool execution (if any) */
  cost?: ToolCost;
  
  /** Inline buttons for interactive UI (e.g., approve/reject) */
  buttons?: InlineButton[];
}

/**
 * Tool Interface
 * Implement this to create a new tool
 */
export interface Tool {
  /** Unique tool name (snake_case) */
  name: string;
  
  /** Human-readable description for the AI */
  description: string;
  
  /** JSON Schema for parameters */
  parameters: ToolDefinition['parameters'];
  
  /** Execute the tool */
  execute(params: any): Promise<ToolResult>;
}

/**
 * Tool Category for organization
 */
export type ToolCategory = 
  | 'scheduling'
  | 'knowledge'
  | 'marketing'
  | 'memory'
  | 'social'
  | 'research'
  | 'utility'
  | 'a2a';

/**
 * Extended tool with metadata
 */
export interface RegisteredTool extends Tool {
  category?: ToolCategory;
  enabled?: boolean;
}
