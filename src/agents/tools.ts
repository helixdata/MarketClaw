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
  description: `Delegate a task to a specialized sub-agent. Use this when a task matches an agent's expertise.

**IMPORTANT**: For tasks that take more than a few seconds (research, analysis, content creation), use wait=false. The user will be notified when the task completes.`,
  parameters: {
    type: 'object',
    properties: {
      agentId: {
        type: 'string',
        description: 'Agent ID to delegate to (e.g., "twitter", "email", "creative", "audience")',
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
        description: 'Wait for task to complete. Use false for long-running tasks (research, analysis). Default: true for quick tasks, but prefer false for anything taking >10 seconds.',
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

    // For async tasks (wait: false), request notification on completion
    const isAsync = params.wait === false;
    
    // Spawn the task with notification flag for async tasks
    const task = await subAgentRegistry.spawn(params.agentId, params.task, {
      context,
      notifyOnComplete: isAsync,
    });

    // Wait for completion if requested (default: true)
    if (!isAsync) {
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

    // Async task - return immediately with acknowledgment
    return {
      success: true,
      message: `${agent.config.identity.emoji} Got it! I've handed this to **${agent.config.identity.name}**. I'll let you know when it's done.`,
      data: {
        taskId: task.id,
        agentId: params.agentId,
        agentName: agent.config.identity.name,
        async: true,
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

// ============ Recommend Agent Model ============
export const recommendAgentModelTool: Tool = {
  name: 'recommend_agent_model',
  description: 'Get AI model recommendations for a sub-agent based on their specialty and task requirements',
  parameters: {
    type: 'object',
    properties: {
      agentId: {
        type: 'string',
        description: 'Agent ID to get recommendations for (optional - recommends for all if not specified)',
      },
    },
  },

  async execute(params): Promise<ToolResult> {
    // Model characteristics for recommendation
    const modelProfiles: Record<string, { 
      strengths: string[]; 
      cost: 'low' | 'medium' | 'high';
      speed: 'fast' | 'medium' | 'slow';
      reasoning: 'basic' | 'good' | 'excellent';
    }> = {
      'gpt-4o-mini': { 
        strengths: ['short-form', 'fast', 'cheap', 'creative-writing'], 
        cost: 'low', speed: 'fast', reasoning: 'basic' 
      },
      'gpt-4o': { 
        strengths: ['general', 'balanced', 'vision', 'coding'], 
        cost: 'medium', speed: 'medium', reasoning: 'good' 
      },
      'claude-3-5-sonnet': { 
        strengths: ['analysis', 'reasoning', 'research', 'nuance', 'long-form'], 
        cost: 'medium', speed: 'medium', reasoning: 'excellent' 
      },
      'claude-3-opus': { 
        strengths: ['deep-research', 'complex-analysis', 'synthesis', 'strategy'], 
        cost: 'high', speed: 'slow', reasoning: 'excellent' 
      },
      'claude-3-haiku': { 
        strengths: ['fast', 'cheap', 'simple-tasks', 'high-volume'], 
        cost: 'low', speed: 'fast', reasoning: 'basic' 
      },
      'gemini-2.0-flash': { 
        strengths: ['vision', 'fast', 'multimodal', 'images'], 
        cost: 'low', speed: 'fast', reasoning: 'good' 
      },
    };

    // Agent specialty to model mapping
    const agentRecommendations: Record<string, { 
      recommended: string; 
      reason: string; 
      alternatives: string[];
    }> = {
      'twitter': {
        recommended: 'gpt-4o-mini',
        reason: 'Fast and cheap for short-form content. Tweets are simple, high-volume.',
        alternatives: ['claude-3-haiku', 'gemini-2.0-flash'],
      },
      'linkedin': {
        recommended: 'claude-3-5-sonnet',
        reason: 'B2B content needs nuance and professional tone. Quality > speed.',
        alternatives: ['gpt-4o', 'claude-3-opus'],
      },
      'email': {
        recommended: 'claude-3-5-sonnet',
        reason: 'Cold outreach needs good reasoning for personalization.',
        alternatives: ['gpt-4o', 'gpt-4o-mini'],
      },
      'creative': {
        recommended: 'gemini-2.0-flash',
        reason: 'Best for image prompts and visual tasks. Fast multimodal.',
        alternatives: ['gpt-4o', 'claude-3-5-sonnet'],
      },
      'analyst': {
        recommended: 'claude-3-5-sonnet',
        reason: 'Data analysis needs strong reasoning and pattern recognition.',
        alternatives: ['claude-3-opus', 'gpt-4o'],
      },
      'researcher': {
        recommended: 'claude-3-opus',
        reason: 'Deep research benefits from excellent reasoning and synthesis.',
        alternatives: ['claude-3-5-sonnet', 'gpt-4o'],
      },
      'producthunt': {
        recommended: 'claude-3-5-sonnet',
        reason: 'Launch content is critical. Needs quality and strategic thinking.',
        alternatives: ['gpt-4o', 'claude-3-opus'],
      },
      'audience': {
        recommended: 'claude-3-opus',
        reason: 'Audience research needs deep analysis, synthesis, and insight extraction.',
        alternatives: ['claude-3-5-sonnet', 'gpt-4o'],
      },
    };

    // If specific agent requested
    if (params?.agentId) {
      const agent = subAgentRegistry.get(params.agentId);
      if (!agent) {
        return {
          success: false,
          message: `Agent not found: ${params.agentId}`,
        };
      }

      const rec = agentRecommendations[params.agentId];
      if (!rec) {
        return {
          success: true,
          message: `No specific recommendation for ${params.agentId}. Using default model is fine.`,
          data: { agentId: params.agentId, recommended: 'default' },
        };
      }

      const currentModel = agent.config.model || 'default';
      const isOptimal = currentModel === rec.recommended;

      return {
        success: true,
        message: `${agent.config.identity.emoji} ${agent.config.identity.name}\n\n` +
          `**Recommended:** ${rec.recommended}\n` +
          `**Reason:** ${rec.reason}\n` +
          `**Alternatives:** ${rec.alternatives.join(', ')}\n` +
          `**Current:** ${currentModel}${isOptimal ? ' ✓ (optimal)' : ''}`,
        data: {
          agentId: params.agentId,
          current: currentModel,
          recommended: rec.recommended,
          reason: rec.reason,
          alternatives: rec.alternatives,
          isOptimal,
        },
      };
    }

    // Recommend for all agents
    const agents = subAgentRegistry.listEnabled();
    const recommendations = agents.map(a => {
      const id = a.config.specialty.id;
      const rec = agentRecommendations[id];
      const current = a.config.model || 'default';
      
      return {
        emoji: a.config.identity.emoji,
        name: a.config.identity.name,
        id,
        current,
        recommended: rec?.recommended || 'default',
        reason: rec?.reason || 'No specific recommendation',
        isOptimal: current === rec?.recommended || (!rec && current === 'default'),
      };
    });

    const formatted = recommendations
      .map(r => `${r.emoji} ${r.name}: ${r.current}${r.isOptimal ? ' ✓' : ` → ${r.recommended}`}`)
      .join('\n');

    const needsUpdate = recommendations.filter(r => !r.isOptimal);

    return {
      success: true,
      message: `**Agent Model Recommendations**\n\n${formatted}\n\n` +
        (needsUpdate.length > 0 
          ? `💡 ${needsUpdate.length} agent(s) could be optimized.`
          : '✅ All agents are using optimal models.'),
      data: { recommendations },
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
  recommendAgentModelTool,
  createAgentTool,
];
