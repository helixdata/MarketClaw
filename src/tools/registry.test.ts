/**
 * Tool Registry Tests
 * Tests the actual ToolRegistry class from registry.ts
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Tool, ToolCategory } from './types.js';

// Import the actual ToolRegistry class (not the singleton)
import { ToolRegistry } from './registry.js';

// Helper to create mock tools
const createMockTool = (name: string, overrides?: Partial<Tool>): Tool => ({
  name,
  description: `${name} tool for testing`,
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'Input value' },
    },
    required: ['input'],
  },
  execute: vi.fn().mockResolvedValue({ success: true, data: 'result' }),
  ...overrides,
});

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    // Create fresh instance for each test
    registry = new ToolRegistry();
  });

  afterEach(() => {
    registry.clear();
  });

  describe('register', () => {
    it('should register a tool', () => {
      const tool = createMockTool('test_tool');
      registry.register(tool);

      expect(registry.has('test_tool')).toBe(true);
    });

    it('should enable tool by default', () => {
      const tool = createMockTool('test_tool');
      registry.register(tool);

      const registered = registry.get('test_tool');
      expect(registered?.enabled).toBe(true);
    });

    it('should respect enabled option', () => {
      const tool = createMockTool('disabled_tool');
      registry.register(tool, { enabled: false });

      const registered = registry.get('disabled_tool');
      expect(registered?.enabled).toBe(false);
    });

    it('should assign category when provided', () => {
      const tool = createMockTool('categorized_tool');
      registry.register(tool, { category: 'content' });

      const registered = registry.get('categorized_tool');
      expect(registered?.category).toBe('content');
    });

    it('should overwrite existing tool', () => {
      const tool1 = createMockTool('tool', { description: 'First version' });
      const tool2 = createMockTool('tool', { description: 'Second version' });

      registry.register(tool1);
      registry.register(tool2);

      const registered = registry.get('tool');
      expect(registered?.description).toBe('Second version');
    });
  });

  describe('registerAll', () => {
    it('should register multiple tools', () => {
      const tools = [
        createMockTool('tool1'),
        createMockTool('tool2'),
        createMockTool('tool3'),
      ];

      registry.registerAll(tools);

      expect(registry.count).toBe(3);
      expect(registry.has('tool1')).toBe(true);
      expect(registry.has('tool2')).toBe(true);
      expect(registry.has('tool3')).toBe(true);
    });

    it('should assign category to all tools', () => {
      const tools = [
        createMockTool('tool1'),
        createMockTool('tool2'),
      ];

      registry.registerAll(tools, { category: 'social' });

      expect(registry.get('tool1')?.category).toBe('social');
      expect(registry.get('tool2')?.category).toBe('social');
    });

    it('should handle empty array', () => {
      registry.registerAll([]);
      expect(registry.count).toBe(0);
    });
  });

  describe('unregister', () => {
    it('should unregister a tool', () => {
      registry.register(createMockTool('tool'));
      
      const result = registry.unregister('tool');
      
      expect(result).toBe(true);
      expect(registry.has('tool')).toBe(false);
    });

    it('should return false for non-existent tool', () => {
      const result = registry.unregister('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('get', () => {
    it('should return registered tool', () => {
      const tool = createMockTool('tool');
      registry.register(tool);

      const registered = registry.get('tool');
      expect(registered?.name).toBe('tool');
    });

    it('should return undefined for non-existent tool', () => {
      const result = registry.get('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for registered tool', () => {
      registry.register(createMockTool('tool'));
      expect(registry.has('tool')).toBe(true);
    });

    it('should return false for non-existent tool', () => {
      expect(registry.has('nonexistent')).toBe(false);
    });
  });

  describe('list', () => {
    beforeEach(() => {
      registry.register(createMockTool('content1'), { category: 'content', enabled: true });
      registry.register(createMockTool('content2'), { category: 'content', enabled: false });
      registry.register(createMockTool('social1'), { category: 'social', enabled: true });
      registry.register(createMockTool('social2'), { category: 'social', enabled: true });
    });

    it('should list all tools without filter', () => {
      const tools = registry.list();
      expect(tools).toHaveLength(4);
    });

    it('should filter by category', () => {
      const content = registry.list({ category: 'content' });
      expect(content).toHaveLength(2);
      
      const social = registry.list({ category: 'social' });
      expect(social).toHaveLength(2);
    });

    it('should filter by enabled status', () => {
      const enabled = registry.list({ enabled: true });
      expect(enabled).toHaveLength(3);
      
      const disabled = registry.list({ enabled: false });
      expect(disabled).toHaveLength(1);
    });

    it('should combine filters', () => {
      const contentEnabled = registry.list({ category: 'content', enabled: true });
      expect(contentEnabled).toHaveLength(1);
      expect(contentEnabled[0].name).toBe('content1');
    });

    it('should return empty array when no matches', () => {
      const result = registry.list({ category: 'nonexistent' as ToolCategory });
      expect(result).toEqual([]);
    });
  });

  describe('getDefinitions', () => {
    it('should return tool definitions', () => {
      registry.register(createMockTool('tool1', {
        description: 'Tool 1 description',
        parameters: { type: 'object', properties: { x: { type: 'number' } } },
      }));

      const definitions = registry.getDefinitions();

      expect(definitions).toHaveLength(1);
      expect(definitions[0]).toEqual({
        name: 'tool1',
        description: 'Tool 1 description',
        parameters: { type: 'object', properties: { x: { type: 'number' } } },
      });
    });

    it('should exclude disabled tools', () => {
      registry.register(createMockTool('enabled'), { enabled: true });
      registry.register(createMockTool('disabled'), { enabled: false });

      const definitions = registry.getDefinitions();

      expect(definitions).toHaveLength(1);
      expect(definitions[0].name).toBe('enabled');
    });

    it('should filter by category', () => {
      registry.register(createMockTool('content1'), { category: 'content' });
      registry.register(createMockTool('social1'), { category: 'social' });

      const contentDefs = registry.getDefinitions({ category: 'content' });

      expect(contentDefs).toHaveLength(1);
      expect(contentDefs[0].name).toBe('content1');
    });

    it('should return empty array when no tools', () => {
      const definitions = registry.getDefinitions();
      expect(definitions).toEqual([]);
    });
  });

  describe('execute', () => {
    it('should execute tool and return result', async () => {
      const tool = createMockTool('tool');
      (tool.execute as ReturnType<typeof vi.fn>).mockResolvedValue({ 
        success: true, 
        data: 'executed' 
      });
      registry.register(tool);

      const result = await registry.execute('tool', { input: 'test' });

      expect(result.success).toBe(true);
      expect(result.data).toBe('executed');
      expect(tool.execute).toHaveBeenCalledWith({ input: 'test' });
    });

    it('should return error for non-existent tool', async () => {
      const result = await registry.execute('nonexistent', {});

      expect(result.success).toBe(false);
      expect(result.message).toBe('Tool not found: nonexistent');
    });

    it('should return error for disabled tool', async () => {
      registry.register(createMockTool('disabled'), { enabled: false });

      const result = await registry.execute('disabled', {});

      expect(result.success).toBe(false);
      expect(result.message).toBe('Tool is disabled: disabled');
    });

    it('should handle execution errors', async () => {
      const tool = createMockTool('failing');
      (tool.execute as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Execution failed')
      );
      registry.register(tool);

      const result = await registry.execute('failing', {});

      expect(result.success).toBe(false);
      expect(result.message).toBe('Tool execution failed: Execution failed');
    });

    it('should handle non-Error exceptions', async () => {
      const tool = createMockTool('throwing');
      (tool.execute as ReturnType<typeof vi.fn>).mockRejectedValue('String error');
      registry.register(tool);

      const result = await registry.execute('throwing', {});

      expect(result.success).toBe(false);
      expect(result.message).toBe('Tool execution failed: String error');
    });
  });

  describe('enable', () => {
    it('should enable a tool', () => {
      registry.register(createMockTool('tool'), { enabled: false });
      
      const result = registry.enable('tool');
      
      expect(result).toBe(true);
      expect(registry.get('tool')?.enabled).toBe(true);
    });

    it('should return false for non-existent tool', () => {
      const result = registry.enable('nonexistent');
      expect(result).toBe(false);
    });

    it('should be idempotent', () => {
      registry.register(createMockTool('tool'), { enabled: true });
      
      const result = registry.enable('tool');
      
      expect(result).toBe(true);
      expect(registry.get('tool')?.enabled).toBe(true);
    });
  });

  describe('disable', () => {
    it('should disable a tool', () => {
      registry.register(createMockTool('tool'), { enabled: true });
      
      const result = registry.disable('tool');
      
      expect(result).toBe(true);
      expect(registry.get('tool')?.enabled).toBe(false);
    });

    it('should return false for non-existent tool', () => {
      const result = registry.disable('nonexistent');
      expect(result).toBe(false);
    });

    it('should be idempotent', () => {
      registry.register(createMockTool('tool'), { enabled: false });
      
      const result = registry.disable('tool');
      
      expect(result).toBe(true);
      expect(registry.get('tool')?.enabled).toBe(false);
    });
  });

  describe('count', () => {
    it('should return number of registered tools', () => {
      expect(registry.count).toBe(0);

      registry.register(createMockTool('tool1'));
      expect(registry.count).toBe(1);

      registry.register(createMockTool('tool2'));
      expect(registry.count).toBe(2);
    });

    it('should decrease after unregister', () => {
      registry.register(createMockTool('tool1'));
      registry.register(createMockTool('tool2'));
      
      registry.unregister('tool1');
      
      expect(registry.count).toBe(1);
    });
  });

  describe('clear', () => {
    it('should remove all tools', () => {
      registry.register(createMockTool('tool1'));
      registry.register(createMockTool('tool2'));
      registry.register(createMockTool('tool3'));

      registry.clear();

      expect(registry.count).toBe(0);
      expect(registry.list()).toEqual([]);
    });

    it('should be safe to call on empty registry', () => {
      registry.clear();
      expect(registry.count).toBe(0);
    });
  });

  describe('tool parameters', () => {
    it('should preserve complex parameter schemas', () => {
      const complexParams = {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text input' },
          count: { type: 'number', minimum: 1, maximum: 100 },
          options: {
            type: 'object',
            properties: {
              format: { type: 'string', enum: ['json', 'xml', 'csv'] },
              compress: { type: 'boolean' },
            },
          },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['text'],
      };

      registry.register(createMockTool('complex', { parameters: complexParams }));

      const definitions = registry.getDefinitions();
      expect(definitions[0].parameters).toEqual(complexParams);
    });
  });

  describe('integration scenarios', () => {
    it('should support typical registration flow', () => {
      // Register tools from different categories
      const contentTools = [
        createMockTool('draft_email'),
        createMockTool('generate_image'),
      ];
      registry.registerAll(contentTools, { category: 'content' });

      const socialTools = [
        createMockTool('post_tweet'),
        createMockTool('post_linkedin'),
      ];
      registry.registerAll(socialTools, { category: 'social' });

      // Verify registration
      expect(registry.count).toBe(4);
      expect(registry.list({ category: 'content' })).toHaveLength(2);
      expect(registry.list({ category: 'social' })).toHaveLength(2);

      // Get definitions for AI
      const definitions = registry.getDefinitions();
      expect(definitions).toHaveLength(4);
      expect(definitions.every(d => d.name && d.description && d.parameters)).toBe(true);
    });

    it('should support dynamic enable/disable', async () => {
      registry.register(createMockTool('tool'), { enabled: true });

      // Execute while enabled
      let result = await registry.execute('tool', {});
      expect(result.success).toBe(true);

      // Disable and try again
      registry.disable('tool');
      result = await registry.execute('tool', {});
      expect(result.success).toBe(false);
      expect(result.message).toContain('disabled');

      // Re-enable
      registry.enable('tool');
      result = await registry.execute('tool', {});
      expect(result.success).toBe(true);
    });

    it('should isolate tool executions', async () => {
      const tool1 = createMockTool('tool1');
      const tool2 = createMockTool('tool2');
      
      (tool1.execute as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: 'tool1' });
      (tool2.execute as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: 'tool2' });
      
      registry.register(tool1);
      registry.register(tool2);

      const [result1, result2] = await Promise.all([
        registry.execute('tool1', { input: 'a' }),
        registry.execute('tool2', { input: 'b' }),
      ]);

      expect(result1.data).toBe('tool1');
      expect(result2.data).toBe('tool2');
      expect(tool1.execute).toHaveBeenCalledWith({ input: 'a' });
      expect(tool2.execute).toHaveBeenCalledWith({ input: 'b' });
    });
  });
});
