/**
 * Sub-Agent Registry Tests
 * Tests the actual registry.ts module with mocked dependencies
 */

import { describe, it, expect, beforeEach, vi, afterEach, Mock } from 'vitest';
import { SubAgentConfig, SubAgentManifest, AgentTask } from './types.js';

// Mock pino BEFORE importing the registry
vi.mock('pino', () => ({
  default: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock providers with a factory function
vi.mock('../providers/index.js', () => ({
  providers: {
    getActive: vi.fn(),
  },
}));

// Mock tool registry
vi.mock('../tools/index.js', () => ({
  toolRegistry: {
    getDefinitions: vi.fn().mockReturnValue([]),
    execute: vi.fn().mockResolvedValue({ success: true }),
  },
}));

// Now import the actual module
import { subAgentRegistry } from './registry.js';
import { providers } from '../providers/index.js';
import { toolRegistry } from '../tools/index.js';

describe('SubAgentRegistry', () => {
  // Create mock provider that we can configure per test
  const mockProvider = {
    complete: vi.fn().mockResolvedValue({
      content: 'Test response',
      toolCalls: null,
    }),
  };

  const createTestConfig = (overrides?: Partial<SubAgentConfig>): SubAgentConfig => ({
    identity: {
      name: 'Test Agent',
      emoji: '🤖',
      persona: 'A test agent',
      voice: 'friendly',
    },
    specialty: {
      id: 'test',
      displayName: 'Test Specialty',
      description: 'For testing purposes',
      systemPrompt: 'You are a test agent.',
    },
    model: 'gpt-4',
    enabled: true,
    ...overrides,
  });

  const createTestManifest = (overrides?: Partial<SubAgentManifest>): SubAgentManifest => ({
    id: 'test-agent',
    version: '1.0.0',
    identity: {
      name: 'Test Agent',
      emoji: '🤖',
      persona: 'A test agent',
      voice: 'friendly',
    },
    specialty: {
      displayName: 'Test Specialty',
      description: 'For testing purposes',
      systemPrompt: 'You are a test agent.',
    },
    defaultModel: 'gpt-4',
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock provider
    mockProvider.complete.mockResolvedValue({
      content: 'Test response',
      toolCalls: null,
    });
    (providers.getActive as Mock).mockReturnValue(mockProvider);
    (toolRegistry.getDefinitions as Mock).mockReturnValue([]);
  });

  afterEach(() => {
    subAgentRegistry.removeAllListeners();
  });

  describe('register', () => {
    it('should register an agent', () => {
      const config = createTestConfig();
      const agentId = `test-agent-${Date.now()}`;
      subAgentRegistry.register(agentId, config);

      const agent = subAgentRegistry.get(agentId);
      expect(agent).toBeDefined();
      expect(agent!.config).toEqual(config);
    });

    it('should set initial state correctly', () => {
      const config = createTestConfig();
      const agentId = `test-agent-state-${Date.now()}`;
      subAgentRegistry.register(agentId, config);

      const agent = subAgentRegistry.get(agentId);
      expect(agent!.activeTasks).toEqual([]);
      expect(agent!.completedTasks).toEqual([]);
      expect(agent!.isRunning).toBe(true);
    });

    it('should update existing agent', () => {
      const agentId = `test-agent-update-${Date.now()}`;
      const config1 = createTestConfig();
      subAgentRegistry.register(agentId, config1);

      const config2 = createTestConfig({ model: 'claude-3' });
      subAgentRegistry.register(agentId, config2);

      const agent = subAgentRegistry.get(agentId);
      expect(agent!.config.model).toBe('claude-3');
    });

    it('should respect enabled flag', () => {
      const config = createTestConfig({ enabled: false });
      const agentId = `disabled-agent-${Date.now()}`;
      subAgentRegistry.register(agentId, config);

      const agent = subAgentRegistry.get(agentId);
      expect(agent!.isRunning).toBe(false);
    });
  });

  describe('registerFromManifest', () => {
    it('should register agent from manifest', () => {
      const manifest = createTestManifest({ id: `manifest-agent-${Date.now()}` });
      subAgentRegistry.registerFromManifest(manifest);

      const agent = subAgentRegistry.get(manifest.id);
      expect(agent).toBeDefined();
      expect(agent!.config.identity.name).toBe('Test Agent');
      expect(agent!.config.specialty.displayName).toBe('Test Specialty');
    });

    it('should apply overrides', () => {
      const manifest = createTestManifest({ id: `manifest-override-${Date.now()}` });
      subAgentRegistry.registerFromManifest(manifest, { 
        model: 'claude-3',
        enabled: false,
      });

      const agent = subAgentRegistry.get(manifest.id);
      expect(agent!.config.model).toBe('claude-3');
      expect(agent!.config.enabled).toBe(false);
    });

    it('should use manifest id as specialty id', () => {
      const customId = `custom-id-${Date.now()}`;
      const manifest = createTestManifest({ id: customId });
      subAgentRegistry.registerFromManifest(manifest);

      const agent = subAgentRegistry.get(customId);
      expect(agent!.config.specialty.id).toBe(customId);
    });
  });

  describe('get', () => {
    it('should return agent by id', () => {
      const agentId = `get-test-${Date.now()}`;
      subAgentRegistry.register(agentId, createTestConfig());
      
      const agent = subAgentRegistry.get(agentId);
      expect(agent).toBeDefined();
    });

    it('should return undefined for non-existent agent', () => {
      const agent = subAgentRegistry.get('nonexistent');
      expect(agent).toBeUndefined();
    });
  });

  describe('list', () => {
    it('should list all agents', () => {
      const before = subAgentRegistry.list().length;
      subAgentRegistry.register(`agent1-${Date.now()}`, createTestConfig());
      subAgentRegistry.register(`agent2-${Date.now()}`, createTestConfig());

      const agents = subAgentRegistry.list();
      expect(agents.length).toBe(before + 2);
    });
  });

  describe('listEnabled', () => {
    it('should list only enabled agents', () => {
      const enabledId = `enabled-${Date.now()}`;
      const disabledId = `disabled-${Date.now()}`;
      
      subAgentRegistry.register(enabledId, createTestConfig({ enabled: true }));
      subAgentRegistry.register(disabledId, createTestConfig({ enabled: false }));

      const enabled = subAgentRegistry.listEnabled();
      const enabledAgent = enabled.find(a => a.config.specialty.id === 'test' && a.config.enabled === true);
      expect(enabledAgent).toBeDefined();
      
      const disabledAgent = enabled.find(a => 
        a.config.identity.name === 'Test Agent' && a.config.enabled === false
      );
      expect(disabledAgent).toBeUndefined();
    });
  });

  describe('setEnabled', () => {
    it('should enable agent', () => {
      const agentId = `enable-test-${Date.now()}`;
      subAgentRegistry.register(agentId, createTestConfig({ enabled: false }));
      subAgentRegistry.setEnabled(agentId, true);

      const agent = subAgentRegistry.get(agentId);
      expect(agent!.config.enabled).toBe(true);
      expect(agent!.isRunning).toBe(true);
    });

    it('should disable agent', () => {
      const agentId = `disable-test-${Date.now()}`;
      subAgentRegistry.register(agentId, createTestConfig({ enabled: true }));
      subAgentRegistry.setEnabled(agentId, false);

      const agent = subAgentRegistry.get(agentId);
      expect(agent!.config.enabled).toBe(false);
      expect(agent!.isRunning).toBe(false);
    });

    it('should handle non-existent agent', () => {
      // Should not throw
      subAgentRegistry.setEnabled('nonexistent', true);
    });
  });

  describe('spawn', () => {
    it('should create a task with proper fields', async () => {
      const agentId = `spawn-test-${Date.now()}`;
      subAgentRegistry.register(agentId, createTestConfig());

      const task = await subAgentRegistry.spawn(agentId, 'Do something');
      
      expect(task.id).toBeDefined();
      expect(task.id).toMatch(/^task_/);
      expect(task.agentId).toBe(agentId);
      expect(task.prompt).toBe('Do something');
      expect(task.createdAt).toBeDefined();
      // Status may be 'pending', 'running', 'completed', or 'failed' depending on timing
      expect(['pending', 'running', 'completed', 'failed']).toContain(task.status);
    });

    it('should include context when provided', async () => {
      const agentId = `spawn-context-${Date.now()}`;
      subAgentRegistry.register(agentId, createTestConfig());

      const context = { key: 'value' };
      const task = await subAgentRegistry.spawn(agentId, 'Do something', context);
      
      expect(task.context).toEqual(context);
    });

    it('should add task to agent tasks', async () => {
      const agentId = `spawn-active-${Date.now()}`;
      subAgentRegistry.register(agentId, createTestConfig());

      const task = await subAgentRegistry.spawn(agentId, 'Do something');
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const agent = subAgentRegistry.get(agentId);
      // Task should be in either activeTasks or completedTasks
      const inActive = agent!.activeTasks.find(t => t.id === task.id);
      const inCompleted = agent!.completedTasks.find(t => t.id === task.id);
      expect(inActive || inCompleted).toBeDefined();
    });

    it('should throw for non-existent agent', async () => {
      await expect(
        subAgentRegistry.spawn('nonexistent', 'Do something')
      ).rejects.toThrow('Sub-agent not found: nonexistent');
    });

    it('should throw for disabled agent', async () => {
      const agentId = `spawn-disabled-${Date.now()}`;
      subAgentRegistry.register(agentId, createTestConfig({ enabled: false }));

      await expect(
        subAgentRegistry.spawn(agentId, 'Do something')
      ).rejects.toThrow(`Sub-agent is disabled: ${agentId}`);
    });
  });

  describe('getTask', () => {
    it('should get task from agent tasks', async () => {
      const agentId = `gettask-active-${Date.now()}`;
      subAgentRegistry.register(agentId, createTestConfig());
      const created = await subAgentRegistry.spawn(agentId, 'Do something');

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      const task = subAgentRegistry.getTask(created.id);
      expect(task).toBeDefined();
      expect(task!.id).toBe(created.id);
    });

    it('should return undefined for non-existent task', () => {
      const task = subAgentRegistry.getTask('nonexistent');
      expect(task).toBeUndefined();
    });
  });

  describe('waitForTask', () => {
    it('should return completed task', async () => {
      const agentId = `wait-complete-${Date.now()}`;
      subAgentRegistry.register(agentId, createTestConfig());
      
      mockProvider.complete.mockResolvedValueOnce({
        content: 'Done',
        toolCalls: null,
      });
      (providers.getActive as Mock).mockReturnValue(mockProvider);

      const task = await subAgentRegistry.spawn(agentId, 'Do something');
      const result = await subAgentRegistry.waitForTask(task.id, 5000);

      expect(['completed', 'failed']).toContain(result.status);
    });

    it('should return failed task when no provider', async () => {
      const agentId = `wait-fail-${Date.now()}`;
      subAgentRegistry.register(agentId, createTestConfig());
      
      // No provider configured
      (providers.getActive as Mock).mockReturnValue(null);

      const task = await subAgentRegistry.spawn(agentId, 'Do something');
      const result = await subAgentRegistry.waitForTask(task.id, 5000);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('provider');
    });
  });

  describe('task execution', () => {
    it('should execute task with AI provider', async () => {
      const agentId = `execute-test-${Date.now()}`;
      subAgentRegistry.register(agentId, createTestConfig());
      
      mockProvider.complete.mockResolvedValueOnce({
        content: 'Task completed successfully',
        toolCalls: null,
      });
      (providers.getActive as Mock).mockReturnValue(mockProvider);

      const task = await subAgentRegistry.spawn(agentId, 'Do something');
      
      // Wait for task to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockProvider.complete).toHaveBeenCalled();
    });

    it('should emit task:start event', async () => {
      const handler = vi.fn();
      subAgentRegistry.on('task:start', handler);

      const agentId = `start-event-${Date.now()}`;
      subAgentRegistry.register(agentId, createTestConfig());
      (providers.getActive as Mock).mockReturnValue(mockProvider);

      await subAgentRegistry.spawn(agentId, 'Do something');
      
      // Wait for event
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(handler).toHaveBeenCalled();
    });

    it('should emit task:complete event', async () => {
      const handler = vi.fn();
      subAgentRegistry.on('task:complete', handler);

      const agentId = `complete-event-${Date.now()}`;
      subAgentRegistry.register(agentId, createTestConfig());
      mockProvider.complete.mockResolvedValueOnce({
        content: 'Done',
        toolCalls: null,
      });
      (providers.getActive as Mock).mockReturnValue(mockProvider);

      await subAgentRegistry.spawn(agentId, 'Do something');
      
      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(handler).toHaveBeenCalled();
    });

    it('should handle tool calls', async () => {
      const agentId = `tool-call-${Date.now()}`;
      subAgentRegistry.register(agentId, createTestConfig({
        specialty: {
          id: 'test',
          displayName: 'Test',
          description: 'Test',
          systemPrompt: 'Test',
          tools: ['test_tool'],
        },
      }));

      // First response has tool calls
      mockProvider.complete
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [{ id: 'call1', name: 'test_tool', arguments: {} }],
        })
        .mockResolvedValueOnce({
          content: 'Final response',
          toolCalls: null,
        });

      (providers.getActive as Mock).mockReturnValue(mockProvider);
      (toolRegistry.getDefinitions as Mock).mockReturnValue([
        { name: 'test_tool', description: 'Test tool', parameters: {} },
      ]);

      await subAgentRegistry.spawn(agentId, 'Do something with tools');
      
      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(toolRegistry.execute).toHaveBeenCalledWith('test_tool', {});
    });

    it('should fail task when no provider', async () => {
      const handler = vi.fn();
      subAgentRegistry.on('task:error', handler);

      const agentId = `no-provider-${Date.now()}`;
      subAgentRegistry.register(agentId, createTestConfig());
      (providers.getActive as Mock).mockReturnValue(null);

      const task = await subAgentRegistry.spawn(agentId, 'Do something');
      
      // Wait for error
      await new Promise(resolve => setTimeout(resolve, 100));

      // Task should have failed
      const agent = subAgentRegistry.get(agentId);
      const failedTask = agent!.completedTasks.find(t => t.status === 'failed');
      expect(failedTask || handler.mock.calls.length > 0).toBeTruthy();
    });
  });

  describe('buildAgentPrompt (via spawn)', () => {
    it('should build prompt with professional voice', async () => {
      const agentId = `voice-pro-${Date.now()}`;
      subAgentRegistry.register(agentId, createTestConfig({
        identity: {
          name: 'Pro Agent',
          emoji: '💼',
          voice: 'professional',
        },
      }));

      mockProvider.complete.mockResolvedValueOnce({
        content: 'Done',
        toolCalls: null,
      });
      (providers.getActive as Mock).mockReturnValue(mockProvider);

      await subAgentRegistry.spawn(agentId, 'Test');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check that complete was called with a system prompt containing "professional"
      expect(mockProvider.complete).toHaveBeenCalled();
      const call = mockProvider.complete.mock.calls[0][0];
      expect(call.systemPrompt).toContain('professional and polished');
    });

    it('should build prompt with casual voice', async () => {
      const agentId = `voice-casual-${Date.now()}`;
      subAgentRegistry.register(agentId, createTestConfig({
        identity: {
          name: 'Casual Agent',
          emoji: '😎',
          voice: 'casual',
        },
      }));

      mockProvider.complete.mockResolvedValueOnce({
        content: 'Done',
        toolCalls: null,
      });
      (providers.getActive as Mock).mockReturnValue(mockProvider);

      await subAgentRegistry.spawn(agentId, 'Test');
      await new Promise(resolve => setTimeout(resolve, 100));

      const call = mockProvider.complete.mock.calls[0][0];
      expect(call.systemPrompt).toContain('casual and relaxed');
    });

    it('should build prompt with playful voice', async () => {
      const agentId = `voice-playful-${Date.now()}`;
      subAgentRegistry.register(agentId, createTestConfig({
        identity: {
          name: 'Fun Agent',
          emoji: '🎉',
          voice: 'playful',
        },
      }));

      mockProvider.complete.mockResolvedValueOnce({
        content: 'Done',
        toolCalls: null,
      });
      (providers.getActive as Mock).mockReturnValue(mockProvider);

      await subAgentRegistry.spawn(agentId, 'Test');
      await new Promise(resolve => setTimeout(resolve, 100));

      const call = mockProvider.complete.mock.calls[0][0];
      expect(call.systemPrompt).toContain('fun and energetic');
    });

    it('should include identity and specialty in prompt', async () => {
      const agentId = `prompt-content-${Date.now()}`;
      subAgentRegistry.register(agentId, createTestConfig({
        identity: {
          name: 'Custom Agent',
          emoji: '⭐',
          persona: 'A custom persona',
        },
        specialty: {
          id: 'custom',
          displayName: 'Custom Specialty',
          description: 'Custom description',
          systemPrompt: 'Custom system prompt.',
        },
      }));

      mockProvider.complete.mockResolvedValueOnce({
        content: 'Done',
        toolCalls: null,
      });
      (providers.getActive as Mock).mockReturnValue(mockProvider);

      await subAgentRegistry.spawn(agentId, 'Test');
      await new Promise(resolve => setTimeout(resolve, 100));

      const call = mockProvider.complete.mock.calls[0][0];
      expect(call.systemPrompt).toContain('Custom Agent');
      expect(call.systemPrompt).toContain('⭐');
      expect(call.systemPrompt).toContain('Custom Specialty');
      expect(call.systemPrompt).toContain('Custom system prompt.');
    });

    it('should include context in prompt', async () => {
      const agentId = `prompt-context-${Date.now()}`;
      subAgentRegistry.register(agentId, createTestConfig());

      mockProvider.complete.mockResolvedValueOnce({
        content: 'Done',
        toolCalls: null,
      });
      (providers.getActive as Mock).mockReturnValue(mockProvider);

      await subAgentRegistry.spawn(agentId, 'Test', { important: 'data' });
      await new Promise(resolve => setTimeout(resolve, 100));

      const call = mockProvider.complete.mock.calls[0][0];
      expect(call.systemPrompt).toContain('Task Context');
      expect(call.systemPrompt).toContain('important');
    });
  });

  describe('multiple agents', () => {
    it('should manage multiple agents independently', async () => {
      const agent1Id = `multi-1-${Date.now()}`;
      const agent2Id = `multi-2-${Date.now()}`;
      
      subAgentRegistry.register(agent1Id, createTestConfig({ 
        identity: { name: 'Agent 1', emoji: '1️⃣' },
      }));
      subAgentRegistry.register(agent2Id, createTestConfig({ 
        identity: { name: 'Agent 2', emoji: '2️⃣' },
      }));

      const task1 = await subAgentRegistry.spawn(agent1Id, 'Task for agent 1');
      const task2 = await subAgentRegistry.spawn(agent2Id, 'Task for agent 2');

      expect(task1.agentId).toBe(agent1Id);
      expect(task2.agentId).toBe(agent2Id);
    });

    it('should track tasks per agent', async () => {
      const agent1Id = `track-1-${Date.now()}`;
      const agent2Id = `track-2-${Date.now()}`;
      
      subAgentRegistry.register(agent1Id, createTestConfig());
      subAgentRegistry.register(agent2Id, createTestConfig());

      await subAgentRegistry.spawn(agent1Id, 'Task 1');
      await subAgentRegistry.spawn(agent1Id, 'Task 2');
      await subAgentRegistry.spawn(agent2Id, 'Task 3');

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      const agent1 = subAgentRegistry.get(agent1Id);
      const agent2 = subAgentRegistry.get(agent2Id);

      // Tasks may be in active or completed
      const agent1Tasks = agent1!.activeTasks.length + agent1!.completedTasks.length;
      const agent2Tasks = agent2!.activeTasks.length + agent2!.completedTasks.length;

      expect(agent1Tasks).toBeGreaterThanOrEqual(2);
      expect(agent2Tasks).toBeGreaterThanOrEqual(1);
    });
  });
});
