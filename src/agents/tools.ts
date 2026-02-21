/**
 * Sub-Agent Tools
 * Tools for spawning and managing sub-agents
 */

import { Tool, ToolResult } from '../tools/types.js';
import { subAgentRegistry } from './registry.js';
import { createCustomAgent } from './loader.js';
import { SubAgentManifest } from './types.js';

// ============ List Agents ============
export const listAgentsTool: Tool = {
  name: 'list_agents',
  description: 'List all available sub-agents and their specialties',
  parameters: {
    type: 'object',
    properties: {
      showDisabled: {
        type: 'boolean',
        description: 'Include disabled agents',
      },
    },
  },

  async execute(params): Promise<ToolResult> {
    const agents = params?.showDisabled 
      ? subAgentRegistry.list()
      : subAgentRegistry.listEnabled();

    const agentList = agents.map(a => ({
      id: a.config.specialty.id,
      name: a.config.identity.name,
      emoji: a.config.identity.emoji,
      specialty: a.config.specialty.displayName,
      enabled: a.config.enabled,
      activeTasks: a.activeTasks.length,
    }));

    return {
      success: true,
      message: `${agentList.length} agents available`,
      data: { agents: agentList },
    };
  },
};

// ============ Delegate Task ============
export const delegateTaskTool: Tool = {
  name: 'delegate_task',
  description: 'Delegate a task to a specialized sub-agent. Use this when a task matches an agent\'s expertise.',
  parameters: {
    type: 'object',
    properties: {
      agentId: {
        type: 'string',
        description: 'Agent ID to delegate to (e.g., "twitter", "email", "creative")',
      },
      task: {
        type: 'string',
        description: 'The task description for the agent',
      },
      context: {
        type: 'string',
        description: 'Additional context as JSON (optional)',
      },
      wait: {
        type: 'boolean',
        description: 'Wait for the task to complete (default: true)',
      },
    },
    required: ['agentId', 'task'],
  },

  async execute(params): Promise<ToolResult> {
    const agent = subAgentRegistry.get(params.agentId);
    if (!agent) {
      return {
        success: false,
        message: `Agent not found: ${params.agentId}. Use list_agents to see available agents.`,
      };
    }

    if (!agent.config.enabled) {
      return {
        success: false,
        message: `Agent is disabled: ${params.agentId}`,
      };
    }

    // Parse context if provided
    let context: Record<string, unknown> | undefined;
    if (params.context) {
      try {
        context = JSON.parse(params.context);
      } catch {
        return { success: false, message: 'Invalid context JSON' };
      }
    }

    // Spawn the task
    const task = await subAgentRegistry.spawn(params.agentId, params.task, context);

    // Wait for completion if requested (default: true)
    if (params.wait !== false) {
      try {
        const completed = await subAgentRegistry.waitForTask(task.id, 120000); // 2 min timeout
        
        if (completed.status === 'completed') {
          return {
            success: true,
            message: `${agent.config.identity.emoji} ${agent.config.identity.name} completed the task`,
            data: {
              taskId: task.id,
              agentName: agent.config.identity.name,
              result: completed.result,
            },
          };
        } else {
          return {
            success: false,
            message: `Task failed: ${completed.error}`,
            data: { taskId: task.id },
          };
        }
      } catch (err) {
        return {
          success: false,
          message: `Task timed out. Check status with get_task_status.`,
          data: { taskId: task.id },
        };
      }
    }

    return {
      success: true,
      message: `Task delegated to ${agent.config.identity.name}`,
      data: {
        taskId: task.id,
        agentId: params.agentId,
        agentName: agent.config.identity.name,
      },
    };
  },
};

// ============ Get Task Status ============
export const getTaskStatusTool: Tool = {
  name: 'get_task_status',
  description: 'Check the status of a delegated task',
  parameters: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'The task ID to check',
      },
    },
    required: ['taskId'],
  },

  async execute(params): Promise<ToolResult> {
    const task = subAgentRegistry.getTask(params.taskId);
    
    if (!task) {
      return {
        success: false,
        message: `Task not found: ${params.taskId}`,
      };
    }

    return {
      success: true,
      message: `Task status: ${task.status}`,
      data: {
        id: task.id,
        agentId: task.agentId,
        status: task.status,
        result: task.result,
        error: task.error,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
      },
    };
  },
};

// ============ Agent Info ============
export const agentInfoTool: Tool = {
  name: 'agent_info',
  description: 'Get detailed information about a specific sub-agent',
  parameters: {
    type: 'object',
    properties: {
      agentId: {
        type: 'string',
        description: 'Agent ID',
      },
    },
    required: ['agentId'],
  },

  async execute(params): Promise<ToolResult> {
    const agent = subAgentRegistry.get(params.agentId);
    
    if (!agent) {
      return {
        success: false,
        message: `Agent not found: ${params.agentId}`,
      };
    }

    return {
      success: true,
      message: `${agent.config.identity.emoji} ${agent.config.identity.name}`,
      data: {
        id: agent.config.specialty.id,
        identity: agent.config.identity,
        specialty: {
          name: agent.config.specialty.displayName,
          description: agent.config.specialty.description,
          tools: agent.config.specialty.tools,
        },
        enabled: agent.config.enabled,
        model: agent.config.model || 'default',
        activeTasks: agent.activeTasks.length,
        completedTasks: agent.completedTasks.length,
      },
    };
  },
};

