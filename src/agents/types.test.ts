/**
 * Agent Types Tests
 */

import { describe, it, expect } from 'vitest';
import { 
  AgentIdentity, 
  AgentSpecialty, 
  SubAgentConfig, 
  AgentTask, 
  SubAgentState,
  SubAgentManifest,
  AgentVoice,
  BuiltinSpecialty 
} from './types.js';

describe('AgentVoice', () => {
  it('should support all voice types', () => {
    const voices: AgentVoice[] = ['professional', 'casual', 'friendly', 'playful'];
    
    for (const voice of voices) {
      const identity: AgentIdentity = {
        name: 'Test',
        emoji: '🤖',
        voice,
      };
      expect(identity.voice).toBe(voice);
    }
  });
});

describe('AgentIdentity', () => {
  it('should create identity with required fields', () => {
    const identity: AgentIdentity = {
      name: 'Test Agent',
      emoji: '🤖',
    };

    expect(identity.name).toBe('Test Agent');
    expect(identity.emoji).toBe('🤖');
  });

  it('should create identity with all fields', () => {
    const identity: AgentIdentity = {
      name: 'Full Agent',
      emoji: '🎯',
      persona: 'an expert marketing strategist',
      voice: 'professional',
    };

    expect(identity.name).toBe('Full Agent');
    expect(identity.emoji).toBe('🎯');
    expect(identity.persona).toBe('an expert marketing strategist');
    expect(identity.voice).toBe('professional');
  });
});

describe('AgentSpecialty', () => {
  it('should create specialty with required fields', () => {
    const specialty: AgentSpecialty = {
      id: 'marketing',
      displayName: 'Marketing Expert',
      description: 'Specializes in marketing tasks',
      systemPrompt: 'You are a marketing expert.',
    };

    expect(specialty.id).toBe('marketing');
    expect(specialty.displayName).toBe('Marketing Expert');
    expect(specialty.description).toBe('Specializes in marketing tasks');
    expect(specialty.systemPrompt).toBe('You are a marketing expert.');
  });

  it('should create specialty with optional tools', () => {
    const specialty: AgentSpecialty = {
      id: 'social',
      displayName: 'Social Media Expert',
      description: 'Social media specialist',
      systemPrompt: 'You handle social media.',
      tools: ['post_tweet', 'post_linkedin'],
      requiredTools: ['search_skills'],
    };

    expect(specialty.tools).toEqual(['post_tweet', 'post_linkedin']);
    expect(specialty.requiredTools).toEqual(['search_skills']);
  });
});

describe('SubAgentConfig', () => {
  it('should create config with required fields', () => {
    const config: SubAgentConfig = {
      identity: {
        name: 'Agent',
        emoji: '⚡',
      },
      specialty: {
        id: 'test',
        displayName: 'Test',
        description: 'Testing',
        systemPrompt: 'You test.',
      },
      enabled: true,
    };

    expect(config.identity.name).toBe('Agent');
    expect(config.specialty.id).toBe('test');
    expect(config.enabled).toBe(true);
  });

  it('should create config with all optional fields', () => {
    const config: SubAgentConfig = {
      identity: {
        name: 'Full Agent',
        emoji: '🚀',
        persona: 'A full-featured agent',
        voice: 'playful',
      },
      specialty: {
        id: 'full',
        displayName: 'Full',
        description: 'Full description',
        systemPrompt: 'Full prompt.',
        tools: ['tool1', 'tool2'],
        requiredTools: ['required1'],
      },
      model: 'claude-3-opus',
      enabled: true,
      maxConcurrent: 5,
    };

    expect(config.model).toBe('claude-3-opus');
    expect(config.maxConcurrent).toBe(5);
  });
});

describe('AgentTask', () => {
  it('should create pending task', () => {
    const task: AgentTask = {
      id: 'task_123',
      agentId: 'marketing',
      prompt: 'Write a tweet',
      status: 'pending',
      createdAt: new Date('2024-01-01T00:00:00Z'),
    };

    expect(task.id).toBe('task_123');
    expect(task.agentId).toBe('marketing');
    expect(task.prompt).toBe('Write a tweet');
    expect(task.status).toBe('pending');
    expect(task.createdAt).toEqual(new Date('2024-01-01T00:00:00Z'));
  });

  it('should create task with context', () => {
    const task: AgentTask = {
      id: 'task_456',
      agentId: 'email',
      prompt: 'Draft an email',
      context: {
        recipient: 'client@example.com',
        topic: 'Product launch',
      },
      status: 'pending',
      createdAt: new Date(),
    };

    expect(task.context).toEqual({
      recipient: 'client@example.com',
      topic: 'Product launch',
    });
  });

  it('should support all status values', () => {
    const statuses: Array<'pending' | 'running' | 'completed' | 'failed'> = [
      'pending', 'running', 'completed', 'failed'
    ];

    for (const status of statuses) {
      const task: AgentTask = {
        id: 'task',
        agentId: 'agent',
        prompt: 'test',
        status,
        createdAt: new Date(),
      };
      expect(task.status).toBe(status);
    }
  });

  it('should handle completed task', () => {
    const task: AgentTask = {
      id: 'task_completed',
      agentId: 'creative',
      prompt: 'Generate image',
      status: 'completed',
      result: 'Image generated successfully: /path/to/image.png',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      startedAt: new Date('2024-01-01T00:00:05Z'),
      completedAt: new Date('2024-01-01T00:00:30Z'),
    };

    expect(task.status).toBe('completed');
    expect(task.result).toContain('Image generated');
    expect(task.startedAt).toBeDefined();
    expect(task.completedAt).toBeDefined();
  });

  it('should handle failed task', () => {
    const task: AgentTask = {
      id: 'task_failed',
      agentId: 'researcher',
      prompt: 'Research topic',
      status: 'failed',
      error: 'API rate limit exceeded',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      startedAt: new Date('2024-01-01T00:00:05Z'),
      completedAt: new Date('2024-01-01T00:00:10Z'),
    };

    expect(task.status).toBe('failed');
    expect(task.error).toBe('API rate limit exceeded');
  });
});

