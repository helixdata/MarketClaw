/**
 * Tool Registry
 * Central hub for tool registration and execution
 */

import { Tool, ToolDefinition, ToolResult, RegisteredTool, ToolCategory } from './types.js';
import { costTracker } from '../costs/tracker.js';

/**
 * Execution context passed to tools for cost attribution
 */
export interface ExecutionContext {
  agent?: string;
  productId?: string;
  userId?: string;
}

export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();
  private initialized = false;

  /**
   * Register a single tool
   */
  register(tool: Tool, options?: { category?: ToolCategory; enabled?: boolean }): void {
    const registered: RegisteredTool = {
      ...tool,
      category: options?.category,
      enabled: options?.enabled ?? true,
    };
    this.tools.set(tool.name, registered);
  }

  /**
   * Register multiple tools
   */
  registerAll(tools: Tool[], options?: { category?: ToolCategory }): void {
    for (const tool of tools) {
      this.register(tool, options);
    }
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Get a tool by name
   */
  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if a tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * List all tools
   */
  list(filter?: { category?: ToolCategory; enabled?: boolean }): RegisteredTool[] {
    let tools = Array.from(this.tools.values());

    if (filter?.category) {
      tools = tools.filter(t => t.category === filter.category);
    }
    if (filter?.enabled !== undefined) {
      tools = tools.filter(t => t.enabled === filter.enabled);
    }

    return tools;
  }

  /**
   * Get tool definitions for AI (JSON Schema format)
   */
  getDefinitions(filter?: { category?: ToolCategory }): ToolDefinition[] {
    return this.list({ ...filter, enabled: true }).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  /**
   * Execute a tool by name
   */
  async execute(name: string, params: any, context?: ExecutionContext): Promise<ToolResult> {
    const tool = this.tools.get(name);

    if (!tool) {
      return {
        success: false,
        message: `Tool not found: ${name}`,
      };
    }

    if (!tool.enabled) {
      return {
        success: false,
        message: `Tool is disabled: ${name}`,
      };
    }

    try {
      // Check budget before execution
      const budgetCheck = await costTracker.shouldBlock({
        tool: name,
        agent: context?.agent,
        productId: context?.productId,
        userId: context?.userId,
      });

      if (budgetCheck.blocked) {
        return {
          success: false,
          message: `⛔ Blocked by budget: ${budgetCheck.reason}`,
        };
      }

      // Execute the tool
      const result = await tool.execute(params);

      // Log cost if the tool reported one
      if (result.cost && result.cost.usd > 0) {
        await costTracker.log({
          tool: name,
          cost: result.cost,
          agent: context?.agent,
          productId: context?.productId,
          userId: context?.userId,
          meta: { params },
        });
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `Tool execution failed: ${message}`,
      };
    }
  }

  /**
   * Enable a tool
   */
  enable(name: string): boolean {
    const tool = this.tools.get(name);
    if (tool) {
      tool.enabled = true;
      return true;
    }
    return false;
  }

  /**
   * Disable a tool
   */
  disable(name: string): boolean {
    const tool = this.tools.get(name);
    if (tool) {
      tool.enabled = false;
      return true;
    }
    return false;
  }

  /**
   * Get tool count
   */
  get count(): number {
    return this.tools.size;
  }

  /**
   * Clear all tools
   */
  clear(): void {
    this.tools.clear();
  }
}

// Singleton registry
export const toolRegistry = new ToolRegistry();