// ============ Set Agent Model ============
export const setAgentModelTool: Tool = {
  name: 'set_agent_model',
  description: 'Set or change the AI model used by a specific sub-agent. Use "default" to reset to the global model.',
  parameters: {
    type: 'object',
    properties: {
      agentId: {
        type: 'string',
        description: 'Agent ID (e.g., "twitter", "creative", "email")',
      },
      model: {
        type: 'string',
        description: 'Model to use (e.g., "gpt-4o-mini", "claude-3-haiku", "gemini-2.0-flash") or "default"',
      },
    },
    required: ['agentId', 'model'],
  },

  async execute(params): Promise<ToolResult> {
    const agent = subAgentRegistry.get(params.agentId);
    if (!agent) {
      return {
        success: false,
        message: `Agent not found: ${params.agentId}. Use list_agents to see available agents.`,
      };
    }

    const newModel = params.model === 'default' ? undefined : params.model;
    const success = subAgentRegistry.setModel(params.agentId, newModel);

    if (!success) {
      return {
        success: false,
        message: `Failed to update model for ${params.agentId}`,
      };
    }

    const displayModel = newModel || 'default (global)';
    return {
      success: true,
      message: `${agent.config.identity.emoji} ${agent.config.identity.name} now uses: ${displayModel}`,
      data: {
        agentId: params.agentId,
        model: displayModel,
      },
    };
  },
};

// ============ List Agent Models ============
export const listAgentModelsTool: Tool = {
  name: 'list_agent_models',
  description: 'Show which model each sub-agent is configured to use',
  parameters: {
    type: 'object',
    properties: {},
  },

  async execute(): Promise<ToolResult> {
    const agents = subAgentRegistry.listEnabled();
    
    const modelConfig = agents.map(a => ({
      id: a.config.specialty.id,
      name: a.config.identity.name,
      emoji: a.config.identity.emoji,
      model: a.config.model || 'default',
    }));

    const formatted = modelConfig
      .map(a => `${a.emoji} ${a.name}: ${a.model}`)
      .join('\n');

    return {
      success: true,
      message: `Agent models:\n${formatted}`,
      data: { agents: modelConfig },
    };
  },
};

// ============ Create Custom Agent ============
export const createAgentTool: Tool = {
  name: 'create_agent',
  description: 'Create a new custom sub-agent with a specific personality and expertise',
  parameters: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Unique agent ID (lowercase, no spaces)',
      },
      name: {
        type: 'string',
        description: 'Agent display name',
      },
      emoji: {
        type: 'string',
        description: 'Agent emoji',
      },
      persona: {
        type: 'string',
        description: 'Persona description (e.g., "a sarcastic copywriter")',
      },
      voice: {
        type: 'string',
        enum: ['professional', 'casual', 'friendly', 'playful'],
        description: 'Communication style',
      },
      specialtyName: {
        type: 'string',
        description: 'Specialty display name',
      },
      specialtyDescription: {
        type: 'string',
        description: 'What this agent specializes in',
      },
      systemPrompt: {
        type: 'string',
        description: 'Detailed system prompt for the agent\'s expertise',
      },
      tools: {
        type: 'string',
        description: 'Comma-separated list of tool names this agent can use (empty = all)',
      },
      model: {
        type: 'string',
        description: 'AI model to use for this agent (optional, defaults to global model)',
      },
    },
    required: ['id', 'name', 'emoji', 'specialtyName', 'specialtyDescription', 'systemPrompt'],
  },

  async execute(params): Promise<ToolResult> {
    // Check if agent already exists
    if (subAgentRegistry.get(params.id)) {
      return {
        success: false,
        message: `Agent already exists: ${params.id}`,
      };
    }

    const manifest: SubAgentManifest = {
      id: params.id,
      version: '1.0.0',
      identity: {
        name: params.name,
        emoji: params.emoji,
        persona: params.persona,
        voice: params.voice || 'friendly',
      },
      specialty: {
        displayName: params.specialtyName,
        description: params.specialtyDescription,
        systemPrompt: params.systemPrompt,
        tools: params.tools ? params.tools.split(',').map((t: string) => t.trim()) : undefined,
      },
      defaultModel: params.model,
    };

    await createCustomAgent(manifest);

    return {
      success: true,
      message: `${params.emoji} ${params.name} created and ready!`,
      data: { agentId: params.id, manifest },
    };
  },
};

// ============ Export All ============
export const agentTools: Tool[] = [
  listAgentsTool,
  delegateTaskTool,
  getTaskStatusTool,
  agentInfoTool,
  setAgentModelTool,
  listAgentModelsTool,
  createAgentTool,
];