describe('SubAgentState', () => {
  it('should create agent state', () => {
    const state: SubAgentState = {
      config: {
        identity: { name: 'Agent', emoji: '🤖' },
        specialty: {
          id: 'test',
          displayName: 'Test',
          description: 'Testing',
          systemPrompt: 'Test.',
        },
        enabled: true,
      },
      activeTasks: [],
      completedTasks: [],
      isRunning: true,
    };

    expect(state.config.identity.name).toBe('Agent');
    expect(state.activeTasks).toEqual([]);
    expect(state.completedTasks).toEqual([]);
    expect(state.isRunning).toBe(true);
  });

  it('should track active and completed tasks', () => {
    const activeTask: AgentTask = {
      id: 'active_1',
      agentId: 'agent',
      prompt: 'Active task',
      status: 'running',
      createdAt: new Date(),
      startedAt: new Date(),
    };

    const completedTask: AgentTask = {
      id: 'completed_1',
      agentId: 'agent',
      prompt: 'Completed task',
      status: 'completed',
      result: 'Done',
      createdAt: new Date(),
      startedAt: new Date(),
      completedAt: new Date(),
    };

    const state: SubAgentState = {
      config: {
        identity: { name: 'Agent', emoji: '🤖' },
        specialty: {
          id: 'test',
          displayName: 'Test',
          description: 'Testing',
          systemPrompt: 'Test.',
        },
        enabled: true,
      },
      activeTasks: [activeTask],
      completedTasks: [completedTask],
      isRunning: true,
    };

    expect(state.activeTasks).toHaveLength(1);
    expect(state.completedTasks).toHaveLength(1);
  });
});

describe('BuiltinSpecialty', () => {
  it('should include expected specialties', () => {
    const specialties: BuiltinSpecialty[] = [
      'twitter',
      'linkedin',
      'email',
      'creative',
      'analyst',
      'researcher',
      'producthunt',
    ];

    // Just verify these are valid BuiltinSpecialty values
    expect(specialties).toHaveLength(7);
  });
});

describe('SubAgentManifest', () => {
  it('should create manifest with required fields', () => {
    const manifest: SubAgentManifest = {
      id: 'custom-agent',
      version: '1.0.0',
      identity: {
        name: 'Custom Agent',
        emoji: '🎯',
      },
      specialty: {
        displayName: 'Custom Specialty',
        description: 'A custom specialty',
        systemPrompt: 'You are a custom agent.',
      },
    };

    expect(manifest.id).toBe('custom-agent');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.identity.name).toBe('Custom Agent');
    expect(manifest.specialty.displayName).toBe('Custom Specialty');
  });

  it('should create manifest with all optional fields', () => {
    const manifest: SubAgentManifest = {
      id: 'full-agent',
      version: '2.0.0',
      identity: {
        name: 'Full Agent',
        emoji: '🚀',
        persona: 'A fully featured agent',
        voice: 'professional',
      },
      specialty: {
        displayName: 'Full Specialty',
        description: 'Full description',
        systemPrompt: 'Full system prompt.',
        tools: ['tool1', 'tool2'],
        requiredTools: ['required'],
      },
      defaultModel: 'gpt-4-turbo',
      author: 'Test Author',
      description: 'A test agent manifest',
    };

    expect(manifest.defaultModel).toBe('gpt-4-turbo');
    expect(manifest.author).toBe('Test Author');
    expect(manifest.description).toBe('A test agent manifest');
    expect(manifest.specialty.tools).toEqual(['tool1', 'tool2']);
  });

  it('should not require id in specialty (omit)', () => {
    const manifest: SubAgentManifest = {
      id: 'test-agent',
      version: '1.0.0',
      identity: { name: 'Test', emoji: '✅' },
      specialty: {
        displayName: 'Test',
        description: 'Test',
        systemPrompt: 'Test.',
        // Note: no 'id' field here - Omit<AgentSpecialty, 'id'>
      },
    };

    expect(manifest.specialty).not.toHaveProperty('id');
  });
});

describe('Agent workflow scenarios', () => {
  it('should represent agent lifecycle', () => {
    // 1. Create config
    const config: SubAgentConfig = {
      identity: { name: 'Lifecycle Agent', emoji: '🔄' },
      specialty: {
        id: 'lifecycle',
        displayName: 'Lifecycle',
        description: 'Testing lifecycle',
        systemPrompt: 'Test lifecycle.',
      },
      enabled: true,
    };

    // 2. Create state
    const state: SubAgentState = {
      config,
      activeTasks: [],
      completedTasks: [],
      isRunning: false,
    };

    expect(state.isRunning).toBe(false);

    // 3. Start agent
    state.isRunning = true;
    expect(state.isRunning).toBe(true);

    // 4. Add task
    const task: AgentTask = {
      id: 'task_1',
      agentId: 'lifecycle',
      prompt: 'Do something',
      status: 'pending',
      createdAt: new Date(),
    };
    state.activeTasks.push(task);
    expect(state.activeTasks).toHaveLength(1);

    // 5. Complete task
    task.status = 'completed';
    task.result = 'Done';
    task.completedAt = new Date();
    state.activeTasks = [];
    state.completedTasks.push(task);
    expect(state.activeTasks).toHaveLength(0);
    expect(state.completedTasks).toHaveLength(1);

    // 6. Stop agent
    state.isRunning = false;
    expect(state.isRunning).toBe(false);
  });
});
