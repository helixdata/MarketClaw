/**
 * Agent Tools Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  listAgentsTool,
  delegateTaskTool,
  getTaskStatusTool,
  agentInfoTool,
  setAgentModelTool,
  listAgentModelsTool,
  recommendAgentModelTool,
  createAgentTool,
  agentTools,
} from './tools.js';
import { subAgentRegistry } from './registry.js';
import * as loader from './loader.js';
import { SubAgentState, AgentTask } from './types.js';

// Mock the registry
vi.mock('./registry.js', () => ({
  subAgentRegistry: {
    list: vi.fn(),
    listEnabled: vi.fn(),
    get: vi.fn(),
    spawn: vi.fn(),
    waitForTask: vi.fn(),
    getTask: vi.fn(),
    setModel: vi.fn(),
  },
}));

// Mock the loader
vi.mock('./loader.js', () => ({
  createCustomAgent: vi.fn(),
}));

// Helper to create a mock agent state
function createMockAgent(overrides: Partial<{
  id: string;
  name: string;
  emoji: string;
  displayName: string;
  description: string;
  enabled: boolean;
  model: string | undefined;
  activeTasks: AgentTask[];
  completedTasks: AgentTask[];
}>): SubAgentState {
  const {
    id = 'test-agent',
    name = 'Test Agent',
    emoji = '🤖',
    displayName = 'Test Specialty',
    description = 'A test agent',
    enabled = true,
    model = undefined,
    activeTasks = [],
    completedTasks = [],
  } = overrides;

  return {
    config: {
      identity: {
        name,
        emoji,
        persona: 'a test persona',
        voice: 'friendly',
      },
      specialty: {
        id,
        displayName,
        description,
        systemPrompt: 'You are a test agent.',
        tools: ['tool1', 'tool2'],
      },
      model,
      enabled,
    },
    activeTasks,
    completedTasks,
    isRunning: enabled,
  };
}

// Helper to create a mock task
function createMockTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task_123',
    agentId: 'test-agent',
    prompt: 'Do something',
    status: 'pending',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('agentTools export', () => {
  it('should export all 8 tools', () => {
    expect(agentTools).toHaveLength(8);
    expect(agentTools.map(t => t.name)).toEqual([
      'list_agents',
      'delegate_task',
      'get_task_status',
      'agent_info',
      'set_agent_model',
      'list_agent_models',
      'recommend_agent_model',
      'create_agent',
    ]);
  });
});

describe('list_agents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct metadata', () => {
    expect(listAgentsTool.name).toBe('list_agents');
    expect(listAgentsTool.description).toContain('List all available sub-agents');
    expect(listAgentsTool.parameters.properties).toHaveProperty('showDisabled');
  });

  it('should list enabled agents by default', async () => {
    const mockAgents = [
      createMockAgent({ id: 'twitter', name: 'Twitter Agent', emoji: '🐦' }),
      createMockAgent({ id: 'email', name: 'Email Agent', emoji: '📧' }),
    ];
    vi.mocked(subAgentRegistry.listEnabled).mockReturnValue(mockAgents);

    const result = await listAgentsTool.execute({});

    expect(result.success).toBe(true);
    expect(result.message).toBe('2 agents available');
    expect(result.data?.agents).toHaveLength(2);
    expect(result.data?.agents[0]).toMatchObject({
      id: 'twitter',
      name: 'Twitter Agent',
      emoji: '🐦',
      enabled: true,
      activeTasks: 0,
    });
    expect(subAgentRegistry.listEnabled).toHaveBeenCalled();
  });

  it('should include disabled agents when showDisabled is true', async () => {
    const mockAgents = [
      createMockAgent({ id: 'active', enabled: true }),
      createMockAgent({ id: 'disabled', enabled: false }),
    ];
    vi.mocked(subAgentRegistry.list).mockReturnValue(mockAgents);

    const result = await listAgentsTool.execute({ showDisabled: true });

    expect(result.success).toBe(true);
    expect(result.data?.agents).toHaveLength(2);
    expect(subAgentRegistry.list).toHaveBeenCalled();
  });

  it('should return empty list when no agents', async () => {
    vi.mocked(subAgentRegistry.listEnabled).mockReturnValue([]);

    const result = await listAgentsTool.execute({});

    expect(result.success).toBe(true);
    expect(result.message).toBe('0 agents available');
    expect(result.data?.agents).toEqual([]);
  });

  it('should include activeTasks count', async () => {
    const mockAgent = createMockAgent({
      id: 'busy',
      activeTasks: [createMockTask(), createMockTask()],
    });
    vi.mocked(subAgentRegistry.listEnabled).mockReturnValue([mockAgent]);

    const result = await listAgentsTool.execute({});

    expect(result.data?.agents[0].activeTasks).toBe(2);
  });
});

describe('delegate_task', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct metadata', () => {
    expect(delegateTaskTool.name).toBe('delegate_task');
    expect(delegateTaskTool.parameters.required).toContain('agentId');
    expect(delegateTaskTool.parameters.required).toContain('task');
    expect(delegateTaskTool.parameters.properties).toHaveProperty('context');
    expect(delegateTaskTool.parameters.properties).toHaveProperty('wait');
  });

  it('should fail when agent not found', async () => {
    vi.mocked(subAgentRegistry.get).mockReturnValue(undefined);

    const result = await delegateTaskTool.execute({
      agentId: 'nonexistent',
      task: 'Do something',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Agent not found');
    expect(result.message).toContain('nonexistent');
  });

  it('should fail when agent is disabled', async () => {
    const disabledAgent = createMockAgent({ id: 'disabled', enabled: false });
    vi.mocked(subAgentRegistry.get).mockReturnValue(disabledAgent);

    const result = await delegateTaskTool.execute({
      agentId: 'disabled',
      task: 'Do something',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Agent is disabled');
  });

  it('should fail on invalid context JSON', async () => {
    const agent = createMockAgent({ id: 'twitter' });
    vi.mocked(subAgentRegistry.get).mockReturnValue(agent);

    const result = await delegateTaskTool.execute({
      agentId: 'twitter',
      task: 'Post a tweet',
      context: 'not valid json {{{',
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid context JSON');
  });

  it('should delegate and wait for completed task', async () => {
    const agent = createMockAgent({ id: 'twitter', name: 'Twitter Agent', emoji: '🐦' });
    const task = createMockTask({ id: 'task_456', status: 'pending' });
    const completedTask = { ...task, status: 'completed' as const, result: 'Tweet posted!' };

    vi.mocked(subAgentRegistry.get).mockReturnValue(agent);
    vi.mocked(subAgentRegistry.spawn).mockResolvedValue(task);
    vi.mocked(subAgentRegistry.waitForTask).mockResolvedValue(completedTask);

    const result = await delegateTaskTool.execute({
      agentId: 'twitter',
      task: 'Post a tweet about AI',
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('🐦');
    expect(result.message).toContain('Twitter Agent');
    expect(result.message).toContain('completed');
    expect(result.data?.taskId).toBe('task_456');
    expect(result.data?.result).toBe('Tweet posted!');
    expect(subAgentRegistry.spawn).toHaveBeenCalledWith('twitter', 'Post a tweet about AI', {
      context: undefined,
      notifyOnComplete: false,
    });
    expect(subAgentRegistry.waitForTask).toHaveBeenCalledWith('task_456', 120000);
  });

  it('should handle failed task after waiting', async () => {
    const agent = createMockAgent({ id: 'email' });
    const task = createMockTask({ id: 'task_789' });
    const failedTask = { ...task, status: 'failed' as const, error: 'SMTP error' };

    vi.mocked(subAgentRegistry.get).mockReturnValue(agent);
    vi.mocked(subAgentRegistry.spawn).mockResolvedValue(task);
    vi.mocked(subAgentRegistry.waitForTask).mockResolvedValue(failedTask);

    const result = await delegateTaskTool.execute({
      agentId: 'email',
      task: 'Send an email',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Task failed');
    expect(result.message).toContain('SMTP error');
    expect(result.data?.taskId).toBe('task_789');
  });

  it('should handle task timeout', async () => {
    const agent = createMockAgent({ id: 'slow' });
    const task = createMockTask({ id: 'task_slow' });

    vi.mocked(subAgentRegistry.get).mockReturnValue(agent);
    vi.mocked(subAgentRegistry.spawn).mockResolvedValue(task);
    vi.mocked(subAgentRegistry.waitForTask).mockRejectedValue(new Error('Timeout'));

    const result = await delegateTaskTool.execute({
      agentId: 'slow',
      task: 'Long running task',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('timed out');
    expect(result.data?.taskId).toBe('task_slow');
  });

  it('should not wait when wait=false', async () => {
    const agent = createMockAgent({ id: 'async', name: 'Async Agent' });
    const task = createMockTask({ id: 'task_async' });

    vi.mocked(subAgentRegistry.get).mockReturnValue(agent);
    vi.mocked(subAgentRegistry.spawn).mockResolvedValue(task);

    const result = await delegateTaskTool.execute({
      agentId: 'async',
      task: 'Background task',
      wait: false,
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('Async Agent');
    expect(result.message).toContain("I'll let you know when it's done");
    expect(result.data?.taskId).toBe('task_async');
    expect(result.data?.agentId).toBe('async');
    expect(result.data?.async).toBe(true);
    expect(subAgentRegistry.waitForTask).not.toHaveBeenCalled();
  });

  it('should parse valid context JSON', async () => {
    const agent = createMockAgent({ id: 'context-aware' });
    const task = createMockTask();
    const completedTask = { ...task, status: 'completed' as const, result: 'Done' };

    vi.mocked(subAgentRegistry.get).mockReturnValue(agent);
    vi.mocked(subAgentRegistry.spawn).mockResolvedValue(task);
    vi.mocked(subAgentRegistry.waitForTask).mockResolvedValue(completedTask);

    const contextJson = JSON.stringify({ key: 'value', nested: { a: 1 } });

    await delegateTaskTool.execute({
      agentId: 'context-aware',
      task: 'Task with context',
      context: contextJson,
    });

    expect(subAgentRegistry.spawn).toHaveBeenCalledWith(
      'context-aware',
      'Task with context',
      {
        context: { key: 'value', nested: { a: 1 } },
        notifyOnComplete: false,
      }
    );
  });
});

describe('get_task_status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct metadata', () => {
    expect(getTaskStatusTool.name).toBe('get_task_status');
    expect(getTaskStatusTool.parameters.required).toContain('taskId');
  });

  it('should fail when task not found', async () => {
    vi.mocked(subAgentRegistry.getTask).mockReturnValue(undefined);

    const result = await getTaskStatusTool.execute({ taskId: 'nonexistent' });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Task not found');
    expect(result.message).toContain('nonexistent');
  });

  it('should return pending task status', async () => {
    const task = createMockTask({ status: 'pending' });
    vi.mocked(subAgentRegistry.getTask).mockReturnValue(task);

    const result = await getTaskStatusTool.execute({ taskId: 'task_123' });

    expect(result.success).toBe(true);
    expect(result.message).toBe('Task status: pending');
    expect(result.data?.id).toBe('task_123');
    expect(result.data?.status).toBe('pending');
  });

  it('should return running task status', async () => {
    const task = createMockTask({
      status: 'running',
      startedAt: new Date('2024-01-01T00:01:00Z'),
    });
    vi.mocked(subAgentRegistry.getTask).mockReturnValue(task);

    const result = await getTaskStatusTool.execute({ taskId: 'task_123' });

    expect(result.success).toBe(true);
    expect(result.message).toBe('Task status: running');
    expect(result.data?.status).toBe('running');
  });

  it('should return completed task with result', async () => {
    const task = createMockTask({
      status: 'completed',
      result: 'Task completed successfully!',
      completedAt: new Date('2024-01-01T00:02:00Z'),
    });
    vi.mocked(subAgentRegistry.getTask).mockReturnValue(task);

    const result = await getTaskStatusTool.execute({ taskId: 'task_123' });

    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('completed');
    expect(result.data?.result).toBe('Task completed successfully!');
    expect(result.data?.completedAt).toBeDefined();
  });

  it('should return failed task with error', async () => {
    const task = createMockTask({
      status: 'failed',
      error: 'Something went wrong',
      completedAt: new Date('2024-01-01T00:02:00Z'),
    });
    vi.mocked(subAgentRegistry.getTask).mockReturnValue(task);

    const result = await getTaskStatusTool.execute({ taskId: 'task_123' });

    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('failed');
    expect(result.data?.error).toBe('Something went wrong');
  });
});

describe('agent_info', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct metadata', () => {
    expect(agentInfoTool.name).toBe('agent_info');
    expect(agentInfoTool.parameters.required).toContain('agentId');
  });

  it('should fail when agent not found', async () => {
    vi.mocked(subAgentRegistry.get).mockReturnValue(undefined);

    const result = await agentInfoTool.execute({ agentId: 'ghost' });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Agent not found');
  });

  it('should return detailed agent info', async () => {
    const agent = createMockAgent({
      id: 'twitter',
      name: 'Twitter Agent',
      emoji: '🐦',
      displayName: 'Twitter Expert',
      description: 'Handles Twitter posts',
      model: 'gpt-4o',
      activeTasks: [createMockTask()],
      completedTasks: [createMockTask(), createMockTask()],
    });
    vi.mocked(subAgentRegistry.get).mockReturnValue(agent);

    const result = await agentInfoTool.execute({ agentId: 'twitter' });

    expect(result.success).toBe(true);
    expect(result.message).toBe('🐦 Twitter Agent');
    expect(result.data).toMatchObject({
      id: 'twitter',
      identity: {
        name: 'Twitter Agent',
        emoji: '🐦',
        persona: 'a test persona',
        voice: 'friendly',
      },
      specialty: {
        name: 'Twitter Expert',
        description: 'Handles Twitter posts',
        tools: ['tool1', 'tool2'],
      },
      enabled: true,
      model: 'gpt-4o',
      activeTasks: 1,
      completedTasks: 2,
    });
  });

  it('should show default model when not set', async () => {
    const agent = createMockAgent({ id: 'default-model', model: undefined });
    vi.mocked(subAgentRegistry.get).mockReturnValue(agent);

    const result = await agentInfoTool.execute({ agentId: 'default-model' });

    expect(result.data?.model).toBe('default');
  });
});

describe('set_agent_model', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct metadata', () => {
    expect(setAgentModelTool.name).toBe('set_agent_model');
    expect(setAgentModelTool.parameters.required).toContain('agentId');
    expect(setAgentModelTool.parameters.required).toContain('model');
  });

  it('should fail when agent not found', async () => {
    vi.mocked(subAgentRegistry.get).mockReturnValue(undefined);

    const result = await setAgentModelTool.execute({
      agentId: 'ghost',
      model: 'gpt-4o',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Agent not found');
  });

  it('should set a specific model', async () => {
    const agent = createMockAgent({ id: 'twitter', name: 'Twitter Agent', emoji: '🐦' });
    vi.mocked(subAgentRegistry.get).mockReturnValue(agent);
    vi.mocked(subAgentRegistry.setModel).mockReturnValue(true);

    const result = await setAgentModelTool.execute({
      agentId: 'twitter',
      model: 'claude-3-haiku',
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('🐦');
    expect(result.message).toContain('Twitter Agent');
    expect(result.message).toContain('claude-3-haiku');
    expect(result.data?.model).toBe('claude-3-haiku');
    expect(subAgentRegistry.setModel).toHaveBeenCalledWith('twitter', 'claude-3-haiku');
  });

  it('should reset to default model', async () => {
    const agent = createMockAgent({ id: 'email', name: 'Email Agent', emoji: '📧' });
    vi.mocked(subAgentRegistry.get).mockReturnValue(agent);
    vi.mocked(subAgentRegistry.setModel).mockReturnValue(true);

    const result = await setAgentModelTool.execute({
      agentId: 'email',
      model: 'default',
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('default (global)');
    expect(result.data?.model).toBe('default (global)');
    expect(subAgentRegistry.setModel).toHaveBeenCalledWith('email', undefined);
  });

  it('should fail when setModel returns false', async () => {
    const agent = createMockAgent({ id: 'broken' });
    vi.mocked(subAgentRegistry.get).mockReturnValue(agent);
    vi.mocked(subAgentRegistry.setModel).mockReturnValue(false);

    const result = await setAgentModelTool.execute({
      agentId: 'broken',
      model: 'gpt-4o',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Failed to update model');
  });
});

describe('list_agent_models', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct metadata', () => {
    expect(listAgentModelsTool.name).toBe('list_agent_models');
    expect(listAgentModelsTool.parameters.properties).toEqual({});
  });

  it('should list all agent models', async () => {
    const mockAgents = [
      createMockAgent({ id: 'twitter', name: 'Twitter', emoji: '🐦', model: 'gpt-4o' }),
      createMockAgent({ id: 'email', name: 'Email', emoji: '📧', model: 'claude-3-haiku' }),
      createMockAgent({ id: 'creative', name: 'Creative', emoji: '🎨', model: undefined }),
    ];
    vi.mocked(subAgentRegistry.listEnabled).mockReturnValue(mockAgents);

    const result = await listAgentModelsTool.execute();

    expect(result.success).toBe(true);
    expect(result.message).toContain('Agent models:');
    expect(result.message).toContain('🐦 Twitter: gpt-4o');
    expect(result.message).toContain('📧 Email: claude-3-haiku');
    expect(result.message).toContain('🎨 Creative: default');
    expect(result.data?.agents).toHaveLength(3);
    expect(result.data?.agents[0]).toMatchObject({
      id: 'twitter',
      name: 'Twitter',
      emoji: '🐦',
      model: 'gpt-4o',
    });
    expect(result.data?.agents[2].model).toBe('default');
  });

  it('should handle empty agent list', async () => {
    vi.mocked(subAgentRegistry.listEnabled).mockReturnValue([]);

    const result = await listAgentModelsTool.execute();

    expect(result.success).toBe(true);
    expect(result.data?.agents).toEqual([]);
  });
});

describe('recommend_agent_model', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct metadata', () => {
    expect(recommendAgentModelTool.name).toBe('recommend_agent_model');
    expect(recommendAgentModelTool.parameters.properties).toHaveProperty('agentId');
  });

  it('should recommend model for specific agent', async () => {
    const agent = createMockAgent({ id: 'twitter', name: 'Twitter Agent', emoji: '🐦', model: 'gpt-4o' });
    vi.mocked(subAgentRegistry.get).mockReturnValue(agent);

    const result = await recommendAgentModelTool.execute({ agentId: 'twitter' });

    expect(result.success).toBe(true);
    expect(result.message).toContain('🐦');
    expect(result.message).toContain('Twitter Agent');
    expect(result.message).toContain('Recommended:');
    expect(result.data?.agentId).toBe('twitter');
    expect(result.data?.recommended).toBeDefined();
  });

  it('should fail when agent not found', async () => {
    vi.mocked(subAgentRegistry.get).mockReturnValue(undefined);

    const result = await recommendAgentModelTool.execute({ agentId: 'nonexistent' });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Agent not found');
  });

  it('should return default recommendation for unknown agent specialty', async () => {
    const agent = createMockAgent({ id: 'unknown-specialty', name: 'Unknown', emoji: '❓' });
    vi.mocked(subAgentRegistry.get).mockReturnValue(agent);

    const result = await recommendAgentModelTool.execute({ agentId: 'unknown-specialty' });

    expect(result.success).toBe(true);
    expect(result.message).toContain('No specific recommendation');
    expect(result.data?.recommended).toBe('default');
  });

  it('should indicate when current model is optimal', async () => {
    // gpt-4o-mini is the recommended model for twitter
    const agent = createMockAgent({ id: 'twitter', name: 'Twitter', emoji: '🐦', model: 'gpt-4o-mini' });
    vi.mocked(subAgentRegistry.get).mockReturnValue(agent);

    const result = await recommendAgentModelTool.execute({ agentId: 'twitter' });

    expect(result.success).toBe(true);
    expect(result.data?.isOptimal).toBe(true);
    expect(result.message).toContain('✓');
  });

  it('should recommend for all agents when no agentId specified', async () => {
    const mockAgents = [
      createMockAgent({ id: 'twitter', name: 'Twitter', emoji: '🐦', model: 'gpt-4o-mini' }),
      createMockAgent({ id: 'linkedin', name: 'LinkedIn', emoji: '💼', model: 'gpt-4o' }),
      createMockAgent({ id: 'unknown', name: 'Unknown', emoji: '❓', model: undefined }),
    ];
    vi.mocked(subAgentRegistry.listEnabled).mockReturnValue(mockAgents);

    const result = await recommendAgentModelTool.execute({});

    expect(result.success).toBe(true);
    expect(result.message).toContain('Agent Model Recommendations');
    expect(result.data?.recommendations).toHaveLength(3);
    // Twitter with optimal model
    expect(result.data?.recommendations[0].isOptimal).toBe(true);
    // LinkedIn with non-optimal model (should recommend claude-3-5-sonnet)
    expect(result.data?.recommendations[1].isOptimal).toBe(false);
    expect(result.data?.recommendations[1].recommended).toBe('claude-3-5-sonnet');
  });

  it('should show optimization needed count when applicable', async () => {
    const mockAgents = [
      createMockAgent({ id: 'twitter', name: 'Twitter', emoji: '🐦', model: 'gpt-4o' }), // not optimal
      createMockAgent({ id: 'email', name: 'Email', emoji: '📧', model: 'gpt-4o' }), // not optimal
    ];
    vi.mocked(subAgentRegistry.listEnabled).mockReturnValue(mockAgents);

    const result = await recommendAgentModelTool.execute({});

    expect(result.success).toBe(true);
    expect(result.message).toContain('could be optimized');
  });

  it('should show all optimal message when all agents are using optimal models', async () => {
    const mockAgents = [
      createMockAgent({ id: 'twitter', name: 'Twitter', emoji: '🐦', model: 'gpt-4o-mini' }),
    ];
    vi.mocked(subAgentRegistry.listEnabled).mockReturnValue(mockAgents);

    const result = await recommendAgentModelTool.execute({});

    expect(result.success).toBe(true);
    expect(result.message).toContain('All agents are using optimal models');
  });

  it('should include alternatives in recommendation for specific agent', async () => {
    const agent = createMockAgent({ id: 'linkedin', name: 'LinkedIn', emoji: '💼', model: 'gpt-4o' });
    vi.mocked(subAgentRegistry.get).mockReturnValue(agent);

    const result = await recommendAgentModelTool.execute({ agentId: 'linkedin' });

    expect(result.success).toBe(true);
    expect(result.message).toContain('Alternatives:');
    expect(result.data?.alternatives).toBeDefined();
    expect(result.data?.alternatives.length).toBeGreaterThan(0);
  });
});

describe('create_agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct metadata', () => {
    expect(createAgentTool.name).toBe('create_agent');
    expect(createAgentTool.parameters.required).toEqual([
      'id', 'name', 'emoji', 'specialtyName', 'specialtyDescription', 'systemPrompt'
    ]);
    expect(createAgentTool.parameters.properties).toHaveProperty('tools');
    expect(createAgentTool.parameters.properties).toHaveProperty('model');
    expect(createAgentTool.parameters.properties).toHaveProperty('voice');
  });

  it('should fail when agent already exists', async () => {
    const existingAgent = createMockAgent({ id: 'existing' });
    vi.mocked(subAgentRegistry.get).mockReturnValue(existingAgent);

    const result = await createAgentTool.execute({
      id: 'existing',
      name: 'New Agent',
      emoji: '🆕',
      specialtyName: 'New Specialty',
      specialtyDescription: 'A new specialty',
      systemPrompt: 'You are new.',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Agent already exists');
  });

  it('should create agent with required fields only', async () => {
    vi.mocked(subAgentRegistry.get).mockReturnValue(undefined);
    vi.mocked(loader.createCustomAgent).mockResolvedValue(undefined);

    const result = await createAgentTool.execute({
      id: 'minimal',
      name: 'Minimal Agent',
      emoji: '🔹',
      specialtyName: 'Minimal',
      specialtyDescription: 'A minimal agent',
      systemPrompt: 'You are minimal.',
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('🔹');
    expect(result.message).toContain('Minimal Agent');
    expect(result.message).toContain('created and ready');
    expect(result.data?.agentId).toBe('minimal');
    expect(result.data?.manifest).toMatchObject({
      id: 'minimal',
      version: '1.0.0',
      identity: {
        name: 'Minimal Agent',
        emoji: '🔹',
        voice: 'friendly', // default
      },
      specialty: {
        displayName: 'Minimal',
        description: 'A minimal agent',
        systemPrompt: 'You are minimal.',
      },
    });
    expect(loader.createCustomAgent).toHaveBeenCalled();
  });

  it('should create agent with all optional fields', async () => {
    vi.mocked(subAgentRegistry.get).mockReturnValue(undefined);
    vi.mocked(loader.createCustomAgent).mockResolvedValue(undefined);

    const result = await createAgentTool.execute({
      id: 'full-agent',
      name: 'Full Agent',
      emoji: '🌟',
      persona: 'a witty marketing expert',
      voice: 'playful',
      specialtyName: 'Full Marketing',
      specialtyDescription: 'Handles all marketing tasks',
      systemPrompt: 'You are a full marketing agent.',
      tools: 'post_tweet, send_email, search_web',
      model: 'gpt-4o-mini',
    });

    expect(result.success).toBe(true);
    expect(result.data?.manifest).toMatchObject({
      id: 'full-agent',
      identity: {
        name: 'Full Agent',
        emoji: '🌟',
        persona: 'a witty marketing expert',
        voice: 'playful',
      },
      specialty: {
        displayName: 'Full Marketing',
        description: 'Handles all marketing tasks',
        systemPrompt: 'You are a full marketing agent.',
        tools: ['post_tweet', 'send_email', 'search_web'],
      },
      defaultModel: 'gpt-4o-mini',
    });
  });

  it('should parse tools string correctly', async () => {
    vi.mocked(subAgentRegistry.get).mockReturnValue(undefined);
    vi.mocked(loader.createCustomAgent).mockResolvedValue(undefined);

    const result = await createAgentTool.execute({
      id: 'tools-test',
      name: 'Tools Test',
      emoji: '🔧',
      specialtyName: 'Tools',
      specialtyDescription: 'Testing tools parsing',
      systemPrompt: 'Test.',
      tools: '  tool1 , tool2,tool3  ',  // various whitespace
    });

    expect(result.data?.manifest.specialty.tools).toEqual(['tool1', 'tool2', 'tool3']);
  });

  it('should handle empty tools string as undefined', async () => {
    vi.mocked(subAgentRegistry.get).mockReturnValue(undefined);
    vi.mocked(loader.createCustomAgent).mockResolvedValue(undefined);

    const result = await createAgentTool.execute({
      id: 'no-tools',
      name: 'No Tools',
      emoji: '❌',
      specialtyName: 'No Tools',
      specialtyDescription: 'No specific tools',
      systemPrompt: 'Test.',
      tools: '',
    });

    // Empty string is falsy, so tools becomes undefined (= all tools)
    expect(result.data?.manifest.specialty.tools).toBeUndefined();
  });

  it('should use friendly voice as default', async () => {
    vi.mocked(subAgentRegistry.get).mockReturnValue(undefined);
    vi.mocked(loader.createCustomAgent).mockResolvedValue(undefined);

    const result = await createAgentTool.execute({
      id: 'default-voice',
      name: 'Default Voice',
      emoji: '🎤',
      specialtyName: 'Voice Test',
      specialtyDescription: 'Testing default voice',
      systemPrompt: 'Test.',
    });

    expect(result.data?.manifest.identity.voice).toBe('friendly');
  });
});

describe('Tool integration patterns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should follow list -> delegate -> status workflow', async () => {
    // 1. List agents
    const mockAgents = [createMockAgent({ id: 'twitter', name: 'Twitter Agent', emoji: '🐦' })];
    vi.mocked(subAgentRegistry.listEnabled).mockReturnValue(mockAgents);
    
    const listResult = await listAgentsTool.execute({});
    expect(listResult.success).toBe(true);
    expect(listResult.data?.agents[0].id).toBe('twitter');

    // 2. Delegate task (no wait)
    const agent = mockAgents[0];
    const task = createMockTask({ id: 'workflow_task' });
    vi.mocked(subAgentRegistry.get).mockReturnValue(agent);
    vi.mocked(subAgentRegistry.spawn).mockResolvedValue(task);

    const delegateResult = await delegateTaskTool.execute({
      agentId: 'twitter',
      task: 'Post a tweet',
      wait: false,
    });
    expect(delegateResult.success).toBe(true);
    const taskId = delegateResult.data?.taskId;

    // 3. Check status
    const runningTask = { ...task, status: 'running' as const };
    vi.mocked(subAgentRegistry.getTask).mockReturnValue(runningTask);
    
    const statusResult = await getTaskStatusTool.execute({ taskId });
    expect(statusResult.success).toBe(true);
    expect(statusResult.data?.status).toBe('running');
  });

  it('should follow create -> info -> set_model workflow', async () => {
    // 1. Create agent
    vi.mocked(subAgentRegistry.get).mockReturnValue(undefined);
    vi.mocked(loader.createCustomAgent).mockResolvedValue(undefined);

    const createResult = await createAgentTool.execute({
      id: 'new-agent',
      name: 'New Agent',
      emoji: '✨',
      specialtyName: 'New',
      specialtyDescription: 'A new agent',
      systemPrompt: 'You are new.',
    });
    expect(createResult.success).toBe(true);

    // 2. Get info (agent now exists)
    const newAgent = createMockAgent({
      id: 'new-agent',
      name: 'New Agent',
      emoji: '✨',
    });
    vi.mocked(subAgentRegistry.get).mockReturnValue(newAgent);

    const infoResult = await agentInfoTool.execute({ agentId: 'new-agent' });
    expect(infoResult.success).toBe(true);
    expect(infoResult.data?.model).toBe('default');

    // 3. Set model
    vi.mocked(subAgentRegistry.setModel).mockReturnValue(true);
    
    const modelResult = await setAgentModelTool.execute({
      agentId: 'new-agent',
      model: 'gpt-4o',
    });
    expect(modelResult.success).toBe(true);
    expect(modelResult.data?.model).toBe('gpt-4o');
  });
});
