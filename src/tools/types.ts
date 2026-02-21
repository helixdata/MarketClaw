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

export interface ToolResult {
  success: boolean;
  message: string;
  data?: any;
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
  | 'utility';

/**
 * Extended tool with metadata
 */
export interface RegisteredTool extends Tool {
  category?: ToolCategory;
  enabled?: boolean;
}
